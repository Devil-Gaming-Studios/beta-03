import React, { useState, useEffect } from 'react';
import { RefreshCw, ShoppingBag, ShoppingCart, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { ShoppingListItem, SwiggyAccountConnection } from '../types';
import { store } from '../services/store';
import { SwiggyModal } from './SwiggyModal';

interface ShopTabProps {
  items: ShoppingListItem[];
  onRefresh: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ items, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [swiggyModalOpen, setSwiggyModalOpen] = useState(false);
  const [connection, setConnection] = useState<SwiggyAccountConnection>({ isConnected: false });

  // MCP Search & Product Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Cart Preview & Confirmation State
  const [cartPreview, setCartPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Check connection status from backend
  const refreshStatus = async () => {
    try {
      const res = await fetch('/api/swiggy/status');
      const data = await res.json();
      setConnection({
        isConnected: Boolean(data.isConnected),
        userProfile: data.userProfile,
        expiresAt: data.expiresAt,
        availableTools: data.availableTools || [],
      });
    } catch {
      setConnection({ isConnected: false });
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleGenerate = () => {
    setLoading(true);
    try {
      const generated = store.generateShoppingList();
      onRefresh();
      setFeedbackNotice({
        type: 'info',
        message: `Generated shopping list with ${generated.length} shortfall item(s) from current weekly plan!`,
      });
      setTimeout(() => setFeedbackNotice(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search Real Swiggy / Instamart Products via MCP
  const handleSearchMcp = async (customQuery?: string) => {
    const q = (customQuery || searchQuery || (items[0]?.name ?? '')).trim();
    if (!q) return;

    if (!connection.isConnected) {
      setSwiggyModalOpen(true);
      return;
    }

    setSearching(true);
    setFeedbackNotice(null);
    try {
      const res = await fetch('/api/swiggy/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search Swiggy MCP');

      const returnedItems = Array.isArray(data.items) ? data.items : [];
      setSearchResults(returnedItems);

      // Pre-select first 3 results
      const initialSelected = new Set<string>();
      returnedItems.slice(0, 3).forEach((it: any) => initialSelected.add(it.id));
      setSelectedProductIds(initialSelected);

      if (returnedItems.length === 0) {
        setFeedbackNotice({
          type: 'info',
          message: `Swiggy MCP catalog search returned 0 items for "${q}". Search capability depends on active account catalog access.`,
        });
      }
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Error querying Swiggy MCP search tool.',
      });
    } finally {
      setSearching(false);
    }
  };

  // Toggle selection
  const toggleProductSelect = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  // Request Cart Preview
  const handlePreparePreview = async () => {
    if (!connection.isConnected) {
      setSwiggyModalOpen(true);
      return;
    }

    // Use selected search results or fallback to current shopping list items
    const selectedList = searchResults.filter((p) => selectedProductIds.has(p.id));
    const itemsToPreview = selectedList.length > 0
      ? selectedList.map((p) => ({
          itemId: p.id,
          name: p.name,
          quantity: 1,
          price: p.price,
        }))
      : items.map((i) => ({
          itemId: i.id,
          name: i.name,
          quantity: Math.max(1, i.qty_base >= 1000 ? Math.round(i.qty_base / 1000) : 1),
          price: i.swiggy_price || i.estimated_price || 40,
        }));

    if (itemsToPreview.length === 0) return;

    setPreviewLoading(true);
    setFeedbackNotice(null);

    try {
      const res = await fetch('/api/swiggy/cart/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToPreview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to prepare cart preview');

      setCartPreview(data.preview);
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Failed to load Swiggy cart preview.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Explicit User Confirmation to Modify Swiggy Cart via Real MCP
  const handleConfirmCartAction = async () => {
    if (!cartPreview || !Array.isArray(cartPreview.items)) return;

    setConfirmLoading(true);
    setFeedbackNotice(null);

    try {
      const res = await fetch('/api/swiggy/cart/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          items: cartPreview.items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Cart operation rejected by Swiggy MCP server');
      }

      setFeedbackNotice({
        type: 'success',
        message: data.message || 'Cart successfully updated on Swiggy!',
      });
      setCartPreview(null);
      store.markItemsInSwiggyCart(items.map((i) => i.id));
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Swiggy MCP cart modification error.',
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <section id="tab-shop">
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Shopping list</span>
            <ShoppingBag size={14} style={{ color: 'var(--dim)' }} />
          </h2>

          {/* Connection status badge verified from backend */}
          {connection.isConnected ? (
            <button
              onClick={() => setSwiggyModalOpen(true)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#15803d',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={12} />
              Swiggy OAuth Connected
            </button>
          ) : (
            <button
              onClick={() => setSwiggyModalOpen(true)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '8px',
                background: 'rgba(249, 115, 22, 0.12)',
                color: '#c2410c',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Connect Swiggy
            </button>
          )}
        </div>

        {/* Feedback Notice */}
        {feedbackNotice && (
          <div
            style={{
              background:
                feedbackNotice.type === 'success'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : feedbackNotice.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
              border: `1px solid ${
                feedbackNotice.type === 'success'
                  ? 'rgba(34, 197, 94, 0.4)'
                  : feedbackNotice.type === 'error'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'rgba(59, 130, 246, 0.4)'
              }`,
              color: feedbackNotice.type === 'error' ? '#b91c1c' : '#15803d',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {feedbackNotice.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{feedbackNotice.message}</span>
          </div>
        )}

        {/* Shopping Items Table */}
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
                  <th>Ref Price</th>
                  <th>MCP Search</th>
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
                      ₹{i.swiggy_price || i.estimated_price || 40}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleSearchMcp(i.name)}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          background: 'rgba(249, 115, 22, 0.1)',
                          color: '#ea580c',
                          border: '1px solid rgba(249, 115, 22, 0.3)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Search size={10} />
                        Lookup
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Live Swiggy MCP Search Section */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Live Products Found via Swiggy MCP ({searchResults.length})
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--dim)' }}>Select items to include</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => toggleProductSelect(prod.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: selectedProductIds.has(prod.id) ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-card, #fbfbfa)',
                    border: `1px solid ${selectedProductIds.has(prod.id) ? '#ea580c' : 'var(--border)'}`,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(prod.id)}
                      onChange={() => toggleProductSelect(prod.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontWeight: 600, display: 'block' }}>{prod.name}</span>
                      <span style={{ fontSize: '10.5px', color: 'var(--dim)' }}>
                        {prod.quantityDescription || 'Standard Pack'} • {prod.storeName || 'Instamart'}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: '#ea580c' }}>₹{prod.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart Preview & Confirmation Box */}
        {cartPreview && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px',
              borderRadius: '12px',
              background: '#fffbf5',
              border: '1px solid #fed7aa',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: '6px' }}>
              Swiggy Cart Preview (MCP Tool: {cartPreview.mcpToolAvailable || 'Standard'})
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>₹{cartPreview.subtotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span>Delivery & Handling Fees:</span>
              <span>₹{cartPreview.estimatedDeliveryFee + cartPreview.estimatedHandlingFee}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px', borderTop: '1px solid #fed7aa', paddingTop: '4px', marginTop: '4px' }}>
              <span>Total Payable:</span>
              <span style={{ color: '#ea580c' }}>₹{cartPreview.total}</span>
            </div>

            <p style={{ fontSize: '11px', color: '#78350f', margin: '8px 0' }}>
              {cartPreview.notice}
            </p>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleConfirmCartAction}
                disabled={confirmLoading}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#ea580c',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {confirmLoading ? 'Confirming with Swiggy...' : 'Confirm & Add to Cart'}
              </button>
              <button
                type="button"
                onClick={() => setCartPreview(null)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#fff',
                  border: '1px solid #fed7aa',
                  color: '#78350f',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="row" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="act" id="gen-list" onClick={handleGenerate} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            Generate from plan
          </button>

          {items.length > 0 && !cartPreview && (
            <button
              className="ghost"
              onClick={handlePreparePreview}
              disabled={previewLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ShoppingCart size={13} style={{ color: '#f97316' }} />
              {previewLoading ? 'Loading Preview...' : 'Preview Swiggy Cart (MCP)'}
            </button>
          )}

          <button
            type="button"
            className="ghost"
            onClick={() => setSwiggyModalOpen(true)}
            style={{ fontSize: '12px', color: '#6b7280' }}
          >
            Swiggy OAuth Setup
          </button>
        </div>

        <div className="muted" style={{ marginTop: '12px', fontSize: '11.5px', lineHeight: '1.4' }}>
          Official Swiggy OAuth 2.1 & MCP integration. Items are added to the cart for your explicit review and confirmation; payments and orders are never placed automatically.
        </div>
      </div>

      <SwiggyModal
        isOpen={swiggyModalOpen}
        onClose={() => {
          setSwiggyModalOpen(false);
          refreshStatus();
        }}
        items={items}
        isHindi={false}
      />
    </section>
  );
};
