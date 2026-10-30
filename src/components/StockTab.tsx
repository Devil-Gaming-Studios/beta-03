import React, { useState } from 'react';
import { Package, Sliders, Warehouse } from 'lucide-react';
import { Ingredient, StockItem, StockOp } from '../types';
import { store } from '../services/store';

interface StockTabProps {
  stock: StockItem[];
  ingredients: Ingredient[];
  onRefresh: () => void;
}

export const StockTab: React.FC<StockTabProps> = ({ stock, ingredients, onRefresh }) => {
  const [selectedIngId, setSelectedIngId] = useState(ingredients[0]?.id || '');
  const [op, setOp] = useState<StockOp>('add');
  const [qty, setQty] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [filterLocation, setFilterLocation] = useState<'all' | 'pantry' | 'fridge'>('all');

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngId || qty <= 0) return;
    setLoading(true);
    try {
      store.adjustStock(selectedIngId, op, Number(qty));
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = stock.filter((s) => {
    if (filterLocation === 'all') return true;
    return s.location === filterLocation;
  });

  return (
    <section id="tab-stock">
      <div className="card">
        <h2>
          <span>Stock ({stock.length} items)</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className={`pill ${filterLocation === 'all' ? 'ok' : ''}`}
              style={{ fontSize: '10px', padding: '2px 8px' }}
              onClick={() => setFilterLocation('all')}
            >
              All
            </button>
            <button
              className={`pill ${filterLocation === 'pantry' ? 'ok' : ''}`}
              style={{ fontSize: '10px', padding: '2px 8px' }}
              onClick={() => setFilterLocation('pantry')}
            >
              Pantry
            </button>
            <button
              className={`pill ${filterLocation === 'fridge' ? 'ok' : ''}`}
              style={{ fontSize: '10px', padding: '2px 8px' }}
              onClick={() => setFilterLocation('fridge')}
            >
              Fridge
            </button>
          </div>
        </h2>

        <ul className="stock" id="stock">
          {filteredStock.length === 0 ? (
            <li className="muted" style={{ gridColumn: 'span 2' }}>
              No items in this storage area.
            </li>
          ) : (
            filteredStock.map((s) => (
              <li key={s.id}>
                <span>
                  {s.name}
                  {s.location === 'fridge' ? (
                    <span style={{ fontSize: '10px', color: '#60a5fa', marginLeft: '4px' }}>❄️</span>
                  ) : null}
                </span>
                <span className="q">
                  {Math.round(s.qty_base)} {s.unit_base}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="card">
        <h2>
          <span>Adjust an item</span>
          <Sliders size={14} style={{ color: 'var(--dim)' }} />
        </h2>
        <form onSubmit={handleAdjust}>
          <div className="row">
            <select
              id="adj-ing"
              value={selectedIngId}
              onChange={(e) => setSelectedIngId(e.target.value)}
              style={{ flex: '1 1 180px' }}
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name_en} ({i.name_hi}) [{i.base_unit}]
                </option>
              ))}
            </select>

            <select
              id="adj-op"
              value={op}
              onChange={(e) => setOp(e.target.value as StockOp)}
              style={{ width: '105px' }}
            >
              <option value="add">add</option>
              <option value="remove">remove</option>
              <option value="set">set</option>
            </select>

            <input
              id="adj-qty"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              style={{ width: '90px' }}
            />
          </div>

          <div className="row" style={{ marginTop: '10px' }}>
            <button className="act" type="submit" id="adjust" disabled={loading}>
              Apply
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
