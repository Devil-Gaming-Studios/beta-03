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
  const [activeTab, setActiveTab] = useState<'cart' | 'connect' | 'setup'>('cart');
  const [connection, setConnection] = useState<SwiggyAccountConnection>(() => store.getSwiggyConnection());

  // Phone OTP Flow State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [userName, setUserName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('Indiranagar 100ft Road, Stage 2, Bengaluru - 560038');
  const [otpRequested, setOtpRequested] = useState(false);
  const [suggestedOtp, setSuggestedOtp] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Direct Token State
  const [directToken, setDirectToken] = useState('');

  // Cart Addition State
  const [cartAdding, setCartAdding] = useState(false);
  const [cartProgressText, setCartProgressText] = useState('');
  const [cartResult, setCartResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync connection on modal open
  useEffect(() => {
    if (isOpen) {
      const current = store.getSwiggyConnection();
      setConnection(current);
      // Fetch server status in background
      fetch('/api/swiggy/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.isConnected && data.session) {
            const merged: SwiggyAccountConnection = {
              isConnected: true,
              ...data.session,
            };
            setConnection(merged);
            store.saveSwiggyConnection(merged);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const totalAmount = items.reduce((sum, i) => sum + (i.swiggy_price || i.estimated_price || 40), 0);

  // --- Handlers ---
  const handleRequestOtp = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/swiggy/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setOtpRequested(true);
      if (data.testOtp) {
        setSuggestedOtp(data.testOtp);
      }
    } catch (e: any) {
      setAuthError(e.message || 'Error requesting OTP');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/swiggy/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          otp,
          userName: userName || undefined,
          deliveryAddress: deliveryAddress || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify OTP');

      const newConn: SwiggyAccountConnection = {
        isConnected: true,
        ...data.profile,
      };
      setConnection(newConn);
      store.saveSwiggyConnection(newConn);
      setActiveTab('cart');
      setOtpRequested(false);
      setOtp('');
    } catch (e: any) {
      setAuthError(e.message || 'Verification failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnectToken = async () => {
    if (!directToken.trim()) {
      setAuthError('Please enter a session token or cookie.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/swiggy/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: directToken,
          userName: userName || 'Swiggy Member',
          deliveryAddress: deliveryAddress || 'Bangalore Instamart Hub',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect token');

      const newConn: SwiggyAccountConnection = {
        isConnected: true,
        ...data.profile,
      };
      setConnection(newConn);
      store.saveSwiggyConnection(newConn);
      setActiveTab('cart');
      setDirectToken('');
    } catch (e: any) {
      setAuthError(e.message || 'Token connection failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/swiggy/disconnect', { method: 'POST' });
    } catch {}
    store.disconnectSwiggy();
    setConnection({ isConnected: false });
    setCartResult(null);
  };

  const handleAddToCart = async () => {
    setCartAdding(true);
    setCartProgressText('1/3 Matching shortfalls with Instamart catalog...');
    setCartResult(null);

    try {
      setTimeout(() => {
        setCartProgressText('2/3 Checking local dark-store inventory...');
      }, 700);

      setTimeout(() => {
        setCartProgressText('3/3 Reserving cart items in your connected Swiggy session...');
      }, 1400);

      const res = await fetch('/api/swiggy/add-to-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            qty_base: i.qty_base,
            base_unit: i.base_unit,
            estimated_price: i.swiggy_price || i.estimated_price,
          })),
          session: connection,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add items to cart');

      // Mark items as in cart in local store
      store.markItemsInSwiggyCart(items.map((i) => i.id), data.cartId);
      setCartResult(data);
    } catch (e: any) {
      alert(`Cart Sync Notice: ${e.message || 'Could not reach Swiggy server'}`);
    } finally {
      setCartAdding(false);
      setCartProgressText('');
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
                  Swiggy Instamart Cart Sync
                </h3>
                {connection.isConnected ? (
                  <span className="text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#C8E6C9]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse"></span>
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-full border border-[#FFE0B2]">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#424843]">
                {connection.isConnected
                  ? `${connection.userName || 'Swiggy User'} • ${connection.phoneNumber || 'Linked'}`
                  : (isHindi ? 'अपना स्विगी अकाउंट कनेक्ट करें और सीधे कार्ट में जोड़ें' : 'Connect Swiggy account to push items to your cart')}
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

        {/* Tab Switcher */}
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
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'connect'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">link</span>
            <span>{connection.isConnected ? 'Account Profile' : 'Connect Swiggy'}</span>
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'setup'
                ? 'bg-white text-[#FC8019] shadow-xs'
                : 'text-[#727972] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            <span>API & Tokens</span>
          </button>
        </div>

        {/* TAB 1: CART & SHORTFALL ITEMS */}
        {activeTab === 'cart' && (
          <div className="flex flex-col gap-3">
            {/* Account Status Card */}
            {connection.isConnected ? (
              <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[#16A34A] text-[20px]">
                    check_circle
                  </span>
                  <div>
                    <span className="font-bold text-[#15803D] block">
                      Linked: {connection.userName} ({connection.phoneNumber})
                    </span>
                    <span className="text-[11px] text-[#4b5563] block">
                      Pod: {connection.storeName || 'Instamart Express Hub'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="text-[11px] font-bold text-[#16A34A] hover:underline"
                >
                  Manage
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#EA580C] text-[18px]">
                    link_off
                  </span>
                  <span className="text-[#9A3412] leading-snug">
                    Connect your Swiggy account to enable 1-tap cart synchronization.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connect')}
                  className="py-1 px-2.5 rounded-lg bg-[#EA580C] text-white font-bold text-[11px] shrink-0 hover:bg-[#c2410c]"
                >
                  Connect Now
                </button>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-[#727972] uppercase tracking-wider">
                  Missing Kitchen Ingredients ({items.length})
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

              <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#faf9f6] text-center text-[#727972] text-[12px]">
                    No shortfall items in current shopping list.
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex items-center justify-between text-[13px]"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#1a1c1a]">{item.name}</span>
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
                            <span>Search variant</span>
                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
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

            {/* Cart Total Breakdown */}
            <div className="p-3 rounded-2xl bg-[#f4f4f0] border border-[#E6E4DD] flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-[#1a1c1a] block">Cart Subtotal:</span>
                <span className="text-[11px] text-[#424843]">
                  {items.length} items • Delivery & dark-store matching
                </span>
              </div>
              <span className="text-[20px] font-black text-[#FC8019]">₹{totalAmount}</span>
            </div>

            {/* Success Cart Banner if added */}
            {cartResult && (
              <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] flex flex-col gap-2 animate-fade-in text-[12px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#15803D] font-bold">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Items Added to Swiggy Cart! 🎉</span>
                  </div>
                  <span className="text-[10.5px] font-mono text-[#166534] bg-white px-2 py-0.5 rounded-md border border-[#BBF7D0]">
                    {cartResult.cartId}
                  </span>
                </div>
                <p className="text-[#374151] text-[11.5px] leading-relaxed">
                  Items have been mapped to <strong>{cartResult.storeName}</strong>. Total estimated amount is <strong>₹{cartResult.total}</strong>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={cartResult.cartWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-[#16A34A] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#15803d]"
                  >
                    <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                    <span>Open My Swiggy Cart</span>
                  </a>
                  <a
                    href={cartResult.cartAppUrl}
                    className="py-2 px-3 rounded-xl bg-white border border-[#86EFAC] text-[#15803D] font-bold text-[12px] flex items-center justify-center gap-1.5 hover:bg-[#dcfce7]"
                    title="Deep link for Swiggy App on mobile"
                  >
                    <span className="material-symbols-outlined text-[16px]">smartphone</span>
                    <span>App</span>
                  </a>
                </div>
              </div>
            )}

            {/* Main Action Button */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={items.length === 0 || cartAdding}
                onClick={connection.isConnected ? handleAddToCart : () => setActiveTab('connect')}
                className={`w-full py-3 px-4 rounded-2xl text-white text-[14px] font-bold shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all ${
                  items.length === 0 || cartAdding
                    ? 'bg-[#d1d5db] cursor-not-allowed text-[#6b7280]'
                    : connection.isConnected
                    ? 'bg-[#FC8019] hover:bg-[#e06d0c] shadow-[#FC8019]/25'
                    : 'bg-[#032212] hover:bg-[#143d25] shadow-black/15'
                }`}
              >
                {cartAdding ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span className="text-[13px]">{cartProgressText}</span>
                  </>
                ) : connection.isConnected ? (
                  <>
                    <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                    <span>
                      {isHindi ? 'स्विगी कार्ट में जोड़ें' : 'Add All to Swiggy Instamart Cart'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">link</span>
                    <span>Connect Swiggy Account First</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] text-[#727972] px-1">
                <span>Direct dark-store stock reservation</span>
                <a
                  href="https://www.swiggy.com/instamart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FC8019] hover:underline flex items-center gap-0.5"
                >
                  <span>Open swiggy.com</span>
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONNECT ACCOUNT PROFILE */}
        {activeTab === 'connect' && (
          <div className="flex flex-col gap-3">
            {connection.isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#1a1c1a]">Active Swiggy Session</span>
                    <span className="text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full border border-[#C8E6C9]">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px] pt-1">
                    <div>
                      <span className="text-[10.5px] text-[#727972] block">Account Name</span>
                      <span className="font-semibold text-[#1a1c1a]">{connection.userName}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] text-[#727972] block">Phone</span>
                      <span className="font-semibold text-[#1a1c1a]">{connection.phoneNumber}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10.5px] text-[#727972] block">Delivery Location</span>
                      <span className="font-medium text-[#1a1c1a]">{connection.deliveryAddress}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10.5px] text-[#727972] block">Mapped Dark Store</span>
                      <span className="font-medium text-[#FC8019]">{connection.storeName}</span>
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
                    onClick={handleDisconnect}
                    className="py-2.5 px-4 rounded-xl bg-[#FEE2E2] text-[#B91C1C] font-bold text-[13px] hover:bg-[#fca5a5]"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Method Switch: Phone OTP vs Session Token */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-bold text-[#1a1c1a]">
                    1. Connect with Indian Mobile Number (+91)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex rounded-xl border border-[#D1D5DB] overflow-hidden bg-white focus-within:border-[#FC8019] focus-within:ring-1 focus-within:ring-[#FC8019]">
                      <span className="px-3 py-2 bg-[#f4f4f0] text-[13px] font-bold text-[#4b5563] border-r border-[#D1D5DB] flex items-center">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Enter 10-digit number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 px-3 py-2 text-[13px] text-[#1a1c1a] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={authLoading || phoneNumber.length !== 10}
                      onClick={handleRequestOtp}
                      className={`px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all ${
                        phoneNumber.length === 10
                          ? 'bg-[#FC8019] hover:bg-[#e06d0c]'
                          : 'bg-[#d1d5db] cursor-not-allowed text-[#6b7280]'
                      }`}
                    >
                      {otpRequested ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {/* OTP Input Section */}
                {otpRequested && (
                  <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-bold text-[#1a1c1a]">
                        Enter 6-Digit OTP
                      </label>
                      {suggestedOtp && (
                        <button
                          type="button"
                          onClick={() => setOtp(suggestedOtp)}
                          className="text-[11px] font-bold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md hover:bg-[#bbf7d0]"
                        >
                          Use Code: {suggestedOtp}
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.trim())}
                        className="flex-1 px-3 py-2 rounded-xl border border-[#D1D5DB] text-[14px] font-bold tracking-widest text-[#1a1c1a] text-center outline-none focus:border-[#FC8019]"
                      />
                      <button
                        type="button"
                        disabled={authLoading || otp.length < 4}
                        onClick={handleVerifyOtp}
                        className="px-5 py-2 rounded-xl bg-[#15803D] text-white font-bold text-[12px] hover:bg-[#166534] disabled:opacity-50"
                      >
                        {authLoading ? 'Verifying...' : 'Verify & Connect'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Your Name (Optional)"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Delivery Address / City"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {authError && (
                  <div className="p-2.5 rounded-xl bg-[#FEE2E2] text-[#B91C1C] text-[11.5px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{authError}</span>
                  </div>
                )}

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#E5E7EB]"></div>
                  <span className="flex-shrink mx-2 text-[#9CA3AF] text-[11px] font-medium">OR CONNECT WITH TOKEN</span>
                  <div className="flex-grow border-t border-[#E5E7EB]"></div>
                </div>

                {/* Option 2: Direct Token/Cookie */}
                <div className="flex flex-col gap-2">
                  <label className="text-[12px] font-bold text-[#1a1c1a]">
                    2. Swiggy Session Cookie (`_session_tid` or `tid`)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste _session_tid cookie value..."
                      value={directToken}
                      onChange={(e) => setDirectToken(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#D1D5DB] text-[12px] outline-none focus:border-[#FC8019]"
                    />
                    <button
                      type="button"
                      disabled={authLoading || !directToken.trim()}
                      onClick={handleConnectToken}
                      className="px-4 py-2 rounded-xl bg-[#032212] text-white font-bold text-[12px] hover:bg-[#143d25] disabled:opacity-50"
                    >
                      Connect
                    </button>
                  </div>
                  <span className="text-[10.5px] text-[#727972]">
                    Find this cookie in Chrome DevTools under swiggy.com. See 'API & Tokens' tab for guide.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: API & TOKEN SETUP GUIDE */}
        {activeTab === 'setup' && (
          <div className="flex flex-col gap-3 text-[12px]">
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2">
              <span className="font-bold text-[#1a1c1a] text-[13px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FC8019] text-[18px]">key</span>
                How to Get Your Swiggy Session Token
              </span>
              <p className="text-[#4b5563] text-[11.5px] leading-relaxed">
                Swiggy does not currently offer a public developer OAuth portal for third-party consumer apps. You can authenticate seamlessly using either the phone number login on the <strong>Connect Swiggy</strong> tab, or by copying your existing active session cookie:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[#374151] text-[11.5px] pl-1">
                <li>Log in to your account at <strong>swiggy.com</strong> in your desktop browser.</li>
                <li>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 font-mono text-[10px]">F12</kbd> (or right click and select <em>Inspect</em>).</li>
                <li>Navigate to the <strong>Application</strong> tab (or <strong>Storage</strong> in Firefox).</li>
                <li>In the left sidebar, expand <strong>Cookies</strong> &rarr; click <strong>https://www.swiggy.com</strong>.</li>
                <li>Find the cookie named <strong>`_session_tid`</strong> or <strong>`tid`</strong>.</li>
                <li>Copy its value and paste it into the <em>Connect with Token</em> field.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2">
              <span className="font-bold text-[#1a1c1a] text-[13px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#032212] text-[18px]">dns</span>
                Swiggy MCP (Model Context Protocol) Setup
              </span>
              <p className="text-[#4b5563] text-[11.5px] leading-relaxed">
                If you run a local or cloud Swiggy MCP server to execute real automated cart additions and inventory checks:
              </p>
              <div className="p-2.5 rounded-xl bg-[#1e293b] text-[#f8fafc] font-mono text-[11px] overflow-x-auto">
                <div>SWIGGY_MCP_URL=http://localhost:8080/swiggy</div>
                <div>SWIGGY_MCP_TOKEN=your_mcp_api_token</div>
              </div>
              <p className="text-[#727972] text-[11px]">
                When configured in your environment, the app automatically delegates cart updates to the MCP endpoint.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
