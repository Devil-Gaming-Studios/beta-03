import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { ShoppingListItem } from '../types';
import { SwiggyModal } from './SwiggyModal';

interface ShopScreenProps {
  isHindi: boolean;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({ isHindi }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'shared' | 'personal'>('all');
  const [isSwiggyModalOpen, setIsSwiggyModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    refreshList();
  }, []);

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

      {/* Quick Commerce Cart Bar */}
      {filteredItems.length > 0 && (
        <section className="bg-gradient-to-r from-[#FC8019]/15 to-[#FC8019]/5 border border-[#FC8019]/30 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FC8019] animate-pulse"></span>
              <span className="text-[13px] font-bold text-[#1a1c1a]">Quick Commerce Ready</span>
            </div>
            <p className="text-[11.5px] text-[#424843] mt-0.5">
              Est. Total: <strong>₹{totalAmount(filteredItems)}</strong> • Best prices matched
            </p>
          </div>

          <button
            className="py-2 px-3.5 rounded-xl bg-[#FC8019] text-white text-[12px] font-bold shadow-sm active:scale-95 transition-all flex items-center gap-1.5 hover:bg-[#e06d0c]"
            onClick={() => setIsSwiggyModalOpen(true)}
          >
            <span>Swiggy Cart</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </section>
      )}

      {/* Price Comparison Table Matrix (Spec 2.8) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#1a1c1a]">
            Price Comparison Matrix
          </h2>
          <span className="text-[11px] text-[#727972]">
            As of: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
