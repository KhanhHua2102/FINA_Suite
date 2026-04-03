import { useEffect } from 'react';
import { useExpenseStore } from '../../store/expenseStore';

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
}

export function ExpenseDashboard() {
  const { statistics, statsLoading, selectedTaxYear, setTaxYear, fetchStatistics } = useExpenseStore();

  useEffect(() => {
    fetchStatistics(selectedTaxYear);
  }, [selectedTaxYear, fetchStatistics]);

  return (
    <div className="space-y-6">
      {/* Tax Year Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium" style={{ color: '#a1a1aa' }}>Tax Year</label>
        <select
          value={selectedTaxYear}
          onChange={e => setTaxYear(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
        >
          {generateTaxYears().map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
        </div>
      ) : !statistics ? (
        <p className="text-center py-12" style={{ color: '#71717a' }}>No data available</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Income" value={fmt(statistics.total_income)} color="#22c55e" />
            <StatCard label="Expenses" value={fmt(statistics.total_expense)} color="#ef4444" />
            <StatCard label="Deductions" value={fmt(statistics.total_deductions)} color="#3b82f6" />
            <StatCard label="GST Paid" value={fmt(statistics.total_gst)} color="#f59e0b" />
          </div>

          {/* Category Breakdown */}
          <div className="rounded-xl p-5" style={{ background: '#1e1e22', border: '1px solid #27272a' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#e4e4e7' }}>By Category</h3>
            {statistics.by_category.length === 0 ? (
              <p className="text-sm" style={{ color: '#71717a' }}>No categorised expenses yet</p>
            ) : (
              <div className="space-y-2">
                {statistics.by_category.map(cat => {
                  const maxCents = Math.max(...statistics.by_category.map(c => c.total_cents));
                  const pct = maxCents > 0 ? (cat.total_cents / maxCents) * 100 : 0;
                  return (
                    <div key={cat.code} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-sm w-40 truncate" style={{ color: '#d4d4d8' }}>{cat.name}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color }} />
                      </div>
                      <span className="text-sm font-mono w-24 text-right" style={{ color: '#a1a1aa' }}>
                        {fmt(cat.total_cents)}
                      </span>
                      <span className="text-xs w-8 text-right" style={{ color: '#71717a' }}>{cat.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly Trend */}
          <div className="rounded-xl p-5" style={{ background: '#1e1e22', border: '1px solid #27272a' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#e4e4e7' }}>Monthly Trend</h3>
            {statistics.monthly.length === 0 ? (
              <p className="text-sm" style={{ color: '#71717a' }}>No monthly data yet</p>
            ) : (
              <div className="space-y-2">
                {statistics.monthly.map(m => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-20" style={{ color: '#a1a1aa' }}>{m.month}</span>
                    <div className="flex-1 flex gap-1 h-4">
                      {m.income_cents > 0 && (
                        <div
                          className="h-full rounded-sm"
                          style={{
                            background: '#22c55e',
                            width: `${(m.income_cents / Math.max(m.income_cents, m.expense_cents)) * 50}%`,
                          }}
                          title={`Income: ${fmt(m.income_cents)}`}
                        />
                      )}
                      {m.expense_cents > 0 && (
                        <div
                          className="h-full rounded-sm"
                          style={{
                            background: '#ef4444',
                            width: `${(m.expense_cents / Math.max(m.income_cents, m.expense_cents)) * 50}%`,
                          }}
                          title={`Expenses: ${fmt(m.expense_cents)}`}
                        />
                      )}
                    </div>
                    <span className="text-xs font-mono w-20 text-right" style={{ color: '#22c55e' }}>{fmt(m.income_cents)}</span>
                    <span className="text-xs font-mono w-20 text-right" style={{ color: '#ef4444' }}>{fmt(m.expense_cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#1e1e22', border: '1px solid #27272a' }}>
      <p className="text-xs mb-1" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function generateTaxYears(): string[] {
  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y = currentFY - i;
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}
