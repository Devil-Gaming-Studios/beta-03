import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { ShoppingListItem } from '../types';
import { SwiggyModal } from './SwiggyModal';
import { ShopInboxConfirmCard } from './ShopInboxConfirmCard';

interface ShopScreenProps {
  isHindi: boolean;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({ isHindi }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'shared' | 'personal'>('all');
  const [isSwiggyModalOpen, setIsSwiggyModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [swiggyConnection, setSwiggyConnection] = useState<any>(() => store.getSwiggyConnection());
  const [swiggyConnecting, setSwiggyConnecting] = useState(false);

  // Sync Swiggy connection status from backend and check URL redirect params
  const checkSwiggyStatus = async () => {
    try {
      const res = await fetch('/api/swiggy/status');
      const data = await res.json();
      if (data.isConnected) {
        const updated = {
          isConnected: true,
          expiresAt: data.expiresAt,
          scope: data.scope,
          userProfile: data.userProfile,
          availableTools: data.availableTools || [],
          lastCheckedAt: new Date().toISOString(),
        };
        setSwiggyConnection(updated);
        store.saveSwiggyConnection(updated);
      } else {
        const disconnected = { isConnected: false, availableTools: [] };
        setSwiggyConnection(disconnected);
        store.saveSwiggyConnection(disconnected);
      }
    } catch (e) {
      console.warn('Failed to fetch Swiggy status:', e);
    }
  };

  useEffect(() => {
    refreshList();
    checkSwiggyStatus();

    // Handle return from Swiggy OAuth redirect (?swiggy=connected or ?swiggy_error=...)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('swiggy') === 'connected') {
        setNotice('🎉 Swiggy Connected! Official Swiggy account successfully linked via Phone + OTP.');
        window.history.replaceState({}, document.title, window.location.pathname);
        checkSwiggyStatus();
        setTimeout(() => setNotice(null), 6000);
      } else if (params.get('swiggy_error')) {
        setNotice(`⚠️ Swiggy connection failed: ${params.get('swiggy_error')}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => setNotice(null), 6000);
      }
    }

    // Listen for postMessage from popup OAuth callback
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SWIGGY_AUTH_SUCCESS') {
        setSwiggyConnecting(false);
        setNotice('🎉 Swiggy Connected! Official Swiggy account successfully linked.');
        checkSwiggyStatus();
        setTimeout(() => setNotice(null), 5000);
      } else if (event.data?.type === 'SWIGGY_AUTH_ERROR') {
        setSwiggyConnecting(false);
        setNotice(`⚠️ Swiggy authorization error: ${event.data.error || 'Failed'}`);
        setTimeout(() => setNotice(null), 5000);
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Official Swiggy OAuth 2.1 + PKCE Connect Flow
  const handleConnectSwiggy = async () => {
    setSwiggyConnecting(true);
    try {
      // Localhost development callback whitelisted by Swiggy without production approval
      const callbackUri = encodeURIComponent('http://localhost:3000/api/swiggy/callback');
      const res = await fetch(`/api/swiggy/connect?redirect_uri=${callbackUri}`);
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error || 'Failed to start Swiggy connection');
      }

      // Try popup first; fallback to direct redirect if popup blocked
      const width = 520;
      const height = 680;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.authorizationUrl,
        'swiggy_oauth_window',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Redirect browser to Swiggy's official authentication page
        window.location.href = data.authorizationUrl;
        return;
      }

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setSwiggyConnecting(false);
          checkSwiggyStatus();
        }
      }, 1000);
    } catch (err: any) {
      setNotice(err.message || 'Error connecting to Swiggy');
      setSwiggyConnecting(false);
    }
  };

  const handleDisconnectSwiggy = async () => {
    try {
      await fetch('/api/swiggy/disconnect', { method: 'POST' });
      setSwiggyConnection({ isConnected: false, availableTools: [] });
      store.saveSwiggyConnection({ isConnected: false, availableTools: [] });
      setNotice('Swiggy account disconnected.');
      setTimeout(() => setNotice(null), 3000);
    } catch (e: any) {
      setNotice(e?.message || 'Failed to disconnect');
    }
  };

  const refreshList = () => {
    const current = store.getShoppingList();
    setItems([...current]);
  };

  const handleGenerate = () => {
    setLoading(true);
    try {
      const generated = store.generateShoppingList();
      setItems([...generated]);
      setNotice(
        generated.length === 0
          ? 'All planned meal ingredients are in stock! Zero missing items.'
          : `Computed ${generated.length} shortfall item(s) from weekly meal plan!`
      );
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleBoughtAllRequired = () => {
    const res = store.restockAllMissingItems();
    setItems([...res.shoppingList]);
    setNotice(
      `Restocked ${res.appliedItems.length} item(s) into Kitchen Stock! Missing items cleared.`
    );
    setTimeout(() => setNotice(null), 4000);
  };

  const handleMarkItemBought = (item: ShoppingListItem) => {
    const res = store.updateShoppingListFromChat(item.name, 'bought', item.qty_base, item.base_unit);
    setItems([...res.shoppingList]);
    setNotice(
      `Added ${item.qty_base} ${item.base_unit} ${item.name} to Kitchen Stock and removed from Shop tab!`
    );
    setTimeout(() => setNotice(null), 3500);
  };

  const handleRemoveShopItem = (item: ShoppingListItem) => {
    const res = store.updateShoppingListFromChat(item.name, 'remove');
    setItems([...res.shoppingList]);
    setNotice(`Removed "${item.name}" from Shopping List.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'personal') return Boolean(item.owner_user_id);
    if (activeTab === 'shared') return !item.owner_user_id;
    return true;
  });

  const totalEstimated = filteredItems.reduce(
    (sum, i) => sum + (i.blinkit_price || i.estimated_price || 40),
    0
  );

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Toast Notice */}
      {notice && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <section className="pt-2 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
              {isHindi ? 'खरीदारी सूची' : 'Shopping List & Deals'}
            </h1>
            <p className="text-[12px] text-[#424843]">
              {isHindi ? 'प्लान की कमी से स्वचालित सूची और मूल्य तुलना' : 'Auto-computed from meal plan shortfalls'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                className="px-3 py-2 rounded-full bg-[#EDF2EE] border border-[#137333]/30 text-[#137333] text-[12px] font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all hover:bg-[#d8e6db]"
                onClick={handleBoughtAllRequired}
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">task_alt</span>
                <span>{isHindi ? 'सारा खरीद लिया' : 'Bought All Required'}</span>
              </button>
            )}
            <button
              className="px-3.5 py-2 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all hover:bg-[#132a1d]"
              onClick={handleGenerate}
              disabled={loading}
              type="button"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{isHindi ? 'अपडेट करें' : 'Compute Plan'}</span>
            </button>
          </div>
        </div>

        {/* 2-Scope Tabs: Shared vs Personal */}
        <div className="flex rounded-2xl bg-[#f4f4f0] p-1 border border-[#E6E4DD]">
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All Items ({items.length})
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              activeTab === 'shared'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setActiveTab('shared')}
          >
            👥 Shared Kitchen
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              activeTab === 'personal'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setActiveTab('personal')}
          >
            👤 Personal
          </button>
        </div>
      </section>

      {/* WhatsApp & Telegram Shop Chat Inbox (Confirm & Apply to Stock) */}
      <section>
        <ShopInboxConfirmCard isHindi={isHindi} onItemsApplied={refreshList} />
      </section>

      {/* Swiggy Official Connection & Cart Integration */}
      <section className="bg-white border border-[#E6E4DD] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FC8019] text-white flex items-center justify-center font-black text-[20px] shadow-sm shrink-0">
              S
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold text-[#1a1c1a]">
                  Swiggy Instamart & MCP
                </h2>
                {swiggyConnection.isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold border border-[#C8E6C9] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>Swiggy Connected</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] text-[11px] font-bold border border-[#FFE0B2] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]"></span>
                    <span>Not Connected</span>
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#424843] mt-0.5">
                {swiggyConnection.isConnected
                  ? `Authenticated as ${swiggyConnection.userProfile?.name || 'Swiggy User'} • ${swiggyConnection.availableTools?.length || 0} MCP tools active`
                  : 'Official Swiggy OAuth 2.1 + PKCE connection using your registered phone number & OTP'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!swiggyConnection.isConnected ? (
              <button
                type="button"
                onClick={handleConnectSwiggy}
                disabled={swiggyConnecting}
                className="py-2.5 px-4 rounded-xl bg-[#FC8019] text-white text-[13px] font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2 hover:bg-[#e06d0c] disabled:opacity-60"
              >
                {swiggyConnecting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">login</span>
                    <span>Connect Swiggy</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsSwiggyModalOpen(true)}
                  className="py-2 px-3.5 rounded-xl bg-[#FC8019] text-white text-[12px] font-bold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 hover:bg-[#e06d0c]"
                >
                  <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                  <span>Swiggy Cart</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectSwiggy}
                  className="py-2 px-2.5 rounded-xl bg-[#FEE2E2] text-[#B91C1C] text-[12px] font-semibold hover:bg-[#fca5a5] transition-all"
                  title="Disconnect Swiggy account"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {/* 6-Step Visual Flow Guide when Disconnected */}
        {!swiggyConnection.isConnected && (
          <div className="bg-[#FAF9F6] border border-[#E6E4DD] rounded-xl p-3 text-[11.5px] text-[#424843] flex flex-col gap-2">
            <div className="font-bold text-[#1a1c1a] flex items-center justify-between">
              <span>Official Connection Flow:</span>
              <button
                type="button"
                onClick={() => setIsSwiggyModalOpen(true)}
                className="text-[#FC8019] hover:underline font-semibold"
              >
                More Details & MCP Tools &rarr;
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#FC8019] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Click <strong>Connect Swiggy</strong></span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#FC8019] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Enter registered phone number</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#FC8019] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Verify OTP sent by Swiggy</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#FC8019] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>Authorize KitchenSync</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#FC8019] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">5</span>
                <span>Automatic return redirect</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">6</span>
                <span className="text-[#15803D] font-bold">Swiggy Connected!</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Quick-Commerce Benchmark Price Comparison (Spec 2.8) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#1a1c1a]">
            Estimated Quick-Commerce Price Benchmarks
          </h2>
          <span className="text-[11px] text-[#727972]">
            Regional estimates • Live scrapers disabled pending partner approval
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-[#E6E4DD] text-[#424843]">
            <span className="material-symbols-outlined text-[32px] text-[#137333]">check_circle</span>
            <p className="text-[14px] font-semibold mt-2">No missing ingredients!</p>
            <p className="text-[12px] text-[#727972] mt-0.5">Your kitchen stock covers all planned meals.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const swiggyPrice = item.swiggy_price || (item.estimated_price || 35) + 4;
            const blinkitPrice = item.blinkit_price || item.estimated_price || 35;
            const zeptoPrice = item.zepto_price || (item.estimated_price || 35) + 2;

            const lowestPrice = Math.min(swiggyPrice, blinkitPrice, zeptoPrice);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-3.5 border border-[#E6E4DD] shadow-xs flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[14px] font-bold text-[#1a1c1a] block">{item.name}</span>
                    <span className="text-[11.5px] text-[#424843]">
                      Need: <strong>{item.qty_base} {item.base_unit}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {item.in_swiggy_cart && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] text-[10.5px] font-bold border border-[#FFE0B2] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]"></span>
                        In Swiggy Cart
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[10.5px] font-bold border border-[#D1E2D7]">
                      Cheapest: {item.best_store || 'Blinkit'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkItemBought(item)}
                      className="px-2.5 py-1 rounded-lg bg-[#1A3826] text-white text-[11px] font-bold flex items-center gap-1 hover:bg-[#132a1d] active:scale-95 transition-all"
                      title="Mark as bought (adds to Kitchen Stock and removes from Shop)"
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      <span>Bought</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveShopItem(item)}
                      className="p-1 rounded-lg bg-[#f4f4f0] text-[#727972] hover:text-[#9E2A2B] hover:bg-[#fdf2f2] transition-all"
                      title="Remove from Shop list"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* 3-Store Pricing Comparison Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div
                    className={`p-2 rounded-xl border text-center transition-all ${
                      blinkitPrice === lowestPrice
                        ? 'bg-[#FEF9C3] border-[#FACC15]'
                        : 'bg-[#faf9f6] border-[#E6E4DD]'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#727972] uppercase block">Blinkit</span>
                    <span className="text-[14px] font-bold text-[#1a1c1a]">₹{blinkitPrice}</span>
                    {blinkitPrice === lowestPrice && (
                      <span className="block text-[9.5px] font-bold text-[#854D0E]">BEST VALUE</span>
                    )}
                  </div>

                  <div
                    className={`p-2 rounded-xl border text-center transition-all ${
                      zeptoPrice === lowestPrice
                        ? 'bg-[#FEF9C3] border-[#FACC15]'
                        : 'bg-[#faf9f6] border-[#E6E4DD]'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#727972] uppercase block">Zepto</span>
                    <span className="text-[14px] font-bold text-[#1a1c1a]">₹{zeptoPrice}</span>
                    {zeptoPrice === lowestPrice && (
                      <span className="block text-[9.5px] font-bold text-[#854D0E]">BEST VALUE</span>
                    )}
                  </div>

                  <div
                    className={`p-2 rounded-xl border text-center transition-all ${
                      swiggyPrice === lowestPrice
                        ? 'bg-[#FEF9C3] border-[#FACC15]'
                        : 'bg-[#faf9f6] border-[#E6E4DD]'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#FC8019] uppercase block">Instamart</span>
                    <span className="text-[14px] font-bold text-[#1a1c1a]">₹{swiggyPrice}</span>
                    {swiggyPrice === lowestPrice && (
                      <span className="block text-[9.5px] font-bold text-[#854D0E]">BEST VALUE</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Swiggy Instamart Modal */}
      <SwiggyModal
        isOpen={isSwiggyModalOpen}
        onClose={() => setIsSwiggyModalOpen(false)}
        items={filteredItems}
        isHindi={isHindi}
      />
    </div>
  );
};

function totalAmount(items: ShoppingListItem[]) {
  return items.reduce((sum, i) => sum + (i.swiggy_price || i.estimated_price || 35), 0);
}
