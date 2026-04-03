import { useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { useExpenseStore } from '../../store/expenseStore';
import type { Expense, ExpenseCategory } from '../../services/types';

interface ExpenseFormProps {
  expenseId?: number;
  initialData?: Partial<Expense>;
  categories: ExpenseCategory[];
  onSave: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ expenseId, initialData, categories, onSave, onCancel }: ExpenseFormProps) {
  const { addExpense, updateExpense } = useExpenseStore();
  const isEdit = expenseId != null;

  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [amount, setAmount] = useState(initialData ? String(initialData.amount_cents! / 100) : '');
  const [gst, setGst] = useState(initialData ? String(initialData.gst_cents! / 100) : '');
  const [categoryId, setCategoryId] = useState<string>(initialData?.category_id != null ? String(initialData.category_id) : '');
  const [isIncome, setIsIncome] = useState(initialData?.is_income || false);
  const [taxDeductible, setTaxDeductible] = useState(initialData?.tax_deductible || false);
  const [deductionPct, setDeductionPct] = useState(String(initialData?.deduction_pct ?? 100));
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amountNum = parseFloat(amount);
    if (!date || isNaN(amountNum) || amountNum <= 0) {
      setError('Date and a positive amount are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data: Partial<Expense> = {
        date,
        merchant: merchant || null,
        description: description || null,
        amount_cents: Math.round(amountNum * 100),
        gst_cents: Math.round((parseFloat(gst) || 0) * 100),
        category_id: categoryId ? Number(categoryId) : null,
        is_income: isIncome,
        tax_deductible: taxDeductible,
        deduction_pct: parseFloat(deductionPct) || 100,
        notes: notes || null,
      };

      if (isEdit) {
        await updateExpense(expenseId, data);
      } else {
        await addExpense(data);
      }
      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Auto-set tax deductible based on category
  const handleCategoryChange = (val: string) => {
    setCategoryId(val);
    if (val) {
      const cat = categories.find(c => c.id === Number(val));
      if (cat) {
        setTaxDeductible(!!cat.tax_deductible);
        setIsIncome(cat.type === 'income');
      }
    }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: '#1e1e22', border: '1px solid #3f3f46' }}>
      <h3 className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
        {isEdit ? 'Edit Expense' : 'Add Expense'}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input label="Date" type="date" value={date} onValueChange={setDate} variant="bordered" size="sm" />
        <Input label="Merchant" value={merchant} onValueChange={setMerchant} variant="bordered" size="sm" />
        <Input label="Amount ($)" type="number" step="0.01" value={amount} onValueChange={setAmount} variant="bordered" size="sm" />
        <Input label="GST ($)" type="number" step="0.01" value={gst} onValueChange={setGst} variant="bordered" size="sm" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#a1a1aa' }}>Category</label>
          <select
            value={categoryId}
            onChange={e => handleCategoryChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
          >
            <option value="">Uncategorised</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Input label="Description" value={description} onValueChange={setDescription} variant="bordered" size="sm" />
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={taxDeductible} onChange={e => setTaxDeductible(e.target.checked)} />
            <span className="text-sm" style={{ color: '#a1a1aa' }}>Tax Deductible</span>
          </label>
        </div>
        {taxDeductible && (
          <Input label="Deduction %" type="number" step="1" value={deductionPct} onValueChange={setDeductionPct} variant="bordered" size="sm" />
        )}
      </div>

      <Input label="Notes" value={notes} onValueChange={setNotes} variant="bordered" size="sm" />

      {error && <p className="text-xs" style={{ color: '#f31260' }}>{error}</p>}

      <div className="flex gap-2">
        <Button color="primary" size="sm" radius="lg" onClick={handleSave} isLoading={saving}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
        <Button variant="light" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
