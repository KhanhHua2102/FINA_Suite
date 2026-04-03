import csv
import io
import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional


class ExpenseDB:
    def __init__(self, db_path: Path):
        self._path = db_path
        self._lock = threading.Lock()
        self._ensure_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def _ensure_schema(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock, self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS categories (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    code            TEXT NOT NULL UNIQUE,
                    name            TEXT NOT NULL,
                    color           TEXT NOT NULL DEFAULT '#6B7280',
                    type            TEXT NOT NULL DEFAULT 'expense'
                                    CHECK(type IN ('income','expense')),
                    tax_deductible  INTEGER NOT NULL DEFAULT 0,
                    ato_category    TEXT,
                    llm_prompt      TEXT,
                    sort_order      INTEGER NOT NULL DEFAULT 0,
                    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS receipts (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename        TEXT NOT NULL,
                    original_name   TEXT NOT NULL,
                    file_type       TEXT NOT NULL,
                    file_size       INTEGER NOT NULL,
                    storage_path    TEXT NOT NULL,
                    thumbnail_path  TEXT,
                    ai_extracted    TEXT,
                    status          TEXT NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending','processing','done','error')),
                    error_message   TEXT,
                    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS expenses (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    date            TEXT NOT NULL,
                    merchant        TEXT,
                    description     TEXT,
                    amount_cents    INTEGER NOT NULL,
                    currency        TEXT NOT NULL DEFAULT 'AUD',
                    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    gst_cents       INTEGER NOT NULL DEFAULT 0,
                    is_income       INTEGER NOT NULL DEFAULT 0,
                    tax_deductible  INTEGER NOT NULL DEFAULT 0,
                    deduction_pct   REAL NOT NULL DEFAULT 100.0,
                    tax_year        TEXT,
                    bas_quarter     TEXT,
                    receipt_id      INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
                    project         TEXT,
                    notes           TEXT,
                    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
                CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
                CREATE INDEX IF NOT EXISTS idx_expenses_tax_year ON expenses(tax_year);

                CREATE TABLE IF NOT EXISTS tax_rules (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_code   TEXT NOT NULL,
                    rule_name       TEXT NOT NULL,
                    description     TEXT NOT NULL,
                    max_amount_cents INTEGER,
                    requires_records INTEGER NOT NULL DEFAULT 1,
                    ato_reference   TEXT,
                    tax_year        TEXT NOT NULL DEFAULT '2025-26',
                    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
                );
            """)
            self._seed_defaults(conn)

    def _seed_defaults(self, conn: sqlite3.Connection):
        """Seed default Australian tax categories and rules if empty."""
        count = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
        if count > 0:
            return

        categories = [
            # Tax-deductible (ATO D-schedule categories)
            ("work-travel", "Work-Related Travel", "#3B82F6", "expense", 1, "D1",
             "Work-related travel expenses: flights, accommodation, meals while travelling for work", 1),
            ("vehicle", "Vehicle & Car Expenses", "#6366F1", "expense", 1, "D1",
             "Vehicle and car expenses for work-related travel", 2),
            ("work-clothing", "Work Clothing & Uniforms", "#8B5CF6", "expense", 1, "D3",
             "Occupation-specific clothing, protective wear, compulsory uniforms", 3),
            ("home-office", "Home Office Expenses", "#EC4899", "expense", 1, "D4",
             "Home office running costs: electricity, internet, phone, furniture depreciation", 4),
            ("self-education", "Self-Education", "#F59E0B", "expense", 1, "D4",
             "Self-education expenses directly related to current employment", 5),
            ("tools-equipment", "Tools & Equipment", "#10B981", "expense", 1, "D5",
             "Tools, equipment, and other assets used for work (under $300 instant deduction)", 6),
            ("phone-internet", "Phone & Internet", "#06B6D4", "expense", 1, "D5",
             "Phone and internet costs apportioned for work use", 7),
            ("union-fees", "Union & Professional Fees", "#64748B", "expense", 1, "D3",
             "Union fees, professional association memberships, practising certificates", 8),
            ("donations", "Gifts & Donations", "#F97316", "expense", 1, "D9",
             "Tax-deductible donations to DGR-endorsed organisations ($2 minimum)", 9),
            ("tax-agent", "Tax Agent Fees", "#78716C", "expense", 1, "D10",
             "Tax agent and tax return preparation fees", 10),
            ("investment", "Investment Expenses", "#0EA5E9", "expense", 1, "D7",
             "Interest, dividend deductions, investment management fees", 11),
            # Income categories
            ("income-salary", "Salary & Wages", "#22C55E", "income", 0, None,
             "Regular employment salary and wages", 12),
            ("income-freelance", "Freelance/Contract Income", "#16A34A", "income", 0, None,
             "Freelance, contract, or ABN income", 13),
            ("income-dividends", "Dividends", "#15803D", "income", 0, None,
             "Dividend income from shares and investments", 14),
            ("income-rental", "Rental Income", "#166534", "income", 0, None,
             "Rental property income", 15),
            # Personal (non-deductible)
            ("groceries", "Groceries", "#A3A3A3", "expense", 0, None,
             "Grocery and supermarket purchases", 16),
            ("dining", "Dining & Restaurants", "#D4D4D4", "expense", 0, None,
             "Dining out, restaurants, takeaway, cafes", 17),
            ("entertainment", "Entertainment", "#737373", "expense", 0, None,
             "Entertainment, hobbies, subscriptions", 18),
            ("transport", "Transport (Personal)", "#525252", "expense", 0, None,
             "Personal transport: public transport, ride-sharing, parking", 19),
            ("utilities", "Utilities & Bills", "#404040", "expense", 0, None,
             "Household bills: electricity, gas, water, internet (personal portion)", 20),
        ]

        conn.executemany(
            """INSERT INTO categories
               (code, name, color, type, tax_deductible, ato_category, llm_prompt, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            categories,
        )

        # Seed key ATO rules
        rules = [
            ("vehicle", "Cents per km method", "85 cents per km, max 5,000 km without logbook",
             425000, 0, "D1 — cents per km", "2025-26"),
            ("vehicle", "Logbook method", "Actual costs apportioned by logbook percentage — no cap with valid logbook",
             None, 1, "D1 — logbook method", "2025-26"),
            ("home-office", "Fixed rate method", "67 cents per hour worked from home",
             None, 1, "D4 — fixed rate 67c/hr", "2025-26"),
            ("work-clothing", "Laundry without receipts", "Up to $150 laundry deduction without written evidence",
             15000, 0, "D3 — laundry threshold", "2025-26"),
            ("tools-equipment", "Instant asset write-off", "Items costing $300 or less can be immediately deducted",
             30000, 0, "D5 — instant write-off", "2025-26"),
            ("donations", "Minimum donation", "Donations must be $2 or more to a DGR-endorsed organisation",
             None, 1, "D9 — DGR requirement", "2025-26"),
        ]

        conn.executemany(
            """INSERT INTO tax_rules
               (category_code, rule_name, description, max_amount_cents, requires_records, ato_reference, tax_year)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            rules,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def compute_tax_year(date_str: str) -> str:
        """Australian FY: July 1 – June 30.  '2025-08-15' → '2025-26'."""
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        if dt.month >= 7:
            return f"{dt.year}-{str(dt.year + 1)[-2:]}"
        return f"{dt.year - 1}-{str(dt.year)[-2:]}"

    @staticmethod
    def compute_bas_quarter(date_str: str) -> str:
        """BAS quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun."""
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        m = dt.month
        if m >= 7 and m <= 9:
            return f"{dt.year}-Q1"
        elif m >= 10 and m <= 12:
            return f"{dt.year}-Q2"
        elif m >= 1 and m <= 3:
            return f"{dt.year}-Q3"
        else:
            return f"{dt.year}-Q4"

    @staticmethod
    def _current_tax_year() -> str:
        now = datetime.now()
        if now.month >= 7:
            return f"{now.year}-{str(now.year + 1)[-2:]}"
        return f"{now.year - 1}-{str(now.year)[-2:]}"

    # ------------------------------------------------------------------
    # Categories CRUD
    # ------------------------------------------------------------------

    def get_categories(self) -> list[dict]:
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM categories ORDER BY sort_order, name"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_category_by_code(self, code: str) -> Optional[dict]:
        with self._lock, self._conn() as conn:
            row = conn.execute("SELECT * FROM categories WHERE code = ?", (code,)).fetchone()
            return dict(row) if row else None

    def add_category(self, data: dict) -> int:
        with self._lock, self._conn() as conn:
            cur = conn.execute(
                """INSERT INTO categories (code, name, color, type, tax_deductible, ato_category, llm_prompt, sort_order)
                   VALUES (:code, :name, :color, :type, :tax_deductible, :ato_category, :llm_prompt, :sort_order)""",
                {
                    "code": data["code"],
                    "name": data["name"],
                    "color": data.get("color", "#6B7280"),
                    "type": data.get("type", "expense"),
                    "tax_deductible": int(data.get("tax_deductible", False)),
                    "ato_category": data.get("ato_category"),
                    "llm_prompt": data.get("llm_prompt"),
                    "sort_order": data.get("sort_order", 99),
                },
            )
            return cur.lastrowid

    def update_category(self, category_id: int, **kwargs) -> bool:
        allowed = {"name", "color", "type", "tax_deductible", "ato_category", "llm_prompt", "sort_order"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False
        cols = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = category_id
        with self._lock, self._conn() as conn:
            conn.execute(f"UPDATE categories SET {cols} WHERE id = :id", updates)
            return conn.total_changes > 0

    def delete_category(self, category_id: int) -> bool:
        with self._lock, self._conn() as conn:
            conn.execute("UPDATE expenses SET category_id = NULL WHERE category_id = ?", (category_id,))
            conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
            return conn.total_changes > 0

    # ------------------------------------------------------------------
    # Receipts CRUD
    # ------------------------------------------------------------------

    def add_receipt(self, data: dict) -> int:
        with self._lock, self._conn() as conn:
            cur = conn.execute(
                """INSERT INTO receipts (filename, original_name, file_type, file_size, storage_path, thumbnail_path, status)
                   VALUES (:filename, :original_name, :file_type, :file_size, :storage_path, :thumbnail_path, :status)""",
                {
                    "filename": data["filename"],
                    "original_name": data["original_name"],
                    "file_type": data["file_type"],
                    "file_size": data["file_size"],
                    "storage_path": data["storage_path"],
                    "thumbnail_path": data.get("thumbnail_path"),
                    "status": data.get("status", "pending"),
                },
            )
            return cur.lastrowid

    def update_receipt(self, receipt_id: int, **kwargs) -> bool:
        allowed = {"thumbnail_path", "ai_extracted", "status", "error_message"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False
        if "ai_extracted" in updates and isinstance(updates["ai_extracted"], dict):
            updates["ai_extracted"] = json.dumps(updates["ai_extracted"])
        cols = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = receipt_id
        with self._lock, self._conn() as conn:
            conn.execute(f"UPDATE receipts SET {cols} WHERE id = :id", updates)
            return conn.total_changes > 0

    def get_receipt(self, receipt_id: int) -> Optional[dict]:
        with self._lock, self._conn() as conn:
            row = conn.execute("SELECT * FROM receipts WHERE id = ?", (receipt_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            if d.get("ai_extracted"):
                try:
                    d["ai_extracted"] = json.loads(d["ai_extracted"])
                except (json.JSONDecodeError, TypeError):
                    pass
            return d

    # ------------------------------------------------------------------
    # Expenses CRUD
    # ------------------------------------------------------------------

    def add_expense(self, data: dict) -> int:
        date_str = data["date"]
        tax_year = data.get("tax_year") or self.compute_tax_year(date_str)
        bas_quarter = data.get("bas_quarter") or self.compute_bas_quarter(date_str)

        with self._lock, self._conn() as conn:
            cur = conn.execute(
                """INSERT INTO expenses
                   (date, merchant, description, amount_cents, currency, category_id,
                    gst_cents, is_income, tax_deductible, deduction_pct,
                    tax_year, bas_quarter, receipt_id, project, notes)
                   VALUES (:date, :merchant, :description, :amount_cents, :currency, :category_id,
                           :gst_cents, :is_income, :tax_deductible, :deduction_pct,
                           :tax_year, :bas_quarter, :receipt_id, :project, :notes)""",
                {
                    "date": date_str,
                    "merchant": data.get("merchant"),
                    "description": data.get("description"),
                    "amount_cents": data["amount_cents"],
                    "currency": data.get("currency", "AUD"),
                    "category_id": data.get("category_id"),
                    "gst_cents": data.get("gst_cents", 0),
                    "is_income": int(data.get("is_income", False)),
                    "tax_deductible": int(data.get("tax_deductible", False)),
                    "deduction_pct": data.get("deduction_pct", 100.0),
                    "tax_year": tax_year,
                    "bas_quarter": bas_quarter,
                    "receipt_id": data.get("receipt_id"),
                    "project": data.get("project"),
                    "notes": data.get("notes"),
                },
            )
            return cur.lastrowid

    def update_expense(self, expense_id: int, **kwargs) -> bool:
        allowed = {
            "date", "merchant", "description", "amount_cents", "currency",
            "category_id", "gst_cents", "is_income", "tax_deductible",
            "deduction_pct", "receipt_id", "project", "notes",
        }
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False

        # Recompute tax_year / bas_quarter if date changed
        if "date" in updates:
            updates["tax_year"] = self.compute_tax_year(updates["date"])
            updates["bas_quarter"] = self.compute_bas_quarter(updates["date"])

        cols = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = expense_id
        with self._lock, self._conn() as conn:
            conn.execute(f"UPDATE expenses SET {cols} WHERE id = :id", updates)
            return conn.total_changes > 0

    def delete_expense(self, expense_id: int) -> bool:
        with self._lock, self._conn() as conn:
            conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
            return conn.total_changes > 0

    def find_duplicates(self, date: str, amount_cents: int, gst_cents: int = 0) -> list[dict]:
        """Find existing expenses matching date, amount, and GST."""
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                """SELECT e.*, c.name AS category_name, c.color AS category_color
                   FROM expenses e
                   LEFT JOIN categories c ON e.category_id = c.id
                   WHERE e.date = ? AND e.amount_cents = ? AND e.gst_cents = ?""",
                (date, amount_cents, gst_cents),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_expense(self, expense_id: int) -> Optional[dict]:
        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT e.*, c.code AS category_code, c.name AS category_name,
                          c.color AS category_color, c.ato_category
                   FROM expenses e
                   LEFT JOIN categories c ON e.category_id = c.id
                   WHERE e.id = ?""",
                (expense_id,),
            ).fetchone()
            return dict(row) if row else None

    def get_expenses(
        self,
        tax_year: Optional[str] = None,
        category_id: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        search: Optional[str] = None,
        is_income: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        where_clauses = []
        params: dict = {}

        if tax_year:
            where_clauses.append("e.tax_year = :tax_year")
            params["tax_year"] = tax_year
        if category_id is not None:
            where_clauses.append("e.category_id = :category_id")
            params["category_id"] = category_id
        if date_from:
            where_clauses.append("e.date >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where_clauses.append("e.date <= :date_to")
            params["date_to"] = date_to
        if search:
            where_clauses.append(
                "(e.merchant LIKE :search OR e.description LIKE :search OR e.notes LIKE :search)"
            )
            params["search"] = f"%{search}%"
        if is_income is not None:
            where_clauses.append("e.is_income = :is_income")
            params["is_income"] = int(is_income)

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        with self._lock, self._conn() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM expenses e{where_sql}", params
            ).fetchone()[0]

            rows = conn.execute(
                f"""SELECT e.*, c.code AS category_code, c.name AS category_name,
                           c.color AS category_color, c.ato_category
                    FROM expenses e
                    LEFT JOIN categories c ON e.category_id = c.id
                    {where_sql}
                    ORDER BY e.date DESC, e.id DESC
                    LIMIT :limit OFFSET :offset""",
                {**params, "limit": limit, "offset": offset},
            ).fetchall()

            return [dict(r) for r in rows], total

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_statistics(self, tax_year: Optional[str] = None) -> dict:
        ty = tax_year or self._current_tax_year()
        with self._lock, self._conn() as conn:
            # Totals
            row = conn.execute(
                """SELECT
                       COALESCE(SUM(CASE WHEN is_income = 1 THEN amount_cents ELSE 0 END), 0) AS total_income,
                       COALESCE(SUM(CASE WHEN is_income = 0 THEN amount_cents ELSE 0 END), 0) AS total_expense,
                       COALESCE(SUM(CASE WHEN tax_deductible = 1 THEN
                           CAST(amount_cents * deduction_pct / 100.0 AS INTEGER) ELSE 0 END), 0) AS total_deductions,
                       COALESCE(SUM(gst_cents), 0) AS total_gst,
                       COUNT(*) AS count
                   FROM expenses WHERE tax_year = ?""",
                (ty,),
            ).fetchone()
            totals = dict(row)

            # By category
            cat_rows = conn.execute(
                """SELECT c.id, c.code, c.name, c.color, c.type, c.ato_category,
                          COALESCE(SUM(e.amount_cents), 0) AS total_cents,
                          COUNT(e.id) AS count
                   FROM expenses e
                   JOIN categories c ON e.category_id = c.id
                   WHERE e.tax_year = ?
                   GROUP BY c.id
                   ORDER BY total_cents DESC""",
                (ty,),
            ).fetchall()

            # Monthly breakdown
            monthly_rows = conn.execute(
                """SELECT strftime('%Y-%m', date) AS month,
                          COALESCE(SUM(CASE WHEN is_income = 1 THEN amount_cents ELSE 0 END), 0) AS income_cents,
                          COALESCE(SUM(CASE WHEN is_income = 0 THEN amount_cents ELSE 0 END), 0) AS expense_cents
                   FROM expenses
                   WHERE tax_year = ?
                   GROUP BY month
                   ORDER BY month""",
                (ty,),
            ).fetchall()

            return {
                "tax_year": ty,
                **totals,
                "by_category": [dict(r) for r in cat_rows],
                "monthly": [dict(r) for r in monthly_rows],
            }

    def get_tax_summary(self, tax_year: Optional[str] = None) -> dict:
        ty = tax_year or self._current_tax_year()
        with self._lock, self._conn() as conn:
            # Total income
            income = conn.execute(
                "SELECT COALESCE(SUM(amount_cents), 0) FROM expenses WHERE tax_year = ? AND is_income = 1",
                (ty,),
            ).fetchone()[0]

            # Deductions by ATO category
            ato_rows = conn.execute(
                """SELECT c.ato_category, c.name AS category_name,
                          COALESCE(SUM(CAST(e.amount_cents * e.deduction_pct / 100.0 AS INTEGER)), 0) AS total_cents,
                          COUNT(e.id) AS items
                   FROM expenses e
                   JOIN categories c ON e.category_id = c.id
                   WHERE e.tax_year = ? AND e.tax_deductible = 1 AND c.ato_category IS NOT NULL
                   GROUP BY c.ato_category
                   ORDER BY c.ato_category""",
                (ty,),
            ).fetchall()

            total_deductions = sum(r["total_cents"] for r in ato_rows)

            # GST summary
            gst_collected = conn.execute(
                "SELECT COALESCE(SUM(gst_cents), 0) FROM expenses WHERE tax_year = ? AND is_income = 1",
                (ty,),
            ).fetchone()[0]

            gst_paid = conn.execute(
                "SELECT COALESCE(SUM(gst_cents), 0) FROM expenses WHERE tax_year = ? AND is_income = 0",
                (ty,),
            ).fetchone()[0]

            # Tax rules for this year
            rules = conn.execute(
                "SELECT * FROM tax_rules WHERE tax_year = ?", (ty,)
            ).fetchall()

            return {
                "tax_year": ty,
                "total_income_cents": income,
                "total_deductions_cents": total_deductions,
                "by_ato_category": [dict(r) for r in ato_rows],
                "gst_collected_cents": gst_collected,
                "gst_paid_cents": gst_paid,
                "gst_net_cents": gst_collected - gst_paid,
                "rules": [dict(r) for r in rules],
            }

    def get_bas_summary(self, quarter: Optional[str] = None) -> dict:
        if not quarter:
            quarter = self.compute_bas_quarter(datetime.now().strftime("%Y-%m-%d"))

        with self._lock, self._conn() as conn:
            row = conn.execute(
                """SELECT
                       COALESCE(SUM(CASE WHEN is_income = 1 THEN amount_cents ELSE 0 END), 0) AS total_income,
                       COALESCE(SUM(CASE WHEN is_income = 0 THEN amount_cents ELSE 0 END), 0) AS total_expense,
                       COALESCE(SUM(CASE WHEN is_income = 1 THEN gst_cents ELSE 0 END), 0) AS gst_collected,
                       COALESCE(SUM(CASE WHEN is_income = 0 THEN gst_cents ELSE 0 END), 0) AS gst_paid,
                       COUNT(*) AS transaction_count
                   FROM expenses WHERE bas_quarter = ?""",
                (quarter,),
            ).fetchone()

            return {
                "quarter": quarter,
                **dict(row),
                "gst_net": row["gst_collected"] - row["gst_paid"],
            }

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def export_csv(self, tax_year: Optional[str] = None) -> str:
        expenses, _ = self.get_expenses(tax_year=tax_year, limit=100000, offset=0)
        output = io.StringIO()
        if not expenses:
            return ""

        fields = [
            "date", "merchant", "description", "amount", "gst", "currency",
            "category", "tax_deductible", "deduction_pct", "tax_year",
            "bas_quarter", "project", "notes",
        ]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()

        for e in expenses:
            writer.writerow({
                "date": e["date"],
                "merchant": e.get("merchant", ""),
                "description": e.get("description", ""),
                "amount": e["amount_cents"] / 100.0,
                "gst": e["gst_cents"] / 100.0,
                "currency": e.get("currency", "AUD"),
                "category": e.get("category_name", ""),
                "tax_deductible": "Yes" if e.get("tax_deductible") else "No",
                "deduction_pct": e.get("deduction_pct", 100),
                "tax_year": e.get("tax_year", ""),
                "bas_quarter": e.get("bas_quarter", ""),
                "project": e.get("project", ""),
                "notes": e.get("notes", ""),
            })

        return output.getvalue()

    # ------------------------------------------------------------------
    # Tax rules
    # ------------------------------------------------------------------

    def get_tax_rules(self, tax_year: Optional[str] = None) -> list[dict]:
        ty = tax_year or self._current_tax_year()
        with self._lock, self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tax_rules WHERE tax_year = ? ORDER BY category_code",
                (ty,),
            ).fetchall()
            return [dict(r) for r in rows]
