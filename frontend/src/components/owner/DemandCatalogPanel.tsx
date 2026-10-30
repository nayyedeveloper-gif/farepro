import { useMemo, useState } from 'react';

export type DemandCatalogItem = {
  code: string;
  name: string;
  amountMmk: number;
};

export const DEFAULT_DEMAND_CATALOG: DemandCatalogItem[] = [
  { code: 'airport', name: 'Airport', amountMmk: 2000 },
  { code: 'waiting', name: 'Waiting', amountMmk: 500 },
  { code: 'luggage', name: 'Luggage', amountMmk: 1000 },
  { code: 'peak', name: 'Peak demand', amountMmk: 1000 },
  { code: 'night_extra', name: 'Night demand', amountMmk: 1500 },
  { code: 'toll', name: 'Toll / bridge', amountMmk: 500 },
];

type Props = {
  items: DemandCatalogItem[];
  onChange: (items: DemandCatalogItem[]) => void;
  onSave: () => void | Promise<void>;
  busy?: string;
  saved?: string;
};

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export default function DemandCatalogPanel({ items, onChange, onSave, busy, saved }: Props) {
  const [draft, setDraft] = useState({ code: '', name: '', amountMmk: 500 });
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DemandCatalogItem | null>(null);
  const [error, setError] = useState('');

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amountMmk) || 0), 0),
    [items],
  );

  const addItem = () => {
    setError('');
    const name = draft.name.trim();
    const code = slugify(draft.code || name);
    if (!name || !code) {
      setError('Name is required');
      return;
    }
    if (items.some(item => item.code === code)) {
      setError(`Code "${code}" already exists`);
      return;
    }
    onChange([
      ...items,
      { code, name, amountMmk: Math.max(0, Math.round(Number(draft.amountMmk) || 0)) },
    ]);
    setDraft({ code: '', name: '', amountMmk: 500 });
  };

  const startEdit = (item: DemandCatalogItem) => {
    setEditingCode(item.code);
    setEditDraft({ ...item });
    setError('');
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editDraft || !editingCode) return;
    setError('');
    const name = editDraft.name.trim();
    const code = slugify(editDraft.code || name);
    if (!name || !code) {
      setError('Name and code are required');
      return;
    }
    if (items.some(item => item.code === code && item.code !== editingCode)) {
      setError(`Code "${code}" already exists`);
      return;
    }
    onChange(
      items.map(item =>
        item.code === editingCode
          ? { code, name, amountMmk: Math.max(0, Math.round(Number(editDraft.amountMmk) || 0)) }
          : item,
      ),
    );
    cancelEdit();
  };

  const removeItem = (code: string) => {
    if (!window.confirm('Remove this demand from the driver catalog?')) return;
    onChange(items.filter(item => item.code !== code));
    if (editingCode === code) cancelEdit();
  };

  return (
    <div className="owner-demand-panel">
      <div className="owner-demand-summary">
        <div>
          <strong>{items.length}</strong>
          <span>Demand types</span>
        </div>
        <div>
          <strong>{total.toLocaleString()} MMK</strong>
          <span>If all applied</span>
        </div>
      </div>

      <p className="owner-demand-hint">
        Drivers see this list on the meter. Each code can be added once per trip.
        Removing a charged demand on the trip leaves a WARNING on the receipt.
      </p>

      {error && <div className="owner-demand-error">{error}</div>}

      <div className="owner-demand-table-wrap">
        <table className="owner-demand-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th className="num">Amount (MMK)</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="owner-demand-empty">
                  No demand types yet. Add one below or restore defaults.
                </td>
              </tr>
            ) : (
              items.map(item => {
                const isEditing = editingCode === item.code && editDraft;
                return (
                  <tr key={item.code}>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            value={editDraft.code}
                            onChange={e => setEditDraft({ ...editDraft, code: e.target.value })}
                            aria-label="Demand code"
                          />
                        </td>
                        <td>
                          <input
                            value={editDraft.name}
                            onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                            aria-label="Demand name"
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={editDraft.amountMmk}
                            onChange={e =>
                              setEditDraft({
                                ...editDraft,
                                amountMmk: Number(e.target.value) || 0,
                              })
                            }
                            aria-label="Demand amount"
                          />
                        </td>
                        <td className="num">
                          <div className="owner-demand-actions">
                            <button type="button" className="owner-primary-btn" onClick={saveEdit}>
                              Update
                            </button>
                            <button type="button" className="owner-secondary-btn" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <code>{item.code}</code>
                        </td>
                        <td>{item.name}</td>
                        <td className="num">{item.amountMmk.toLocaleString()}</td>
                        <td className="num">
                          <div className="owner-demand-actions">
                            <button
                              type="button"
                              className="owner-secondary-btn"
                              onClick={() => startEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="owner-remove-btn"
                              onClick={() => removeItem(item.code)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="owner-demand-add">
        <h3>Add demand</h3>
        <div className="owner-demand-add-row">
          <label>
            Code
            <input
              placeholder="airport"
              value={draft.code}
              onChange={e => setDraft(d => ({ ...d, code: e.target.value }))}
            />
          </label>
          <label>
            Name
            <input
              placeholder="Airport"
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            />
          </label>
          <label>
            Amount (MMK)
            <input
              type="number"
              min={0}
              step={100}
              value={draft.amountMmk}
              onChange={e => setDraft(d => ({ ...d, amountMmk: Number(e.target.value) || 0 }))}
            />
          </label>
          <button type="button" className="owner-secondary-btn" onClick={addItem}>
            Add
          </button>
        </div>
      </div>

      <div className="owner-demand-footer">
        <button
          type="button"
          className="owner-secondary-btn"
          onClick={() => {
            if (!window.confirm('Replace catalog with default demand types?')) return;
            onChange(DEFAULT_DEMAND_CATALOG.map(item => ({ ...item })));
          }}
        >
          Restore defaults
        </button>
        <div className="owner-demand-footer-right">
          {busy && <span className="owner-save-ok">{busy}</span>}
          {saved && !busy && <span className="owner-save-ok">{saved}</span>}
          <button type="button" className="owner-primary-btn" onClick={() => void onSave()}>
            Save demand catalog
          </button>
        </div>
      </div>
    </div>
  );
}
