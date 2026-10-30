import React, { useState } from 'react';
import { store } from '../services/store';

interface StockScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
}

export const StockScreen: React.FC<StockScreenProps> = ({ isHindi, onOpenVoice }) => {
  const [activeTab, setActiveTab] = useState<'mine' | 'shared' | 'all'>('all');
  const [activeCategory, setActiveCategory] = useState<'all' | 'expiring' | 'pantry' | 'fridge' | 'spices'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockItems, setStockItems] = useState([
    {
      id: 'item_1',
      name_en: 'Chakki Fresh Atta',
      name_hi: 'आशीर्वाद गेहूं आटा • 100% Whole Wheat',
      category: 'pantry',
      owner: 'shared',
      ownerLabel: 'Rohan (Shared 304)',
      quantity: 4.5,
      unit: 'kg',
      desiMeasure: '~90 रोटियां',
      freshness: 'Fresh • 45 days left',
      stepUnit: '500 g',
      stepDesi: 'आधा किलो',
      stepAmount: 0.5,
      isExpiring: false,
      isVeg: true,
    },
    {
      id: 'item_2',
      name_en: 'Toor Dal (Unpolished)',
      name_hi: 'अरहर दाल • Organic Toor',
      category: 'pantry',
      owner: 'shared',
      ownerLabel: 'Divyansh (Shared 304)',
      quantity: 1.2,
      unit: 'kg',
      desiMeasure: '~12 कटोरी दाल',
      freshness: 'Fresh • 60 days left',
      stepUnit: '250 g',
      stepDesi: 'पाव भर',
      stepAmount: 0.25,
      isExpiring: false,
      isVeg: true,
    },
    {
      id: 'item_3',
      name_en: 'Fresh Dahi / Curd',
      name_hi: 'अमूल ताज़ा दही • Set Curd',
      category: 'fridge',
      owner: 'mine',
      ownerLabel: 'Divyansh (Personal)',
      quantity: 400,
      unit: 'ml',
      desiMeasure: '2 दिन का नाश्ता',
      freshness: 'Expires Tomorrow',
      stepUnit: '200 ml',
      stepDesi: '1 कप',
      stepAmount: 200,
      isExpiring: true,
      isVeg: true,
    },
    {
      id: 'item_4',
      name_en: 'Fresh Paneer Block',
      name_hi: 'ताज़ा मलाई पनीर',
      category: 'fridge',
      owner: 'mine',
      ownerLabel: 'Divyansh (Personal)',
      quantity: 200,
      unit: 'g',
      desiMeasure: '2 लोगों की भुर्जी',
      freshness: 'Expires in 2 days',
      stepUnit: '100 g',
      stepDesi: '100 ग्राम',
      stepAmount: 100,
      isExpiring: true,
      isVeg: true,
    },
    {
      id: 'item_5',
      name_en: 'Pahari Aloo / Potatoes',
      name_hi: 'आलू • Medium Size',
      category: 'pantry',
      owner: 'shared',
      ownerLabel: 'Shared 304',
      quantity: 2.5,
      unit: 'kg',
      desiMeasure: '~18 आलू',
      freshness: 'Good • 20 days left',
      stepUnit: '500 g',
      stepDesi: 'आधा किलो',
      stepAmount: 0.5,
      isExpiring: false,
      isVeg: true,
    },
    {
      id: 'item_6',
      name_en: 'Kacchi Ghani Mustard Oil',
      name_hi: 'सरसों का तेल • Cold Pressed',
      category: 'pantry',
      owner: 'shared',
      ownerLabel: 'Shared 304',
      quantity: 850,
      unit: 'ml',
      desiMeasure: 'लगभग 1 बोतल',
      freshness: 'Fresh • 90 days left',
      stepUnit: '100 ml',
      stepDesi: '100 मि.ली.',
      stepAmount: 100,
      isExpiring: false,
      isVeg: true,
    },
    {
      id: 'item_7',
      name_en: 'Jeera / Cumin Seeds',
      name_hi: 'खड़ा जीरा • तड़का स्पेशल',
      category: 'spices',
      owner: 'shared',
      ownerLabel: 'Shared 304',
      quantity: 150,
      unit: 'g',
      desiMeasure: 'मसाला दानी फुल',
      freshness: 'Fresh • 180 days',
      stepUnit: '50 g',
      stepDesi: '50 ग्राम',
      stepAmount: 50,
      isExpiring: false,
      isVeg: true,
    },
  ]);

  const handleAdjust = (id: string, delta: number) => {
    setStockItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, Math.round((item.quantity + delta) * 100) / 100);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleToggleOwnership = (id: string) => {
    setStockItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newOwner = item.owner === 'mine' ? 'shared' : 'mine';
          return {
            ...item,
            owner: newOwner,
            ownerLabel: newOwner === 'mine' ? 'Divyansh (Personal)' : 'Shared 304',
          };
        }
        return item;
      })
    );
  };

  const filteredItems = stockItems.filter((item) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        item.name_en.toLowerCase().includes(q) || item.name_hi.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // 2. Tab Filter
    if (activeTab === 'mine' && item.owner !== 'mine') return false;
    if (activeTab === 'shared' && item.owner !== 'shared') return false;

    // 3. Category Filter
    if (activeCategory === 'expiring' && !item.isExpiring) return false;
    if (activeCategory === 'pantry' && item.category !== 'pantry') return false;
    if (activeCategory === 'fridge' && item.category !== 'fridge') return false;
    if (activeCategory === 'spices' && item.category !== 'spices') return false;

    return true;
  });

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto gap-y-2">
      {/* Top Active Synced Micro Bar */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eeeeea] border border-[#E6E4DD] text-[#424843] text-[12px] font-medium">
          <span className="w-2 h-2 rounded-full bg-[#1A3826]"></span>
          <span className="text-[#1a1c1a] font-semibold">Flat 304 Pantry</span>
          <span className="text-[#727972] text-[11px]">•</span>
          <span className="text-[#3b684a] font-bold">4 Active Members</span>
        </div>
        <div className="flex items-center gap-1 bg-[#EDF2EE] border border-[#E6E4DD] px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#137333]">
          <span className="material-symbols-outlined text-[15px] text-[#137333]">eco</span>
          <span>100% शाकाहारी (Veg Mode)</span>
        </div>
      </div>

      {/* Smart Search & Voice Section */}
      <div className="px-4 pt-1 pb-1">
        <div className="relative flex items-center w-full bg-[#f4f4f0] border border-[#E6E4DD] rounded-xl focus-within:border-[#3b684a] transition-colors">
          <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#424843]">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            className="w-full bg-transparent py-2.5 pr-20 text-[#1a1c1a] text-[14px] placeholder:text-[#727972] focus:outline-none"
            placeholder={isHindi ? 'सामग्री खोजें (आटा, दाल, मसाले)...' : 'Search atta, spices, dairy...'}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            <button
              aria-label="Hindi Voice Search"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#eeeeea] text-[#1A3826] hover:bg-[#e8e8e5] transition-colors"
              type="button"
              onClick={onOpenVoice}
            >
              <span className="material-symbols-outlined text-[18px]">mic</span>
            </button>
            <button
              aria-label="Scan barcode"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#424843] hover:bg-[#eeeeea] transition-colors"
              type="button"
              onClick={onOpenVoice}
            >
              <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Category Chips */}
      <div className="px-4 py-1 overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            activeCategory === 'expiring'
              ? 'bg-[#FBF1ED] border-[#B45309]/50 text-[#B45309]'
              : 'bg-[#f4f4f0] border-[#E6E4DD] text-[#1a1c1a] hover:bg-[#eeeeea]'
          }`}
          type="button"
          onClick={() => setActiveCategory(activeCategory === 'expiring' ? 'all' : 'expiring')}
        >
          <span className="material-symbols-outlined text-[15px] text-[#B45309]">timer</span>
          <span>Expiring Soon (2)</span>
          <span className="text-[#B45309]/80 text-[11px]">जल्द समाप्त</span>
        </button>

        <button
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            activeCategory === 'pantry'
              ? 'bg-[#EDF2EE] border-[#3b684a] text-[#1A3826]'
              : 'bg-[#f4f4f0] border-[#E6E4DD] text-[#1a1c1a] hover:bg-[#eeeeea]'
          }`}
          type="button"
          onClick={() => setActiveCategory(activeCategory === 'pantry' ? 'all' : 'pantry')}
        >
          <span className="material-symbols-outlined text-[15px] text-[#3b684a]">shelves</span>
          <span>Pantry / भंडार</span>
        </button>

        <button
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            activeCategory === 'fridge'
              ? 'bg-[#EDF2EE] border-[#3b684a] text-[#1A3826]'
              : 'bg-[#f4f4f0] border-[#E6E4DD] text-[#1a1c1a] hover:bg-[#eeeeea]'
          }`}
          type="button"
          onClick={() => setActiveCategory(activeCategory === 'fridge' ? 'all' : 'fridge')}
        >
          <span className="material-symbols-outlined text-[15px] text-[#3b684a]">kitchen</span>
          <span>Fridge / फ्रिज</span>
        </button>

        <button
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            activeCategory === 'spices'
              ? 'bg-[#EDF2EE] border-[#3b684a] text-[#1A3826]'
              : 'bg-[#f4f4f0] border-[#E6E4DD] text-[#1a1c1a] hover:bg-[#eeeeea]'
          }`}
          type="button"
          onClick={() => setActiveCategory(activeCategory === 'spices' ? 'all' : 'spices')}
        >
          <span className="material-symbols-outlined text-[15px] text-[#3b684a]">spa</span>
          <span>Dry Spices (मसाले)</span>
        </button>
      </div>

      {/* Multi-User Inventory Scope Segmented Tabs */}
      <div className="px-4 pt-1 pb-1">
        <div className="bg-[#eeeeea] p-1 rounded-xl flex items-center justify-between border border-[#E6E4DD]">
          <button
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
              activeTab === 'mine'
                ? 'bg-white text-[#1a1c1a] shadow-xs font-semibold'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            type="button"
            onClick={() => setActiveTab('mine')}
          >
            <span className="block text-[13px] font-semibold leading-tight">Mine (Divyansh)</span>
            <span className="text-[11px] text-[#3b684a] font-medium">मेरा सामान [2]</span>
          </button>

          <button
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
              activeTab === 'shared'
                ? 'bg-white text-[#1a1c1a] shadow-xs font-semibold'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            type="button"
            onClick={() => setActiveTab('shared')}
          >
            <span className="block text-[13px] font-semibold leading-tight">Shared (304)</span>
            <span className="text-[11px] text-[#727972] font-medium">साझा भंडार [5]</span>
          </button>

          <button
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#1a1c1a] shadow-xs font-semibold'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            type="button"
            onClick={() => setActiveTab('all')}
          >
            <span className="block text-[13px] font-semibold leading-tight">All Items</span>
            <span className="text-[11px] text-[#727972] font-medium">कुल स्टॉक [7]</span>
          </button>
        </div>
      </div>

      {/* Pure-Veg Household Filter Banner */}
      <div className="px-4 py-1">
        <div className="bg-[#EDF2EE]/70 border border-[#E6E4DD] rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#b7e9c3]/50 border border-[#3b684a]/20 flex items-center justify-center text-[#1A3826] shrink-0">
              <span className="material-symbols-outlined text-[17px]">verified_user</span>
            </div>
            <div>
              <p className="text-[13px] text-[#1a1c1a] font-semibold leading-tight">
                Pure-Veg Household Filter Active
              </p>
              <p className="text-[11px] text-[#424843] leading-snug">
                Non-veg inventory separated per hostel setting
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#1A3826] text-white text-[10px] font-semibold">
            100% शुद्ध
          </span>
        </div>
      </div>

      {/* Inventory Items Feed */}
      <div className="px-4 pt-1 flex flex-col gap-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl p-3.5 border border-[#E6E4DD] shadow-xs flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                {/* Official FSSAI Veg Food Mark */}
                <div
                  className="w-4 h-4 rounded-xs border-[1.5px] border-[#137333] flex items-center justify-center shrink-0 mt-0.5 bg-white"
                  title="Pure Vegetarian (FSSAI)"
                >
                  <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] text-[#1a1c1a] font-bold leading-tight">
                      {item.name_en}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#424843] text-[11px] capitalize">
                      {item.category === 'pantry' ? 'भंडार' : item.category === 'fridge' ? 'फ्रिज' : 'मसाले'}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#424843] mt-0.5">{item.name_hi}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[18px] font-bold text-[#032212] tracking-tight">
                  {item.quantity} {item.unit}
                </span>
                <span className="text-[11px] text-[#424843]">{item.desiMeasure}</span>
              </div>
            </div>

            {/* Item Meta Pills */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    item.isExpiring
                      ? 'bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6]'
                      : 'bg-[#EDF2EE] text-[#3b684a]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.isExpiring ? 'bg-[#B45309]' : 'bg-[#3b684a]'
                    }`}
                  ></span>
                  {item.freshness}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eeeeea] text-[#424843] text-[11px]">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {item.ownerLabel}
                </span>
              </div>
            </div>

            {/* Actions & Tactile Desi Quantity Adjuster */}
            <div className="flex items-center justify-between gap-2 pt-1.5 bg-[#f4f4f0] p-2 rounded-lg border border-[#E6E4DD]">
              <div className="flex items-center gap-1 bg-[#eeeeea] rounded-lg p-0.5">
                <button
                  aria-label="Decrease quantity"
                  className="min-w-[40px] min-h-[36px] flex items-center justify-center rounded bg-white text-[#1a1c1a] hover:bg-[#e8e8e5] active:scale-95 transition-transform border border-[#E6E4DD]"
                  type="button"
                  onClick={() => handleAdjust(item.id, -item.stepAmount)}
                >
                  <span className="material-symbols-outlined text-[17px]">remove</span>
                </button>
                <div className="px-2.5 text-center">
                  <span className="text-[12px] text-[#1a1c1a] font-bold block">{item.stepUnit}</span>
                  <span className="text-[10px] text-[#424843] leading-none block">{item.stepDesi}</span>
                </div>
                <button
                  aria-label="Increase quantity"
                  className="min-w-[40px] min-h-[36px] flex items-center justify-center rounded bg-white text-[#1a1c1a] hover:bg-[#e8e8e5] active:scale-95 transition-transform border border-[#E6E4DD]"
                  type="button"
                  onClick={() => handleAdjust(item.id, item.stepAmount)}
                >
                  <span className="material-symbols-outlined text-[17px]">add</span>
                </button>
              </div>

              <button
                className="min-h-[38px] px-3.5 rounded-lg bg-white text-[#1a1c1a] hover:bg-[#eeeeea] border border-[#E6E4DD] transition-colors flex items-center gap-1.5 text-[12px] font-medium"
                type="button"
                onClick={() => handleToggleOwnership(item.id)}
              >
                <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                <span>{item.owner === 'mine' ? 'Move to Shared' : 'Move to Mine'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
