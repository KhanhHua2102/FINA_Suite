import json
from typing import Optional

import httpx
from openai import AsyncOpenAI

from app.config import settings


# ATO deduction category descriptions
ATO_CATEGORIES = {
    "D1": "Work-related car & travel expenses",
    "D2": "Work-related travel expenses",
    "D3": "Work-related clothing, laundry & dry-cleaning",
    "D4": "Work-related self-education & home office",
    "D5": "Other work-related deductions (tools, phone, internet)",
    "D7": "Interest, dividend & investment deductions",
    "D9": "Gifts and donations",
    "D10": "Cost of managing tax affairs",
}

# Key ATO limits and rules for analysis
ATO_RULES = {
    "vehicle_cents_per_km": 85,  # cents, 2025-26
    "vehicle_max_km_no_logbook": 5000,
    "home_office_fixed_rate": 67,  # cents per hour
    "laundry_no_receipts_max": 150,  # dollars
    "work_expense_no_receipts_max": 300,  # dollars collective
    "instant_asset_writeoff": 300,  # dollars per item
    "donation_minimum": 2,  # dollars
}

TAX_ANALYSIS_SYSTEM = """You are an Australian tax advisor AI specialising in individual tax returns.
You analyse expense data and provide actionable advice on tax deductions under Australian tax law.
Always cite ATO guidelines where relevant. Be conservative — flag items that may not qualify rather than assume they do.
Return your analysis as valid JSON only, no markdown fences."""

TAX_ANALYSIS_PROMPT_TEMPLATE = """Analyse the following expense data for Australian tax year {tax_year} and provide deduction advice.

EXPENSE SUMMARY:
- Total Income: ${total_income:.2f}
- Total Expenses: ${total_expense:.2f}
- Total Claimed Deductions: ${total_deductions:.2f}
- Total GST Paid: ${total_gst:.2f}

DEDUCTIONS BY ATO CATEGORY:
{ato_breakdown}

CATEGORY BREAKDOWN:
{category_breakdown}

KEY ATO RULES FOR {tax_year}:
- Vehicle: 85c/km (max 5,000 km without logbook) OR actual costs with logbook
- Home office: 67c/hour fixed rate OR actual cost method
- Work clothing: must be occupation-specific, protective, or compulsory uniform
- Laundry: up to $150 without receipts
- Tools/equipment: items $300 or less can be instantly deducted
- Work expenses: up to $300 total without receipts (collective threshold)
- Donations: $2 minimum to DGR-endorsed organisations
- Self-education: must relate directly to current employment

Return JSON:
{{
  "summary": "2-3 sentence overview of the tax position",
  "estimated_tax_savings": 0.00,
  "total_valid_deductions": 0.00,
  "recommendations": ["actionable recommendation 1", "..."],
  "warnings": ["potential issue or disallowed deduction 1", "..."],
  "missed_deductions": ["commonly missed deduction the user may be eligible for 1", "..."],
  "by_category": [
    {{
      "ato_category": "D1",
      "category_name": "Work-related travel",
      "amount": 0.00,
      "status": "valid|review|warning",
      "notes": "explanation"
    }}
  ]
}}"""


class AustralianTaxAnalyzer:
    def __init__(self, expense_db):
        self._db = expense_db

    async def analyse(self, tax_year: Optional[str] = None) -> dict:
        """Run comprehensive Australian tax analysis for a given tax year."""
        summary = self._db.get_tax_summary(tax_year)
        stats = self._db.get_statistics(tax_year)
        rules = self._db.get_tax_rules(tax_year)
        ty = summary["tax_year"]

        # Build ATO breakdown text
        ato_lines = []
        for item in summary["by_ato_category"]:
            cat_desc = ATO_CATEGORIES.get(item["ato_category"], item["ato_category"])
            ato_lines.append(
                f"  {item['ato_category']} ({cat_desc}): ${item['total_cents'] / 100:.2f} "
                f"({item['items']} items)"
            )
        ato_breakdown = "\n".join(ato_lines) if ato_lines else "  No deductions claimed"

        # Build category breakdown text
        cat_lines = []
        for cat in stats["by_category"]:
            cat_lines.append(
                f"  {cat['name']}: ${cat['total_cents'] / 100:.2f} ({cat['count']} transactions)"
            )
        category_breakdown = "\n".join(cat_lines) if cat_lines else "  No categorised expenses"

        prompt = TAX_ANALYSIS_PROMPT_TEMPLATE.format(
            tax_year=ty,
            total_income=summary["total_income_cents"] / 100,
            total_expense=stats["total_expense"] / 100,
            total_deductions=summary["total_deductions_cents"] / 100,
            total_gst=stats["total_gst"] / 100,
            ato_breakdown=ato_breakdown,
            category_breakdown=category_breakdown,
        )

        raw = await self._call_llm(prompt, TAX_ANALYSIS_SYSTEM)
        analysis = self._parse_json(raw)
        analysis["tax_year"] = ty
        analysis["raw_summary"] = summary
        return analysis

    async def _call_llm(self, prompt: str, system_prompt: str) -> str:
        client = AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
            timeout=httpx.Timeout(120.0, connect=30.0),
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]

        models = [settings.expense_llm_model] + settings.expense_llm_fallback_models
        last_error = None

        for model in models:
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=settings.llm_max_tokens,
                )
                return resp.choices[0].message.content or ""
            except Exception as e:
                last_error = e

        raise RuntimeError(f"All models failed for tax analysis. Last error: {last_error}")

    @staticmethod
    def _parse_json(raw: str) -> dict:
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

        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except (json.JSONDecodeError, ValueError):
                pass

        try:
            from json_repair import repair_json
            return json.loads(repair_json(text))
        except Exception:
            pass

        return {
            "summary": "Tax analysis could not be parsed. Raw response available.",
            "raw_response": text[:2000],
            "recommendations": [],
            "warnings": ["Analysis response could not be parsed as JSON"],
            "missed_deductions": [],
            "by_category": [],
        }
