import React, { useState, useEffect } from 'react';
import { ShoppingListItem, SwiggyAccountConnection } from '../types';
import { store } from '../services/store';

interface SwiggyModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingListItem[];
  isHindi: boolean;
}

export const SwiggyModal: React.FC<SwiggyModalProps> = ({
  isOpen,
  onClose,
  items,
  isHindi,
}) => {
  const [activeTab, setActiveTab] = useState<'cart' | 'mcp' | 'connect' | 'setup'>('cart');
  const [connection, setConnection] = useState<SwiggyAccountConnection>(() => store.getSwiggyConnection());

  // Credentials State
  const [sessionTid, setSessionTid] = useState('');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [address, setAddress] = useState('Indiranagar, Bengaluru');
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // MCP Execution & Logs
  const [mcpExecuting, setMcpExecuting] = useState(false);
  const [mcpLogs, setMcpLogs] = useState<string[]>([]);
  const [mcpResult, setMcpResult] = useState<any | null>(null);
  const [browserScriptCopied, setBrowserScriptCopied] = useState(false);
  const [listCopied, setListCopied] = useState(false);

  // Load existing credentials / status on mount
  useEffect(() => {
    if (isOpen) {
      const current = store.getSwiggyConnection();
      setConnection(current);
      if (current.sessionToken) setSessionTid(current.sessionToken);
      if (current.lat) setLat(current.lat.toString());
      if (current.lng) setLng(current.lng.toString());
      if (current.deliveryAddress) setAddress(current.deliveryAddress);

      // Fetch live MCP tools and logs
      fetch('/api/mcp/logs')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.logs)) {
            setMcpLogs(data.logs.map((l: any) => `[${l.status.toUpperCase()}] ${l.message}`));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const totalAmount = items.reduce((sum, i) => sum + (i.swiggy_price || i.estimated_price || 40), 0);

  // Auto-detect GPS Coordinates
  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(4));
          setLng(pos.coords.longitude.toFixed(4));
          setAuthNotice({
            type: 'success',
            message: `📍 GPS detected: [${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}]`,
          });
        },
        () => {
          setAuthNotice({
            type: 'error',
            message: 'Could not access GPS. Using default city coordinates.',
          });
        }
      );
    }
  };

  // Connect Swiggy Account via MCP Tool: swiggy_connect
  const handleConnectMcp = async () => {
    if (!sessionTid.trim()) {
      setAuthNotice({ type: 'error', message: 'Please enter your _session_tid cookie from swiggy.com' });
      return;
    }

    setAuthLoading(true);
    setAuthNotice(null);

    try {
      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'swiggy_connect',
          arguments: {
            sessionTid: sessionTid.trim(),
            lat: Number(lat) || 12.9716,
            lng: Number(lng) || 77.5946,
            address: address.trim(),
          },
        }),
      });

      const data = await res.json();
      if (data.isError) {
        throw new Error(data.content?.[0]?.text || 'Connection failed');
      }

      const parsed = JSON.parse(data.content?.[0]?.text || '{}');
      const newConn: SwiggyAccountConnection = {
        isConnected: true,
        sessionToken: sessionTid.trim(),
        userName: parsed.credentials?.userName || 'Swiggy User',
        phoneNumber: parsed.credentials?.phoneNumber || '+91 Linked',
        deliveryAddress: address,
        lat: Number(lat),
        lng: Number(lng),
        storeName: 'Swiggy Instamart Dark Store (Connected)',
        connectedAt: new Date().toISOString(),
      };

      setConnection(newConn);
      store.saveSwiggyConnection(newConn);
      setAuthNotice({ type: 'success', message: '✅ Successfully connected your Swiggy account to MCP!' });
      setActiveTab('cart');
    } catch (e: any) {
      setAuthNotice({ type: 'error', message: e.message || 'Failed to connect' });
    } finally {
      setAuthLoading(false);
    }
  };

  // Execute MCP Tool: swiggy_add_to_cart
  const handleExecuteMcpAddToCart = async () => {
    setMcpExecuting(true);
    setMcpResult(null);
    setMcpLogs((prev) => [
      `[INFO] Starting Swiggy MCP Cart Pipeline with ${items.length} ingredients...`,
      ...prev,
    ]);

    try {
      const toolPayload = {
        name: 'swiggy_add_to_cart',
        arguments: {
          items: items.map((i) => ({
            name: i.name,
            quantity: i.qty_base,
            unit: i.base_unit,
          })),
        },
      };

      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolPayload),
      });

      const data = await res.json();
      if (data.isError) {
        throw new Error(data.content?.[0]?.text || 'MCP execution failed');
      }

      const parsedResult = JSON.parse(data.content?.[0]?.text || '{}');
      setMcpResult(parsedResult);

      // Mark items as in Swiggy cart in store
      store.markItemsInSwiggyCart(items.map((i) => i.id), parsedResult.cartId);

      setMcpLogs((prev) => [
        `[SUCCESS] Cart updated! Total: ₹${parsedResult.total} (Cart ID: ${parsedResult.cartId})`,
        ...prev,
      ]);
    } catch (err: any) {
      setMcpLogs((prev) => [`[ERROR] ${err.message}`, ...prev]);
      alert(`MCP Execution Notice: ${err.message}`);
    } finally {
      setMcpExecuting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/swiggy/disconnect', { method: 'POST' });
    } catch {}
    store.disconnectSwiggy();
    setConnection({ isConnected: false });
    setSessionTid('');
    setMcpResult(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[92vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FC8019] text-white flex items-center justify-center font-black text-[20px] shadow-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  Swiggy Instamart MCP Cart
                </h3>
                {connection.isConnected ? (
                  <span className="text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#C8E6C9]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse"></span>
                    MCP Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-full border border-[#FFE0B2]">
                    Connect Swiggy
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#424843]">
                {connection.isConnected
                  ? `Connected: ${connection.userName} • Instamart Pod: ${connection.deliveryAddress || 'Bengaluru'}`
                  : (isHindi ? 'स्विगी MCP कार्ट ऑटोमेशन' : 'Model Context Protocol (MCP) live cart pipeline')}
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-[#f4f4f0] p-1 text-[12px] font-bold">
          <button
            onClick={() => setActiveTab('cart')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cart'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">shopping_cart</span>
            <span>Items ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'connect'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">key</span>
            <span>{connection.isConnected ? 'Account' : 'Connect'}</span>
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'mcp'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">terminal</span>
            <span>MCP Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'setup'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">help</span>
            <span>Guide</span>
          </button>
        </div>

        {/* TAB 1: CART ITEMS & MCP EXECUTION */}
        {activeTab === 'cart' && (
          <div className="flex flex-col gap-3">
            {/* Status Alert */}
            {!connection.isConnected ? (
              <div className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#EA580C] text-[20px]">
                    link_off
                  </span>
                  <span className="text-[#9A3412] font-medium leading-snug">
                    Connect your Swiggy session cookie (_session_tid) so the MCP can push items directly to your live cart.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="py-1 px-3 rounded-xl bg-[#EA580C] text-white font-bold text-[11px] shrink-0 hover:bg-[#c2410c]"
                >
                  Connect
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#16A34A] text-[20px]">
                    verified
                  </span>
                  <div>
                    <span className="font-bold text-[#15803D] block">
                      Swiggy MCP Connected • {connection.userName}
                    </span>
                    <span className="text-[11px] text-[#4b5563]">
                      Location: {connection.deliveryAddress} [{connection.lat}, {connection.lng}]
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="text-[11px] font-bold text-[#16A34A] hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Items List */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-[#727972] uppercase tracking-wider">
                  Missing Ingredients to Add ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = items.map((i) => `• ${i.name}: ${i.qty_base} ${i.base_unit}`).join('\n');
                    navigator.clipboard?.writeText(text);
                    setListCopied(true);
                    setTimeout(() => setListCopied(false), 2000);
                  }}
                  className="text-[11px] font-bold text-[#FC8019] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>{listCopied ? 'Copied!' : 'Copy List'}</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#faf9f6] text-center text-[#727972] text-[12px]">
                    No shortfall items currently in shopping list.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between text-[13px]"
                    >
                      <div>
                        <span className="font-semibold text-[#1a1c1a] block">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#727972]">
                            {item.qty_base} {item.base_unit}
                          </span>
                          <a
                            href={`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(item.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10.5px] text-[#FC8019] hover:underline flex items-center gap-0.5"
                          >
                            <span>Search</span>
                            <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                          </a>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#1a1c1a] block">
                          ₹{item.swiggy_price || item.estimated_price || 40}
                        </span>
                        <span className="text-[10px] text-[#2E7D32] font-semibold">Instamart</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Total */}
            <div className="p-3 rounded-2xl bg-[#f4f4f0] border border-[#E6E4DD] flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-[#1a1c1a] block">Estimated Cart Total:</span>
                <span className="text-[11px] text-[#424843]">
                  {items.length} items • Fast Instamart delivery
                </span>
              </div>
              <span className="text-[20px] font-black text-[#FC8019]">₹{totalAmount}</span>
            </div>

            {/* MCP Cart Execution Result */}
            {mcpResult && (
              <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] flex flex-col gap-2.5 animate-fade-in text-[12px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#15803D] font-bold">
                    <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                    <span>MCP Added {mcpResult.itemCount} Items!</span>
                  </div>
                  <span className="font-mono text-[10.5px] text-[#166534] bg-white px-2 py-0.5 rounded border border-[#BBF7D0]">
                    {mcpResult.cartId}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11.5px] text-[#374151]">
                  <span>Subtotal: ₹{mcpResult.subtotal}</span>
                  <span>Handling: ₹{mcpResult.handlingFee}</span>
                  <span className="font-bold text-[#15803D]">Total: ₹{mcpResult.total}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <a
                    href={mcpResult.cartWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#16A34A] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#15803d]"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    <span>Open My Swiggy Cart</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (mcpResult.browserScript) {
                        navigator.clipboard?.writeText(mcpResult.browserScript);
                        setBrowserScriptCopied(true);
                        setTimeout(() => setBrowserScriptCopied(false), 2500);
                      }
                    }}
                    className="py-2 px-3 rounded-xl bg-white border border-[#86EFAC] text-[#15803D] font-bold text-[11px] flex items-center justify-center gap-1 hover:bg-[#dcfce7]"
                    title="Copy 1-Click In-Browser Injector Script"
                  >
                    <span className="material-symbols-outlined text-[15px]">code</span>
                    <span>{browserScriptCopied ? 'Script Copied!' : 'Copy Injector'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Execute Button */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={items.length === 0 || mcpExecuting}
                onClick={connection.isConnected ? handleExecuteMcpAddToCart : () => setActiveTab('connect')}
                className={`w-full py-3.5 px-4 rounded-2xl text-white text-[14px] font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all ${
                  items.length === 0 || mcpExecuting
                    ? 'bg-[#d1d5db] cursor-not-allowed text-[#6b7280]'
                    : connection.isConnected
                    ? 'bg-[#FC8019] hover:bg-[#e06d0c] shadow-[#FC8019]/25'
                    : 'bg-[#032212] hover:bg-[#143d25] shadow-black/15'
                }`}
              >
                {mcpExecuting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Executing Swiggy MCP Tool...</span>
                  </>
                ) : connection.isConnected ? (
                  <>
                    <span className="material-symbols-outlined text-[20px]">bolt</span>
                    <span>Let MCP Add Items to Swiggy Cart</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">link</span>
                    <span>Connect Swiggy Session First</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-[#727972] px-1">
                <span>Model Context Protocol (JSON-RPC 2.0)</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('mcp')}
                  className="text-[#FC8019] hover:underline flex items-center gap-0.5"
                >
                  <span>View MCP Console</span>
                  <span className="material-symbols-outlined text-[13px]">terminal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONNECT REAL SWIGGY CREDENTIALS */}
        {activeTab === 'connect' && (
          <div className="flex flex-col gap-3 text-[12px]">
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2.5">
              <span className="font-bold text-[#1a1c1a] text-[13px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FC8019] text-[18px]">key</span>
                Real Swiggy Instamart Session Connection
              </span>
              <p className="text-[#4b5563] text-[11.5px] leading-relaxed">
                Provide your active Swiggy session cookie. The backend MCP server uses this to authenticate directly against Swiggy's internal cart APIs.
              </p>

              {/* Session TID Cookie */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-[#1a1c1a] text-[11.5px]">
                  1. Swiggy Session Cookie (`_session_tid`) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Paste _session_tid cookie from swiggy.com..."
                  value={sessionTid}
                  onChange={(e) => setSessionTid(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#D1D5DB] text-[12px] font-mono outline-none focus:border-[#FC8019] focus:ring-1 focus:ring-[#FC8019]"
                />
                <span className="text-[10px] text-[#727972]">
                  Open swiggy.com &rarr; F12 (DevTools) &rarr; Application &rarr; Cookies &rarr; copy `_session_tid`.
                </span>
              </div>

              {/* Delivery Coordinates */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#1a1c1a] text-[11px]">Latitude</label>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      className="text-[10px] text-[#FC8019] font-bold hover:underline flex items-center gap-0.5"
                    >
                      <span>📍 GPS</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[11.5px] font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#1a1c1a] text-[11px]">Longitude</label>
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[11.5px] font-mono"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1 pt-1">
                <label className="font-bold text-[#1a1c1a] text-[11px]">Delivery Location Label</label>
                <input
                  type="text"
                  placeholder="e.g. Indiranagar, Bengaluru or Mumbai"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[11.5px]"
                />
              </div>

              {/* Feedback Notice */}
              {authNotice && (
                <div
                  className={`p-2.5 rounded-xl text-[11.5px] flex items-center gap-1.5 ${
                    authNotice.type === 'success'
                      ? 'bg-[#DCFCE7] text-[#166534]'
                      : 'bg-[#FEE2E2] text-[#B91C1C]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {authNotice.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <span>{authNotice.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={authLoading || !sessionTid.trim()}
                  onClick={handleConnectMcp}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FC8019] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 hover:bg-[#e06d0c] disabled:opacity-50"
                >
                  {authLoading ? 'Verifying with Swiggy API...' : 'Verify & Connect via MCP'}
                </button>
                {connection.isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2.5 px-3 rounded-xl bg-[#FEE2E2] text-[#B91C1C] font-bold text-[12px] hover:bg-[#fca5a5]"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE MCP LOGS & CONSOLE */}
        {activeTab === 'mcp' && (
          <div className="flex flex-col gap-2.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1a1c1a]">MCP Server Live Execution Logs</span>
              <button
                type="button"
                onClick={() => {
                  fetch('/api/mcp/logs')
                    .then((r) => r.json())
                    .then((data) => {
                      if (Array.isArray(data.logs)) {
                        setMcpLogs(data.logs.map((l: any) => `[${l.status.toUpperCase()}] ${l.message}`));
                      }
                    });
                }}
                className="text-[11px] text-[#FC8019] font-bold hover:underline"
              >
                Refresh Logs
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#0f172a] text-[#38bdf8] font-mono text-[11px] max-h-[220px] overflow-y-auto flex flex-col gap-1 border border-[#1e293b]">
              {mcpLogs.length === 0 ? (
                <div className="text-[#64748b]">No tool calls executed yet. Connect account and click 'Add Items to Cart'.</div>
              ) : (
                mcpLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('[SUCCESS]')
                        ? 'text-[#4ade80]'
                        : log.includes('[ERROR]')
                        ? 'text-[#f87171]'
                        : log.includes('[WARN]')
                        ? 'text-[#facc15]'
                        : 'text-[#38bdf8]'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] text-[11.5px] flex flex-col gap-1 text-[#4b5563]">
              <span className="font-bold text-[#1a1c1a]">Available MCP Tools:</span>
              <ul className="list-disc list-inside space-y-0.5">
                <li><code className="text-[#FC8019]">swiggy_connect</code>: Authenticates & verifies active session</li>
                <li><code className="text-[#FC8019]">swiggy_search_instamart</code>: Live catalog lookup for shortfalls</li>
                <li><code className="text-[#FC8019]">swiggy_add_to_cart</code>: Direct cart injection via Swiggy API</li>
                <li><code className="text-[#FC8019]">swiggy_generate_browser_script</code>: 1-click in-browser runner</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 4: SETUP GUIDE */}
        {activeTab === 'setup' && (
          <div className="flex flex-col gap-3 text-[12px]">
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2">
              <span className="font-bold text-[#1a1c1a] text-[13px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FC8019] text-[18px]">help</span>
                How to Get Your Real Swiggy Session Cookie
              </span>
              <ol className="list-decimal list-inside space-y-1.5 text-[#374151] text-[11.5px] pl-1 leading-relaxed">
                <li>Log in to your account at <strong>swiggy.com</strong> in your browser.</li>
                <li>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 font-mono text-[10px]">F12</kbd> (Inspect element).</li>
                <li>Click the <strong>Application</strong> tab (or <strong>Storage</strong> in Firefox).</li>
                <li>Expand <strong>Cookies</strong> &rarr; click <strong>https://www.swiggy.com</strong>.</li>
                <li>Find the cookie named <strong>`_session_tid`</strong>.</li>
                <li>Double click its value, copy it, and paste it into the <strong>Connect</strong> tab.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col gap-1.5 text-[11.5px] text-[#166534]">
              <span className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Direct In-Browser Cart Injector (WAF-Proof)
              </span>
              <p>
                If Swiggy blocks datacenter IPs with Cloudflare bot challenges, you can copy the generated <strong>1-Click Injector Script</strong> and paste it into the developer console of your open <em>swiggy.com</em> tab. It adds the exact items to your live cart using your current browser session immediately.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
