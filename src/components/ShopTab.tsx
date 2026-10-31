import React, { useState } from 'react';
import { ExternalLink, RefreshCw, ShoppingBag, ShoppingCart } from 'lucide-react';
import { ShoppingListItem } from '../types';
import { store } from '../services/store';

interface ShopTabProps {
  items: ShoppingListItem[];
  onRefresh: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ items, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [swiggyMessage, setSwiggyMessage] = useState<string | null>(null);

  const handleGenerate = () => {
    setLoading(true);
    try {
      const generated = store.generateShoppingList();
      onRefresh();
      setSwiggyMessage(`Generated shopping list with ${generated.length} shortfall item(s) from current weekly plan!`);
      setTimeout(() => setSwiggyMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMockSwiggyHandoff = () => {
    setSwiggyMessage('Swiggy Instamart cart handoff simulated: items exported to quick commerce review card.');
    setTimeout(() => setSwiggyMessage(null), 5000);
  };

  return (
    <section id="tab-shop">
      <div className="card">
        <h2>
          <span>Shopping list</span>
          <ShoppingBag size={14} style={{ color: 'var(--dim)' }} />
        </h2>

        {swiggyMessage && (
          <div
            style={{
              background: 'rgba(74, 222, 128, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.4)',
              color: 'var(--accent)',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '12.5px',
              marginBottom: '10px',
            }}
          >
            {swiggyMessage}
          </div>
        )}

        <div id="shop">
          {items.length === 0 ? (
            <div className="muted" style={{ padding: '6px 0' }}>
              No list yet. Click "Generate from plan" to compute missing ingredients for scheduled meals.
            </div>
          ) : (
            <table className="items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Buy</th>
                  <th>Best Price</th>
                  <th>Platform</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 550 }}>{i.name}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {Math.round(i.qty_base)} {i.base_unit}
                    </td>
                    <td style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{i.estimated_price || 40}
                    </td>
                    <td>
                      <span className="tag" style={{ fontSize: '10px' }}>
                        {i.best_store || 'Instamart'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="row" style={{ marginTop: '12px' }}>
          <button className="act" id="gen-list" onClick={handleGenerate} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            Generate from plan
          </button>

          {items.length > 0 && (
            <button className="ghost" onClick={handleMockSwiggyHandoff}>
              <ShoppingCart size={13} style={{ color: '#f97316' }} />
              Add to Swiggy Cart
            </button>
          )}
        </div>

        <div className="muted" style={{ marginTop: '12px', fontSize: '11.5px', lineHeight: '1.4' }}>
          Swiggy cart handoff is not wired: MCP client approval is pending. (Per spec: items are placed into the cart for user review; orders are never auto-placed).
        </div>
      </div>
    </section>
  );
};
