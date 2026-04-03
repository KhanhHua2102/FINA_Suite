import asyncio
import base64
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from openai import AsyncOpenAI

from app.config import settings


ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
THUMB_SIZE = (400, 400)

EXTRACTION_SYSTEM_PROMPT = """You are an Australian receipt and invoice data extraction specialist.
Extract structured data from the provided receipt or invoice image.
Return ONLY valid JSON with no other text, no markdown fences."""

EXTRACTION_USER_PROMPT = """Extract data from this receipt/invoice. Return JSON with these fields:

{
  "merchant": "business name as shown on receipt",
  "date": "YYYY-MM-DD",
  "amount": 0.00,
  "currency": "AUD",
  "gst": 0.00,
  "description": "brief description of the purchase or service",
  "category_suggestion": "one of: work-travel, vehicle, work-clothing, home-office, self-education, tools-equipment, phone-internet, union-fees, donations, tax-agent, investment, groceries, dining, entertainment, transport, utilities",
  "line_items": [
    {"description": "item name", "quantity": 1, "unit_price": 0.00, "total": 0.00}
  ],
  "abn": "supplier ABN if visible, else null",
  "payment_method": "card/cash/eftpos/other or null",
  "is_tax_invoice": false
}

Rules:
- Amounts should be in AUD unless another currency is clearly shown
- GST in Australia is 10%. If GST is not explicitly shown, estimate it as amount / 11 (GST-inclusive price)
- is_tax_invoice should be true only if the document explicitly states "Tax Invoice" and shows an ABN
- If a field is not visible or determinable, use null
- For date, use the transaction/purchase date, not the print date"""


class ReceiptProcessor:
    def __init__(self, storage_dir: Path, expense_db):
        self._storage_dir = storage_dir
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._db = expense_db

    async def process_upload(
        self, file_bytes: bytes, filename: str, content_type: str
    ) -> dict:
        """Upload, store, generate thumbnail, and run AI extraction."""
        if content_type not in ALLOWED_TYPES:
            raise ValueError(f"Unsupported file type: {content_type}")
        if len(file_bytes) > MAX_FILE_SIZE:
            raise ValueError(f"File too large (max {MAX_FILE_SIZE // 1024 // 1024} MB)")

        # 1. Save file to disk
        storage_path, thumb_path = self._save_file(file_bytes, filename, content_type)

        # 2. Generate thumbnail
        try:
            self._generate_thumbnail(file_bytes, content_type, self._storage_dir / thumb_path)
        except Exception:
            thumb_path = None

        # 3. Create receipt record
        receipt_id = self._db.add_receipt({
            "filename": Path(storage_path).name,
            "original_name": filename,
            "file_type": content_type,
            "file_size": len(file_bytes),
            "storage_path": storage_path,
            "thumbnail_path": thumb_path,
            "status": "processing",
        })

        # 4. Run AI extraction
        try:
            extraction = await self._extract_with_ai(file_bytes, content_type, filename)
            self._db.update_receipt(
                receipt_id,
                ai_extracted=extraction,
                status="done",
            )
            return {"receipt_id": receipt_id, "extraction": extraction}
        except Exception as e:
            self._db.update_receipt(
                receipt_id,
                status="error",
                error_message=str(e),
            )
            return {"receipt_id": receipt_id, "extraction": None, "error": str(e)}

    async def reprocess(self, receipt_id: int) -> dict:
        """Re-run AI extraction on an existing receipt."""
        receipt = self._db.get_receipt(receipt_id)
        if not receipt:
            raise ValueError(f"Receipt {receipt_id} not found")

        file_path = self._storage_dir / receipt["storage_path"]
        if not file_path.exists():
            raise ValueError(f"Receipt file not found on disk")

        file_bytes = file_path.read_bytes()
        self._db.update_receipt(receipt_id, status="processing")

        try:
            extraction = await self._extract_with_ai(
                file_bytes, receipt["file_type"], receipt["original_name"]
            )
            self._db.update_receipt(receipt_id, ai_extracted=extraction, status="done")
            return {"receipt_id": receipt_id, "extraction": extraction}
        except Exception as e:
            self._db.update_receipt(receipt_id, status="error", error_message=str(e))
            return {"receipt_id": receipt_id, "extraction": None, "error": str(e)}

    def get_file_path(self, receipt_id: int) -> Optional[Path]:
        receipt = self._db.get_receipt(receipt_id)
        if not receipt:
            return None
        p = self._storage_dir / receipt["storage_path"]
        return p if p.exists() else None

    def get_thumbnail_path(self, receipt_id: int) -> Optional[Path]:
        receipt = self._db.get_receipt(receipt_id)
        if not receipt or not receipt.get("thumbnail_path"):
            return None
        p = self._storage_dir / receipt["thumbnail_path"]
        return p if p.exists() else None

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _save_file(self, file_bytes: bytes, filename: str, content_type: str) -> tuple[str, str]:
        """Save file to organized directory. Returns (storage_path, thumbnail_path) relative to storage_dir."""
        now = datetime.now()
        subdir = f"{now.year}/{now.month:02d}"
        dir_path = self._storage_dir / subdir
        dir_path.mkdir(parents=True, exist_ok=True)

        ext = Path(filename).suffix.lower() or self._ext_from_type(content_type)
        uid = uuid.uuid4().hex[:12]
        safe_name = f"{uid}{ext}"
        thumb_name = f"{uid}_thumb.jpg"

        (dir_path / safe_name).write_bytes(file_bytes)

        return f"{subdir}/{safe_name}", f"{subdir}/{thumb_name}"

    @staticmethod
    def _ext_from_type(content_type: str) -> str:
        return {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "application/pdf": ".pdf",
        }.get(content_type, ".bin")

    def _generate_thumbnail(self, file_bytes: bytes, content_type: str, output_path: Path):
        """Generate a JPEG thumbnail using Pillow (images) or PyMuPDF (PDFs)."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if content_type == "application/pdf":
            self._thumbnail_from_pdf(file_bytes, output_path)
        else:
            self._thumbnail_from_image(file_bytes, output_path)

    @staticmethod
    def _thumbnail_from_image(file_bytes: bytes, output_path: Path):
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(file_bytes))
        # Auto-rotate based on EXIF
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        img.thumbnail(THUMB_SIZE)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(str(output_path), "JPEG", quality=85)

    @staticmethod
    def _thumbnail_from_pdf(file_bytes: bytes, output_path: Path):
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page = doc[0]
        # Render at 2x for quality, then we'll let Pillow resize
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("jpeg")
        doc.close()

        # Resize with Pillow
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(img_bytes))
        img.thumbnail(THUMB_SIZE)
        img.save(str(output_path), "JPEG", quality=85)

    async def _extract_with_ai(
        self, file_bytes: bytes, content_type: str, filename: str
    ) -> dict:
        """Extract receipt data using LLM.

        Strategy: try vision (image attachment) first. If that fails (e.g. proxy
        doesn't support multimodal), fall back to extracting text from the
        document and sending it as plain text to the LLM.
        """
        # Attempt 1: vision-based extraction
        try:
            return await self._extract_vision(file_bytes, content_type)
        except Exception as vision_err:
            pass  # fall through to text-based extraction

        # Attempt 2: text-based extraction (OCR / PDF text)
        extracted_text = self._extract_text(file_bytes, content_type)
        if not extracted_text or len(extracted_text.strip()) < 10:
            raise RuntimeError(
                f"Vision extraction failed ({vision_err}) and no readable text "
                f"could be extracted from the document."
            )

        return await self._extract_from_text(extracted_text)

    async def _extract_vision(self, file_bytes: bytes, content_type: str) -> dict:
        """Try extracting via LLM vision (multimodal image attachment)."""
        if content_type == "application/pdf":
            image_b64, img_type = self._pdf_to_base64_image(file_bytes)
        else:
            image_b64 = base64.b64encode(file_bytes).decode("utf-8")
            img_type = content_type

        client = AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
            timeout=httpx.Timeout(120.0, connect=30.0),
        )

        messages = [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_USER_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img_type};base64,{image_b64}",
                        },
                    },
                ],
            },
        ]

        models = [settings.expense_llm_model] + settings.expense_llm_fallback_models
        last_error = None

        for model in models:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=2000,
                )
                raw = resp.choices[0].message.content or ""
                return self._parse_extraction(raw)
            except Exception as e:
                last_error = e

        raise RuntimeError(f"Vision extraction failed: {last_error}")

    async def _extract_from_text(self, text: str) -> dict:
        """Extract receipt data by sending extracted document text to the LLM."""
        client = AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
            timeout=httpx.Timeout(120.0, connect=30.0),
        )

        prompt = (
            f"The following text was extracted from a receipt or invoice document. "
            f"Based on this text, {EXTRACTION_USER_PROMPT}\n\n"
            f"--- DOCUMENT TEXT ---\n{text[:8000]}\n--- END ---"
        )

        messages = [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        models = [settings.expense_llm_model] + settings.expense_llm_fallback_models
        last_error = None

        for model in models:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=2000,
                )
                raw = resp.choices[0].message.content or ""
                return self._parse_extraction(raw)
            except Exception as e:
                last_error = e

        raise RuntimeError(f"Text extraction failed: {last_error}")

    @staticmethod
    def _extract_text(file_bytes: bytes, content_type: str) -> str:
        """Extract readable text from a PDF or image."""
        if content_type == "application/pdf":
            return ReceiptProcessor._extract_text_from_pdf(file_bytes)
        return ReceiptProcessor._extract_text_from_image(file_bytes)

    @staticmethod
    def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
        """Extract text from PDF using PyMuPDF."""
        import fitz

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = []
        for page_num in range(min(len(doc), 4)):
            text_parts.append(doc[page_num].get_text())
        doc.close()
        return "\n".join(text_parts).strip()

    @staticmethod
    def _extract_text_from_image(image_bytes: bytes) -> str:
        """Attempt basic OCR-like text extraction from an image.

        PyMuPDF can extract text from images when treated as a single-page
        document.  This won't work for all images but handles many scanned
        receipts.  Returns empty string if nothing extracted.
        """
        try:
            import fitz

            doc = fitz.open(stream=image_bytes, filetype=None)
            if len(doc) > 0:
                return doc[0].get_text().strip()
        except Exception:
            pass
        return ""

    @staticmethod
    def _pdf_to_base64_image(pdf_bytes: bytes) -> tuple[str, str]:
        """Render first page of PDF to a base64 JPEG for vision API."""
        import fitz
        import io

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("jpeg")
        doc.close()

        return base64.b64encode(img_bytes).decode("utf-8"), "image/jpeg"

    @staticmethod
    def _parse_extraction(raw: str) -> dict:
        """Parse JSON from LLM response, handling markdown fences."""
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: find outermost { ... }
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except (json.JSONDecodeError, ValueError):
                pass

        # Last resort: json_repair
        try:
            from json_repair import repair_json
            return json.loads(repair_json(text))
        except Exception:
            pass

        raise ValueError(f"Could not parse AI extraction response: {text[:200]}")
