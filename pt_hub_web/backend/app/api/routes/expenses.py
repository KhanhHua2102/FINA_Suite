import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic models ──────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    date: str
    merchant: Optional[str] = None
    description: Optional[str] = None
    amount_cents: int
    currency: str = "AUD"
    category_id: Optional[int] = None
    gst_cents: int = 0
    is_income: bool = False
    tax_deductible: bool = False
    deduction_pct: float = 100.0
    receipt_id: Optional[int] = None
    project: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    date: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    amount_cents: Optional[int] = None
    currency: Optional[str] = None
    category_id: Optional[int] = None
    gst_cents: Optional[int] = None
    is_income: Optional[bool] = None
    tax_deductible: Optional[bool] = None
    deduction_pct: Optional[float] = None
    receipt_id: Optional[int] = None
    project: Optional[str] = None
    notes: Optional[str] = None


class CategoryCreate(BaseModel):
    code: str
    name: str
    color: str = "#6B7280"
    type: str = "expense"
    tax_deductible: bool = False
    ato_category: Optional[str] = None
    llm_prompt: Optional[str] = None
    sort_order: int = 99


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    type: Optional[str] = None
    tax_deductible: Optional[bool] = None
    ato_category: Optional[str] = None
    llm_prompt: Optional[str] = None
    sort_order: Optional[int] = None


class TaxAnalysisRequest(BaseModel):
    tax_year: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────

def _get_expense_db():
    from app.config import expense_db
    return expense_db


def _get_receipt_processor():
    from app.config import receipt_processor
    return receipt_processor


def _get_tax_analyzer():
    from app.services.tax_analyzer import AustralianTaxAnalyzer
    return AustralianTaxAnalyzer(_get_expense_db())


# ── Duplicate check (MUST be before /{expense_id} routes) ───────

@router.get("/check-duplicates")
async def check_duplicates(date: str, amount_cents: int, gst_cents: int = 0):
    db = _get_expense_db()
    dupes = db.find_duplicates(date, amount_cents, gst_cents)
    return {"duplicates": dupes}


# ── Batch operations (MUST be before /{expense_id} routes) ──────

class BatchDeleteRequest(BaseModel):
    ids: list[int]


@router.post("/batch-delete")
async def batch_delete(req: BatchDeleteRequest):
    db = _get_expense_db()
    deleted = 0
    for eid in req.ids:
        if db.delete_expense(eid):
            deleted += 1
    return {"status": "deleted", "count": deleted}


@router.post("/batch-download-receipts")
async def batch_download_receipts(req: BatchDeleteRequest):
    """Download receipts for given expense IDs as a ZIP file."""
    import io
    import zipfile

    db = _get_expense_db()
    processor = _get_receipt_processor()

    buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for eid in req.ids:
            exp = db.get_expense(eid)
            if not exp or not exp.get("receipt_id"):
                continue
            path = processor.get_file_path(exp["receipt_id"])
            if not path:
                continue
            # Name: "description date.ext" or "receipt_id.ext"
            desc = exp.get("description") or exp.get("merchant") or f"receipt_{exp['receipt_id']}"
            date = exp.get("date", "")
            ext = path.suffix
            safe_name = f"{desc} {date}{ext}".replace("/", "_").replace("\\", "_")
            zf.write(path, safe_name)
            added += 1

    if added == 0:
        raise HTTPException(status_code=404, detail="No receipts found for selected expenses")

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=receipts.zip"},
    )


# ── Categories (MUST be before /{expense_id} routes) ────────────

@router.get("/categories")
async def list_categories():
    db = _get_expense_db()
    return {"categories": db.get_categories()}


@router.post("/categories")
async def create_category(req: CategoryCreate):
    db = _get_expense_db()
    try:
        cat_id = db.add_category(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": cat_id}


@router.put("/categories/{category_id}")
async def update_category(category_id: int, req: CategoryUpdate):
    db = _get_expense_db()
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    ok = db.update_category(category_id, **updates)
    if not ok:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "updated"}


@router.delete("/categories/{category_id}")
async def delete_category(category_id: int):
    db = _get_expense_db()
    ok = db.delete_category(category_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "deleted"}


# ── Receipts (MUST be before /{expense_id} routes) ──────────────

@router.post("/receipts/upload")
async def upload_receipt(file: UploadFile = File(...)):
    processor = _get_receipt_processor()
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"

    try:
        result = processor.process_upload(data, filename, content_type)
        # process_upload is async
        if hasattr(result, "__await__"):
            result = await result
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/receipts/{receipt_id}")
async def get_receipt(receipt_id: int):
    db = _get_expense_db()
    receipt = db.get_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/receipts/{receipt_id}/file")
async def get_receipt_file(receipt_id: int):
    processor = _get_receipt_processor()
    path = processor.get_file_path(receipt_id)
    if not path:
        raise HTTPException(status_code=404, detail="Receipt file not found")
    return FileResponse(str(path))


@router.get("/receipts/{receipt_id}/thumbnail")
async def get_receipt_thumbnail(receipt_id: int):
    processor = _get_receipt_processor()
    path = processor.get_thumbnail_path(receipt_id)
    if not path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(str(path), media_type="image/jpeg")


@router.post("/receipts/{receipt_id}/reprocess")
async def reprocess_receipt(receipt_id: int):
    processor = _get_receipt_processor()
    try:
        result = await processor.reprocess(receipt_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Statistics & Tax (MUST be before /{expense_id} routes) ──────

@router.get("/statistics")
async def get_statistics(tax_year: Optional[str] = None):
    db = _get_expense_db()
    return db.get_statistics(tax_year)


@router.get("/tax-summary")
async def get_tax_summary(tax_year: Optional[str] = None):
    db = _get_expense_db()
    return db.get_tax_summary(tax_year)


@router.get("/bas-summary")
async def get_bas_summary(quarter: Optional[str] = None):
    db = _get_expense_db()
    return db.get_bas_summary(quarter)


@router.post("/tax-analysis")
async def run_tax_analysis(req: TaxAnalysisRequest):
    analyzer = _get_tax_analyzer()
    try:
        result = await analyzer.analyse(req.tax_year)
        return result
    except Exception as e:
        logger.exception("Tax analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tax-rules")
async def get_tax_rules(tax_year: Optional[str] = None):
    db = _get_expense_db()
    return {"rules": db.get_tax_rules(tax_year)}


# ── Export ────────────────────────────────────────────────────────

@router.get("/export")
async def export_expenses(tax_year: Optional[str] = None):
    db = _get_expense_db()
    csv_data = db.export_csv(tax_year)
    if not csv_data:
        raise HTTPException(status_code=404, detail="No expenses to export")
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=expenses_{tax_year or 'all'}.csv"},
    )


# ── Expense CRUD (parameterized routes LAST) ────────────────────

@router.get("")
async def list_expenses(
    tax_year: Optional[str] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    is_income: Optional[bool] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
):
    db = _get_expense_db()
    expenses, total = db.get_expenses(
        tax_year=tax_year,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
        is_income=is_income,
        limit=limit,
        offset=offset,
    )
    return {"expenses": expenses, "total": total}


@router.post("")
async def create_expense(req: ExpenseCreate):
    db = _get_expense_db()
    expense_id = db.add_expense(req.model_dump())
    return {"id": expense_id}


@router.get("/{expense_id}")
async def get_expense(expense_id: int):
    db = _get_expense_db()
    expense = db.get_expense(expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.put("/{expense_id}")
async def update_expense(expense_id: int, req: ExpenseUpdate):
    db = _get_expense_db()
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    ok = db.update_expense(expense_id, **updates)
    if not ok:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"status": "updated"}


@router.delete("/{expense_id}")
async def delete_expense(expense_id: int):
    db = _get_expense_db()
    ok = db.delete_expense(expense_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"status": "deleted"}
