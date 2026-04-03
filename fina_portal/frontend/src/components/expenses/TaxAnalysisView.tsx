import { useEffect } from 'react';
import { Button } from '@heroui/button';
import { useExpenseStore } from '../../store/expenseStore';
import { expensesApi } from '../../services/api';

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
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

export function TaxAnalysisView() {
  const {
    selectedTaxYear, setTaxYear,
    taxSummary, taxAnalysis, taxLoading,
    fetchTaxSummary, runTaxAnalysis,
  } = useExpenseStore();

  useEffect(() => {
    fetchTaxSummary(selectedTaxYear);
  }, [selectedTaxYear, fetchTaxSummary]);

  const handleExport = () => {
    const url = expensesApi.exportCsv(selectedTaxYear);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
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
        <Button
          color="primary"
          size="sm"
          radius="lg"
          onClick={() => runTaxAnalysis(selectedTaxYear)}
          isLoading={taxLoading}
        >
          Run AI Analysis
        </Button>
        <Button size="sm" variant="bordered" radius="lg" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Tax Summary */}
      {taxSummary && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#1e1e22', border: '1px solid #27272a' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
            ATO Deduction Summary — FY {taxSummary.tax_year}
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs" style={{ color: '#71717a' }}>Total Income</p>
              <p className="text-lg font-semibold" style={{ color: '#22c55e' }}>{fmt(taxSummary.total_income_cents)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#71717a' }}>Total Deductions</p>
              <p className="text-lg font-semibold" style={{ color: '#3b82f6' }}>{fmt(taxSummary.total_deductions_cents)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#71717a' }}>GST Collected</p>
              <p className="text-lg font-semibold" style={{ color: '#f59e0b' }}>{fmt(taxSummary.gst_collected_cents)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#71717a' }}>GST Net (Owed/Refund)</p>
              <p className="text-lg font-semibold" style={{ color: taxSummary.gst_net_cents >= 0 ? '#ef4444' : '#22c55e' }}>
                {taxSummary.gst_net_cents >= 0 ? '' : '-'}{fmt(Math.abs(taxSummary.gst_net_cents))}
              </p>
            </div>
          </div>

          {/* ATO Category breakdown */}
          {taxSummary.by_ato_category.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#27272a' }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>ATO Category</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Description</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Amount</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSummary.by_ato_category.map(cat => (
                    <tr key={cat.ato_category} style={{ borderTop: '1px solid #27272a' }}>
                      <td className="px-4 py-2 font-mono" style={{ color: '#3b82f6' }}>{cat.ato_category}</td>
                      <td className="px-4 py-2" style={{ color: '#d4d4d8' }}>{cat.category_name}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#e4e4e7' }}>{fmt(cat.total_cents)}</td>
                      <td className="px-4 py-2 text-right" style={{ color: '#a1a1aa' }}>{cat.items}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis Result */}
      {taxAnalysis && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#1e1e22', border: '1px solid #27272a' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>AI Tax Analysis</h3>

          <p className="text-sm" style={{ color: '#d4d4d8' }}>{taxAnalysis.summary}</p>

          {taxAnalysis.estimated_tax_savings != null && (
            <p className="text-sm" style={{ color: '#22c55e' }}>
              Estimated tax savings: ${taxAnalysis.estimated_tax_savings.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </p>
          )}

          {/* Recommendations */}
          {taxAnalysis.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#22c55e' }}>Recommendations</h4>
              <ul className="space-y-1">
                {taxAnalysis.recommendations.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: '#d4d4d8' }}>
                    <span style={{ color: '#22c55e' }}>+</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {taxAnalysis.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#f59e0b' }}>Warnings</h4>
              <ul className="space-y-1">
                {taxAnalysis.warnings.map((w, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: '#d4d4d8' }}>
                    <span style={{ color: '#f59e0b' }}>!</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missed Deductions */}
          {taxAnalysis.missed_deductions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#3b82f6' }}>Potentially Missed Deductions</h4>
              <ul className="space-y-1">
                {taxAnalysis.missed_deductions.map((m, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: '#d4d4d8' }}>
                    <span style={{ color: '#3b82f6' }}>?</span> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* By Category Details */}
          {taxAnalysis.by_category.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#27272a' }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Category</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Amount</th>
                    <th className="text-center px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Status</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {taxAnalysis.by_category.map((cat, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #27272a' }}>
                      <td className="px-4 py-2" style={{ color: '#d4d4d8' }}>{cat.category_name}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#e4e4e7' }}>
                        ${cat.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: cat.status === 'valid' ? '#22c55e20' : cat.status === 'review' ? '#f59e0b20' : '#ef444420',
                            color: cat.status === 'valid' ? '#22c55e' : cat.status === 'review' ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: '#a1a1aa' }}>{cat.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
