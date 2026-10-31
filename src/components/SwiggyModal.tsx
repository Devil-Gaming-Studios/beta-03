import React, { useState, useEffect, useCallback } from 'react';
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
  const [activeTab, setActiveTab] = useState<'cart' | 'oauth' | 'tools'>('cart');
  const [connection, setConnection] = useState<SwiggyAccountConnection>(() => store.getSwiggyConnection());
  const [statusLoading, setStatusLoading] = useState(false);
  const [authConnecting, setAuthConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Manual callback submission state
  const [manualCodeOrUrl, setManualCodeOrUrl] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // On-demand first tool call state
  const [testingToolCall, setTestingToolCall] = useState(false);
  const [testToolMessage, setTestToolMessage] = useState<string | null>(null);

  // Cart Preview & Confirmation State
  const [cartPreview, setCartPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Poll or check status from backend
  const checkStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/swiggy/status');
      const data = await res.json();
      if (data.isConnected) {
        const updated: SwiggyAccountConnection = {
          isConnected: true,
          expiresAt: data.expiresAt,
          scope: data.scope,
          userProfile: data.userProfile,
          availableTools: data.availableTools || [],
          firstToolCallResult: data.firstToolCallResult || null,
          lastCheckedAt: new Date().toISOString(),
        };
        setConnection(updated);
        store.saveSwiggyConnection(updated);
      } else {
        const disconnected: SwiggyAccountConnection = {
          isConnected: false,
          availableTools: [],
          firstToolCallResult: null,
        };
        setConnection(disconnected);
        store.saveSwiggyConnection(disconnected);
        if (data.expired) {
          setAuthError('Your Swiggy session has expired. Please reconnect with your phone number.');
        }
      }
    } catch (e: any) {
      console.warn('Failed to verify Swiggy connection status:', e);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setConfirmSuccess(null);
      setAuthError(null);
      setManualSuccessMsg(null);
      setTestToolMessage(null);
    }
  }, [isOpen, checkStatus]);

  // Listen for OAuth postMessage from callback window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SWIGGY_AUTH_SUCCESS') {
        setAuthConnecting(false);
        setAuthError(null);
        checkStatus();
        setActiveTab('oauth');
      } else if (event.data?.type === 'SWIGGY_AUTH_ERROR') {
        setAuthConnecting(false);
        setAuthError(event.data.error || 'Swiggy authorization failed or was cancelled.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [checkStatus]);

  // Start Real Swiggy OAuth 2.1 + PKCE Flow
  // Swiggy strictly enforces redirect URI allowlisting. Localhost is permitted for developer local testing.
  const handleStartOAuth = async () => {
    setAuthConnecting(true);
    setAuthError(null);
    try {
      // Always use localhost development callback URL to avoid "Run isn't whitelisted" rejection
      const localhostRedirectUri = encodeURIComponent('http://localhost:3000/api/swiggy/callback');
      const res = await fetch(`/api/swiggy/connect?redirect_uri=${localhostRedirectUri}`);
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error || 'Couldn’t start Swiggy sign-in');
      }

      // Open official Swiggy phone + OTP authorization page in a secure popup
      const width = 520;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authorizationUrl,
        'swiggy_oauth_window',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = data.authorizationUrl;
        return;
      }

      // Watch for popup closure
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setAuthConnecting(false);
          checkStatus();
        }
      }, 1000);
    } catch (err: any) {
      setAuthConnecting(false);
      setAuthError(err.message || 'Error initializing Swiggy connection');
    }
  };

  // Submit manual redirect code or URL (handles environments where port 3000 callback cannot auto-close)
  const handleManualCodeSubmit = async () => {
    if (!manualCodeOrUrl.trim()) return;
    setManualSubmitting(true);
    setAuthError(null);
    setManualSuccessMsg(null);

    try {
      const res = await fetch('/api/swiggy/callback/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: manualCodeOrUrl.trim(), code: manualCodeOrUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Couldn’t finish Swiggy sign-in');
      }

      setManualSuccessMsg(data.message || 'Swiggy connected securely!');
      setManualCodeOrUrl('');
      await checkStatus();
      setActiveTab('oauth');
    } catch (err: any) {
      setAuthError(err.message || 'Couldn’t verify the Swiggy code');
    } finally {
      setManualSubmitting(false);
    }
  };

  // Run Milestone 4 Tool Call on Demand
  const handleTestFirstToolCall = async () => {
    setTestingToolCall(true);
    setTestToolMessage(null);
    try {
      const res = await fetch('/api/swiggy/test-tool-call', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to call get_addresses');
      }
      setTestToolMessage(`Milestone 1 Verified: ${data.result?.summary || 'get_addresses executed successfully.'}`);
      await checkStatus();
    } catch (err: any) {
      setAuthError(err.message || 'Tool call get_addresses failed');
    } finally {
      setTestingToolCall(false);
    }
  };

  // Disconnect Swiggy Account
  const handleDisconnect = async () => {
    try {
      await fetch('/api/swiggy/disconnect', { method: 'POST' });
    } catch {}
    store.disconnectSwiggy();
    setConnection({ isConnected: false });
    setCartPreview(null);
    setConfirmSuccess(null);
    checkStatus();
  };

  // Fetch Cart Preview from MCP Client
  const handleLoadPreview = async () => {
    if (items.length === 0) return;
    setPreviewLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/swiggy/cart/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            itemId: i.id,
            name: i.name,
            quantity: Math.max(1, i.qty_base >= 1000 ? Math.round(i.qty_base / 1000) : 1),
            price: i.swiggy_price || i.estimated_price || 40,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to prepare cart preview');
      setCartPreview(data.preview);
    } catch (err: any) {
      setAuthError(err.message || 'Couldn’t load your Swiggy cart preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Explicit User Confirmation to Modify Swiggy Cart via Real MCP
  const handleConfirmCart = async () => {
    if (!cartPreview || !Array.isArray(cartPreview.items)) return;
    setConfirmLoading(true);
    setAuthError(null);

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
        throw new Error(data.error || 'Swiggy couldn’t update your cart');
      }

      setConfirmSuccess(data.message || 'Items successfully added to your Swiggy cart!');
      store.markItemsInSwiggyCart(items.map((i) => i.id));
    } catch (err: any) {
      setAuthError(err.message || 'Couldn’t update your Swiggy cart.');
    } finally {
      setConfirmLoading(false);
    }
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
                  Swiggy Instamart • Official MCP Client
                </h3>
                {connection.isConnected ? (
                  <span className="text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#C8E6C9]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse"></span>
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-full border border-[#FFE0B2]">
                    Not Linked
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#424843]">
                {connection.isConnected
                  ? `Signed in with Phone + OTP (${connection.userProfile?.name || 'Swiggy Member'})`
                  : (isHindi ? 'आधिकारिक फोन + OTP ऑथेंटिकेशन (RFC 7591 DCR)' : 'Secure Phone + OTP sign-in')}
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
            <span>Items & Cart ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('oauth')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'oauth'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">verified_user</span>
            <span>{connection.isConnected ? 'Account & Milestone' : 'Connect Swiggy'}</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tools'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">hub</span>
            <span>MCP Tools ({connection.availableTools?.length || 0})</span>
          </button>
        </div>

        {/* Error Notice Banner */}
        {authError && (
          <div className="p-3 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-[12px] flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#B91C1C] shrink-0 mt-0.5">
              error
            </span>
            <div className="leading-snug">
              <strong>Notice:</strong> {authError}
            </div>
          </div>
        )}

        {/* Success Notice Banner */}
        {manualSuccessMsg && (
          <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D] text-[12px] flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#16A34A] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="leading-snug">{manualSuccessMsg}</div>
          </div>
        )}

        {/* TAB 1: CART WORKFLOW WITH EXPLICIT CONFIRMATION */}
        {activeTab === 'cart' && (
          <div className="flex flex-col gap-3">
            {!connection.isConnected ? (
              <div className="p-3.5 rounded-2xl bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#EA580C] text-[20px]">
                    phonelink_lock
                  </span>
                  <span className="text-[#9A3412] font-medium leading-snug">
                    Connect your Swiggy account to enable live Instamart MCP sync.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('oauth')}
                  className="py-1.5 px-3 rounded-xl bg-[#FC8019] text-white font-bold text-[11px] shrink-0 hover:bg-[#e06d0c]"
                >
                  Connect
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#16A34A] text-[18px]">
                    check_circle
                  </span>
                  <div>
                    <span className="font-bold text-[#15803D] block">
                      Swiggy MCP Connected • Tokens Encrypted at Rest
                    </span>
                    <span className="text-[11px] text-[#4b5563]">
                      Session auto-refreshed via rotation (valid until {connection.expiresAt ? new Date(connection.expiresAt).toLocaleDateString() : '5 days'})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={checkStatus}
                  disabled={statusLoading}
                  className="text-[11px] font-bold text-[#16A34A] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">sync</span>
                  <span>{statusLoading ? 'Checking...' : 'Refresh'}</span>
                </button>
              </div>
            )}

            {/* Missing Ingredients List */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-[#727972] uppercase tracking-wider">
                  Missing Recipe Ingredients ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = items.map((i) => `• ${i.name}: ${i.qty_base} ${i.base_unit}`).join('\n');
                    navigator.clipboard?.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[11px] font-bold text-[#FC8019] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>{copied ? 'Copied!' : 'Copy List'}</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#faf9f6] text-center text-[#727972] text-[12px]">
                    No missing shortfall ingredients found in the current plan.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between text-[13px]"
                    >
                      <div>
                        <span className="font-semibold text-[#1a1c1a] block">{item.name}</span>
                        <span className="text-[11px] text-[#727972]">
                          Need: {item.qty_base} {item.base_unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#1a1c1a] block">
                          ₹{item.swiggy_price || item.estimated_price || 40}
                        </span>
                        <span className="text-[10px] text-[#2E7D32] font-semibold">Swiggy</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cart Preview Details if Loaded */}
            {cartPreview && (
              <div className="p-3.5 rounded-2xl bg-[#FFFBF5] border border-[#FED7AA] flex flex-col gap-2 animate-fade-in text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#9A3412] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    Verified Cart Preview
                  </span>
                  <span className="text-[11px] text-[#B45309] font-medium">
                    {cartPreview.supportedByMcp ? 'Available' : 'Guarded'}
                  </span>
                </div>

                <div className="space-y-1 text-[#374151] text-[11.5px] border-t border-[#FED7AA] pt-1.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹{cartPreview.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Handling Fee:</span>
                    <span>₹{cartPreview.estimatedHandlingFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Delivery Fee:</span>
                    <span>₹{cartPreview.estimatedDeliveryFee}</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-bold text-[#1a1c1a] border-t border-[#FED7AA] pt-1 mt-1">
                    <span>Total Amount:</span>
                    <span className="text-[#FC8019]">₹{cartPreview.total}</span>
                  </div>
                </div>

                <p className="text-[10.5px] text-[#78350F] leading-tight">
                  {cartPreview.notice}
                </p>

                {/* Explicit Confirmation Action */}
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={confirmLoading}
                    onClick={handleConfirmCart}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#FC8019] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 hover:bg-[#e06d0c] disabled:opacity-50"
                  >
                    {confirmLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Confirming with Swiggy...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Confirm & Add to Swiggy Cart</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartPreview(null)}
                    className="px-3 py-2.5 rounded-xl border border-[#FED7AA] text-[#9A3412] text-[12px] font-semibold hover:bg-[#ffedd5]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Success Notification */}
            {confirmSuccess && (
              <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] text-[#15803D] text-[12px] flex flex-col gap-2 animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{confirmSuccess}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <a
                    href="https://www.swiggy.com/instamart/cart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-[#16A34A] text-white font-bold text-[11.5px] flex items-center justify-center gap-1.5 hover:bg-[#15803d]"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                    <span>Review & Checkout on Swiggy</span>
                  </a>
                </div>
              </div>
            )}

            {/* Main Action Trigger */}
            {!cartPreview && (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={items.length === 0 || previewLoading}
                  onClick={connection.isConnected ? handleLoadPreview : () => setActiveTab('oauth')}
                  className={`w-full py-3.5 px-4 rounded-2xl text-white text-[14px] font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all ${
                    items.length === 0 || previewLoading
                      ? 'bg-[#d1d5db] cursor-not-allowed text-[#6b7280]'
                      : connection.isConnected
                      ? 'bg-[#FC8019] hover:bg-[#e06d0c] shadow-[#FC8019]/25'
                      : 'bg-[#032212] hover:bg-[#143d25] shadow-black/15'
                  }`}
                >
                  {previewLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Checking with Swiggy...</span>
                    </>
                  ) : connection.isConnected ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                      <span>Preview Swiggy Cart</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">link</span>
                      <span>Connect Swiggy Account First</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-[11px] text-[#727972] px-1">
                  <span>Never places orders or initiates payment automatically</span>
                  <a
                    href="https://www.swiggy.com/instamart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FC8019] hover:underline flex items-center gap-0.5"
                  >
                    <span>Swiggy Web</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OFFICIAL OAUTH 2.1 + PKCE AUTHENTICATION & MILESTONE 1 */}
        {activeTab === 'oauth' && (
          <div className="flex flex-col gap-3 text-[12px]">
            {connection.isConnected ? (
              <div className="flex flex-col gap-3">
                {/* Milestone 4: First Tool Call Status Card */}
                <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-[#15803D] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px]">task_alt</span>
                      Milestone 1: First MCP Tool Call (<code>get_addresses</code>)
                    </span>
                    <span className="text-[10px] font-bold bg-[#DCFCE7] text-[#166534] px-2 py-0.5 rounded-full border border-[#86EFAC]">
                      {connection.firstToolCallResult?.success ? 'Verified' : 'Ready'}
                    </span>
                  </div>

                  <p className="text-[11.5px] text-[#166534] leading-relaxed">
                    {connection.firstToolCallResult?.summary ||
                      'Swiggy is connected.'}
                  </p>

                  {testToolMessage && (
                    <div className="p-2 rounded-xl bg-white border border-[#86EFAC] text-[#15803D] text-[11px] font-medium">
                      {testToolMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10.5px] text-[#4b5563]">
                      Called at: {connection.firstToolCallResult?.calledAt ? new Date(connection.firstToolCallResult.calledAt).toLocaleTimeString() : 'On connection'}
                    </span>
                    <button
                      type="button"
                      disabled={testingToolCall}
                      onClick={handleTestFirstToolCall}
                      className="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-[11px] font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1"
                    >
                      {testingToolCall ? (
                        <>
                          <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Calling...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                          <span>Re-test get_addresses</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Details */}
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#1a1c1a]">Swiggy is Connected</span>
                    <span className="text-[10.5px] font-bold bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-0.5 rounded-full border border-[#C8E6C9]">
                      OAuth 2.1 Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <span className="text-[10.5px] text-[#727972] block">Account Profile</span>
                      <span className="font-semibold text-[#1a1c1a]">
                        {connection.userProfile?.name || 'Swiggy User'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10.5px] text-[#727972] block">Access Scope</span>
                      <span className="font-mono text-[11px] text-[#4B5563]">
                        {connection.scope || 'mcp:tools mcp:resources'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10.5px] text-[#727972] block">Your Security</span>
                      <span className="text-[11.5px] text-[#15803D] font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Encrypted at rest with AES-256-GCM on backend
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10.5px] text-[#727972] block">Expires At</span>
                      <span className="text-[11.5px] text-[#374151]">
                        {connection.expiresAt ? new Date(connection.expiresAt).toLocaleString() : '5 days'} (Auto-refreshed via rotation)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('cart')}
                    className="flex-1 py-2.5 rounded-xl bg-[#FC8019] text-white font-bold text-[13px] hover:bg-[#e06d0c]"
                  >
                    Go to Cart
                  </button>
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    disabled={authConnecting}
                    className="py-2.5 px-3 rounded-xl border border-[#D1D5DB] text-[#374151] font-bold text-[12px] hover:bg-[#f3f4f6]"
                  >
                    {authConnecting ? 'Reconnecting...' : 'Reconnect'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="py-2.5 px-3 rounded-xl bg-[#FEE2E2] text-[#B91C1C] font-bold text-[12px] hover:bg-[#fca5a5]"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FC8019] text-[22px]">
                      security
                    </span>
                    <span className="text-[13px] font-bold text-[#1a1c1a]">
                      Official Swiggy OAuth 2.1 + PKCE
                    </span>
                  </div>

                  <p className="text-[#4B5563] text-[11.5px] leading-relaxed">
                    Localhost development requires no prior production approval. Clients register dynamically with Swiggy:
                  </p>

                  <div className="space-y-2 text-[#374151] text-[11.5px] pl-1">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#FC8019]/10 text-[#FC8019] font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                      <span><strong>Dynamic Registration:</strong> KitchenSync securely registers with Swiggy.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#FC8019]/10 text-[#FC8019] font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                      <span><strong>Localhost Whitelist:</strong> Swiggy authorizes <code>http://localhost:3000/api/swiggy/callback</code> without cloud platform errors.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#FC8019]/10 text-[#FC8019] font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                      <span><strong>Phone + OTP:</strong> Enter your phone number and OTP on Swiggy's official portal.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-bold flex items-center justify-center shrink-0 text-[11px]">4</span>
                      <span><strong>Milestone 1 Tool Call:</strong> Once authorized, KitchenSync calls <code>get_addresses</code> to verify the live connection.</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] text-[11px] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">verified</span>
                    <span>
                      <strong>Return Address:</strong> <code>http://localhost:3000/api/swiggy/callback</code> (Whitelisted for Local Dev).
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] text-[11px] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">lock</span>
                    <span>
                      <strong>Zero Credential Exposure:</strong> KitchenSync never collects, sees, or logs your OTP or password.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={authConnecting}
                  onClick={handleStartOAuth}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#FC8019] text-white font-bold text-[14px] shadow-md shadow-[#FC8019]/25 flex items-center justify-center gap-2 hover:bg-[#e06d0c] disabled:opacity-50"
                >
                  {authConnecting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Opening Swiggy Official Portal...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">login</span>
                      <span>Connect Swiggy (Phone Number + OTP)</span>
                    </>
                  )}
                </button>

                {/* Manual Callback Entry / Developer Helper */}
                <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2 mt-1">
                  <div className="flex items-center justify-between text-[11.5px] font-bold text-[#1a1c1a]">
                    <span>Enter Code Manually</span>
                    <span className="text-[10px] text-[#727972] font-normal">Dev Helper</span>
                  </div>
                  <p className="text-[10.5px] text-[#6b7280]">
                    If your browser completed Phone + OTP and redirected to <code>http://localhost:3000/api/swiggy/callback?code=...</code> in an external tab, paste either the URL or code here:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste http://localhost:3000/... or code"
                      value={manualCodeOrUrl}
                      onChange={(e) => setManualCodeOrUrl(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#D1D5DB] text-[11.5px] bg-white text-[#1a1c1a] focus:outline-none focus:border-[#FC8019]"
                    />
                    <button
                      type="button"
                      disabled={manualSubmitting || !manualCodeOrUrl.trim()}
                      onClick={handleManualCodeSubmit}
                      className="px-3 py-2 rounded-xl bg-[#032212] text-white font-bold text-[11px] hover:bg-[#1a3826] disabled:opacity-50 shrink-0"
                    >
                      {manualSubmitting ? 'Exchanging...' : 'Submit Code'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DISCOVERED MCP TOOLS */}
        {activeTab === 'tools' && (
          <div className="flex flex-col gap-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1a1c1a]">Swiggy Features Available</span>
              <button
                type="button"
                onClick={checkStatus}
                className="text-[11px] text-[#FC8019] font-bold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">sync</span>
                <span>Refresh Tools</span>
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#0f172a] text-[#f8fafc] font-mono text-[11px] max-h-[220px] overflow-y-auto flex flex-col gap-2 border border-[#1e293b]">
              {!connection.isConnected ? (
                <div className="text-[#64748b]">
                  Connect your Swiggy account to discover live tools from https://mcp.swiggy.com/im and https://mcp.swiggy.com/food using the official @modelcontextprotocol/sdk.
                </div>
              ) : connection.availableTools && connection.availableTools.length > 0 ? (
                connection.availableTools.map((tool, idx) => (
                  <div key={idx} className="border-b border-[#334155] pb-1.5 last:border-none">
                    <span className="text-[#38bdf8] font-bold">{tool.name}</span>
                    <p className="text-[#94a3b8] text-[10px] mt-0.5">{tool.description}</p>
                  </div>
                ))
              ) : (
                <div className="text-[#cbd5e1] leading-relaxed">
                  Connected to Swiggy OAuth. Awaiting MCP toolset provisioning for this user account.
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] text-[11px] text-[#4b5563] space-y-1">
              <span className="font-bold text-[#1a1c1a] block text-[11.5px]">Swiggy Services:</span>
              <div>&bull; Swiggy Food: <code className="text-[#FC8019]">https://mcp.swiggy.com/food</code></div>
              <div>&bull; Instamart: <code className="text-[#FC8019]">https://mcp.swiggy.com/im</code></div>
              <div>&bull; Sign-in Service: <code className="text-[#FC8019]">https://mcp.swiggy.com/auth</code></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
