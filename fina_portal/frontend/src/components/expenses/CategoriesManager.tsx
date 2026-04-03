import { useEffect, useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { useExpenseStore } from '../../store/expenseStore';

export function CategoriesManager() {
  const { categories, categoriesLoading, fetchCategories, addCategory, updateCategory, deleteCategory } = useExpenseStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [taxDeductible, setTaxDeductible] = useState(false);
  const [atoCategory, setAtoCategory] = useState('');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setCode('');
    setName('');
    setColor('#6B7280');
    setType('expense');
    setTaxDeductible(false);
    setAtoCategory('');
    setLlmPrompt('');
    setError('');
    setEditingId(null);
    setShowCreate(false);
  };

  const startEdit = (cat: typeof categories[0]) => {
    setEditingId(cat.id);
    setCode(cat.code);
    setName(cat.name);
    setColor(cat.color);
    setType(cat.type);
    setTaxDeductible(!!cat.tax_deductible);
    setAtoCategory(cat.ato_category || '');
    setLlmPrompt(cat.llm_prompt || '');
    setShowCreate(false);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setError('Code and name are required');
      return;
    }
    setError('');

    try {
      const data = {
        code: code.trim(),
        name: name.trim(),
        color,
        type,
        tax_deductible: taxDeductible,
        ato_category: atoCategory || null,
        llm_prompt: llmPrompt || null,
      };

      if (editingId != null) {
        await updateCategory(editingId, data);
      } else {
        await addCategory(data);
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleDelete = async (id: number, catName: string) => {
    if (!confirm(`Delete category "${catName}"? Expenses using it will become uncategorised.`)) return;
    await deleteCategory(id);
  };

  if (categoriesLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-6 h-6 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
          Expense Categories ({categories.length})
        </h3>
        <Button color="primary" size="sm" radius="lg" onClick={() => { resetForm(); setShowCreate(true); }}>
          + Add Category
        </Button>
      </div>

      {/* Create / Edit Form */}
      {(showCreate || editingId != null) && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: '#1e1e22', border: '1px solid #3f3f46' }}>
          <h4 className="text-xs font-semibold" style={{ color: '#a1a1aa' }}>
            {editingId != null ? 'Edit Category' : 'New Category'}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              label="Code"
              value={code}
              onValueChange={setCode}
              variant="bordered"
              size="sm"
              isDisabled={editingId != null}
            />
            <Input label="Name" value={name} onValueChange={setName} variant="bordered" size="sm" />
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#a1a1aa' }}>Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#a1a1aa' }}>Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'income' | 'expense')}
                className="w-full px-3 py-1.5 rounded-lg text-sm"
                style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Input label="ATO Category (e.g. D1)" value={atoCategory} onValueChange={setAtoCategory} variant="bordered" size="sm" />
            <Input label="LLM Prompt (for AI extraction)" value={llmPrompt} onValueChange={setLlmPrompt} variant="bordered" size="sm" />
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={taxDeductible} onChange={e => setTaxDeductible(e.target.checked)} />
                <span className="text-sm" style={{ color: '#a1a1aa' }}>Tax Deductible</span>
              </label>
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: '#f31260' }}>{error}</p>}
          <div className="flex gap-2">
            <Button color="primary" size="sm" radius="lg" onClick={handleSave}>
              {editingId != null ? 'Update' : 'Create'}
            </Button>
            <Button variant="light" size="sm" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Categories Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #27272a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1e1e22' }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Color</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Code</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Name</th>
              <th className="text-center px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Type</th>
              <th className="text-center px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>ATO</th>
              <th className="text-center px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Tax Ded.</th>
              <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} style={{ borderTop: '1px solid #27272a' }}>
                <td className="px-4 py-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: cat.color }} />
                </td>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: '#a1a1aa' }}>{cat.code}</td>
                <td className="px-4 py-2" style={{ color: '#e4e4e7' }}>{cat.name}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: cat.type === 'income' ? '#22c55e20' : '#ef444420',
                      color: cat.type === 'income' ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {cat.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-center font-mono text-xs" style={{ color: '#3b82f6' }}>
                  {cat.ato_category || '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  {cat.tax_deductible ? (
                    <span className="text-xs" style={{ color: '#22c55e' }}>Yes</span>
                  ) : (
                    <span className="text-xs" style={{ color: '#52525b' }}>No</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="light" onClick={() => startEdit(cat)} className="min-w-0 px-2">
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="min-w-0 px-2"
                    >
                      Del
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
