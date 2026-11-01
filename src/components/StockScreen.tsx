import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { StockItem, BaseUnit } from '../types';
import { ScanModal } from './ScanModal';

interface StockScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
  onOpenScan?: (mode?: 'receipt' | 'fridge') => void;
}

const getFutureDateStr = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const StockScreen: React.FC<StockScreenProps> = ({ isHindi, onOpenVoice, onOpenScan }) => {
  const [scope, setScope] = useState<'all' | 'mine' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'fridge' | 'pantry' | 'expiring'>('all');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenScan = (mode: 'receipt' | 'fridge' = 'receipt') => {
    if (onOpenScan) {
      onOpenScan(mode);
    } else {
      setIsScanOpen(true);
    }
  };

  // Inline Restock State
  const [restockingStockId, setRestockingStockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState<number>(500);
  const [restockUnit, setRestockUnit] = useState<BaseUnit>('g');
  const [restockExpiry, setRestockExpiry] = useState<string>('');
  const [restockScope, setRestockScope] = useState<'personal' | 'shared'>('shared');
  const [restockLocation, setRestockLocation] = useState<'pantry' | 'fridge'>('pantry');

  // Quick Add manual item state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(500);
  const [newItemUnit, setNewItemUnit] = useState<'g' | 'ml' | 'pcs'>('g');
  const [newItemScope, setNewItemScope] = useState<'personal' | 'shared'>('shared');
  const [newItemStorage, setNewItemStorage] = useState<'pantry' | 'fridge'>('pantry');
  const [newItemExpiry, setNewItemExpiry] = useState('');

  useEffect(() => {
    refreshStock();
  }, [scope]);

  const refreshStock = () => {
    setStockItems(store.getStock(scope));
  };

  const handleAdjust = (stockId: string, delta: number, unit: string) => {
    const item = stockItems.find((i) => i.id === stockId);
    if (!item) return;

    const op = delta > 0 ? 'add' : 'remove';
    const absQty = Math.abs(delta);
    store.adjustStock(
      item.ingredient_id,
      op,
      absQty,
      item.owner_user_id ? 'personal' : 'shared',
      'manual_adjust',
      {
        stockId: item.id,
        unit: item.unit_base,
      }
    );
    refreshStock();
    setToastMessage(`Adjusted ${item.name} (${delta > 0 ? '+' : ''}${delta} ${unit})`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleMoveScope = (stockId: string, currentOwner: string | null) => {
    const target = currentOwner ? 'shared' : 'personal';
    store.moveToScope(stockId, target);
    refreshStock();
    setToastMessage(`Moved item to ${target === 'personal' ? 'Personal Stock' : 'Shared Common Stock'}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteBatch = (stockId: string, name: string) => {
    store.removeStockItem(stockId);
    if (restockingStockId === stockId) {
      setRestockingStockId(null);
    }
    refreshStock();
    setToastMessage(`Removed batch of ${name} from stock`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleRestock = (item: StockItem) => {
    if (restockingStockId === item.id) {
      setRestockingStockId(null);
      return;
    }
    setRestockingStockId(item.id);
    setRestockQty(item.unit_base === 'pcs' ? 2 : item.unit_base === 'ml' ? 500 : 500);
    setRestockUnit(item.unit_base);
    setRestockScope(item.owner_user_id ? 'personal' : 'shared');
    setRestockLocation(
      (item.storage_place as 'pantry' | 'fridge') || (item.location as 'pantry' | 'fridge') || 'pantry'
    );

    // Initial default expiry: if item already has one, use it or suggest a default future date
    if (item.expiry) {
      setRestockExpiry(item.expiry);
    } else {
      const days = item.shelf_life_days || (item.storage_place === 'fridge' ? 7 : 30);
      setRestockExpiry(getFutureDateStr(days));
    }
  };

  const handleConfirmRestock = (item: StockItem) => {
    if (restockQty <= 0) return;

    const normalizedCurrentExp = (item.expiry || '').trim().toLowerCase();
    const normalizedNewExp = (restockExpiry || '').trim().toLowerCase();
    const isDifferentExpiry = Boolean(restockExpiry) && normalizedCurrentExp !== normalizedNewExp;

    store.restockItem({
      stockId: item.id,
      ingredientId: item.ingredient_id,
      qty: restockQty,
      name: item.name,
      name_hi: item.name_hi,
      unit: restockUnit,
      expiry: restockExpiry.trim() || null,
      targetScope: restockScope,
      location: restockLocation,
    });

    refreshStock();
    setRestockingStockId(null);

    if (isDifferentExpiry) {
      setToastMessage(
        `Restocked ${item.name} (+${restockQty} ${restockUnit}) as a distinct batch expiring ${restockExpiry}!`
      );
    } else {
      setToastMessage(`Restocked ${item.name} (+${restockQty} ${restockUnit})!`);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const slug = newItemName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const ingId = `ing_${slug}`;

    store.adjustStock(ingId, 'set', newItemQty, newItemScope, 'manual_create', {
      name: newItemName.trim(),
      unit: newItemUnit,
      location: newItemStorage,
      targetScope: newItemScope,
      expiry: newItemExpiry.trim() || null,
    });

    setShowAddModal(false);
    setNewItemName('');
    setNewItemExpiry('');
    refreshStock();
    setToastMessage(`Added ${newItemName} to ${newItemScope === 'personal' ? 'Personal' : 'Shared'} stock!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredItems = stockItems.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !(item.name_hi && item.name_hi.includes(q))) {
        return false;
      }
    }
    if (filterCategory === 'fridge') return item.storage_place === 'fridge';
    if (filterCategory === 'pantry') return item.storage_place === 'pantry';
    if (filterCategory === 'expiring') return Boolean(item.expiry) || (item.shelf_life_days && item.shelf_life_days <= 3);
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header & Scan Button */}
      <section className="pt-2 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 pr-1">
            <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight truncate">
              {isHindi ? 'रसोई का स्टॉक' : 'Kitchen Stock'}
            </h1>
            <p className="text-[11.5px] sm:text-[12px] text-[#424843] truncate">
              {isHindi ? 'मल्टी-बैच एक्सपायरी और इनलाइन रीस्टॉक' : 'Multi-batch expiry & instant restocking'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Primary AI Scan Button: high priority, never pushed off-screen */}
            <button
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-[#1A3826] text-white text-[11.5px] sm:text-[12px] font-semibold flex items-center gap-1 sm:gap-1.5 shadow-xs active:scale-95 transition-all hover:bg-[#132a1d] cursor-pointer shrink-0"
              onClick={() => handleOpenScan('receipt')}
              title={isHindi ? 'AI रसीद व फ्रिज स्कैनर' : 'Scan Receipt or Fridge with Vision AI'}
            >
              <span className="material-symbols-outlined text-[17px] text-[#c8ebd1]">document_scanner</span>
              <span>{isHindi ? 'स्कैन करें' : 'AI Scan'}</span>
            </button>

            <button
              className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#1A3826] text-white flex items-center justify-center shadow-xs active:scale-95 transition-all hover:bg-[#132a1d] cursor-pointer shrink-0"
              onClick={onOpenVoice}
              title="Voice Update Stock (Shruti / Cactus Whisper)"
            >
              <span className="material-symbols-outlined text-[18px]">mic</span>
            </button>

            <button
              className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[#1A3826] hover:bg-[#f4f4f0] cursor-pointer shrink-0"
              onClick={() => setShowAddModal(true)}
              title="Add Item Manually"
            >
              <span className="material-symbols-outlined text-[19px]">add</span>
            </button>
          </div>
        </div>

        {/* Dedicated Prominent AI Scan Quick-Action Banner: Always 100% visible on any screen proportion */}
        <div
          onClick={() => handleOpenScan('receipt')}
          className="p-3 rounded-2xl bg-gradient-to-r from-[#1A3826] to-[#254d35] text-white flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-[22px] text-[#c8ebd1]">document_scanner</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-bold">
                  {isHindi ? 'AI रसीद व फ्रिज स्कैनर' : 'Gemini AI Vision Scanner'}
                </span>
                <span className="text-[9.5px] bg-[#c8ebd1] text-[#032212] font-extrabold px-1.5 py-0.2 rounded-full">
                  AI OCR
                </span>
              </div>
              <span className="text-[11px] text-white/85 truncate">
                {isHindi
                  ? 'किराना बिल या फ्रिज फोटो से ऑटो-स्टॉक करें'
                  : 'Scan Blinkit / Zepto bills or fridge shelves'}
              </span>
            </div>
          </div>
          <div className="px-2.5 sm:px-3 py-1.5 rounded-full bg-white text-[#1A3826] text-[11px] font-bold shrink-0 shadow-xs flex items-center gap-1">
            <span>{isHindi ? 'स्कैन' : 'Scan'}</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </div>
        </div>

        {/* 2-Scope Inventory Tabs */}
        <div className="flex rounded-2xl bg-[#f4f4f0] p-1 border border-[#E6E4DD]">
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12px] sm:text-[12.5px] font-semibold transition-all cursor-pointer ${
              scope === 'all'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('all')}
          >
            All Stock
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12px] sm:text-[12.5px] font-semibold transition-all cursor-pointer ${
              scope === 'mine'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('mine')}
          >
            👤 Personal
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12px] sm:text-[12.5px] font-semibold transition-all cursor-pointer ${
              scope === 'shared'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('shared')}
          >
            👥 Shared
          </button>
        </div>
      </section>

      {/* Search & Category Filter */}
      <section className="flex flex-col gap-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#727972] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isHindi ? 'स्टॉक में खोजें...' : 'Search in stock (Atta, Dahi, Dal, Paneer)...'}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[13px] text-[#1a1c1a] placeholder:text-[#93a0b4] focus:outline-none focus:border-[#1A3826]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-[#1A3826] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('all')}
          >
            All Items
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer ${
              filterCategory === 'expiring'
                ? 'bg-[#B45309] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('expiring')}
          >
            ⚠️ Expiring Soon
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer ${
              filterCategory === 'fridge'
                ? 'bg-[#3b684a] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('fridge')}
          >
            ❄️ Fridge
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 cursor-pointer ${
              filterCategory === 'pantry'
                ? 'bg-[#3b684a] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('pantry')}
          >
            🌾 Pantry
          </button>
        </div>
      </section>

      {/* Stock Items List */}
      <section className="flex flex-col gap-2.5">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-[#E6E4DD] text-[#424843]">
            <span className="material-symbols-outlined text-[32px] text-[#727972]">inventory_2</span>
            <p className="text-[14px] font-semibold mt-1">No items found in this shelf view</p>
            <p className="text-[12px] text-[#727972]">Tap "+ Add Item" or scan a receipt.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isPersonal = Boolean(item.owner_user_id);
            const isCold = item.storage_place === 'fridge';
            const isExpiring = Boolean(item.expiry) || (item.shelf_life_days !== undefined && item.shelf_life_days <= 3);
            const isRestockingThis = restockingStockId === item.id;

            // Multi-batch check: if there are other items in the stock list with the same ingredient ID or name
            const sameIngredientItems = stockItems.filter(
              (s) =>
                s.ingredient_id === item.ingredient_id ||
                s.name.toLowerCase().trim() === item.name.toLowerCase().trim()
            );
            const hasMultipleBatches = sameIngredientItems.length > 1;
            const batchIndex = sameIngredientItems.findIndex((s) => s.id === item.id) + 1;

            // Restock batch dynamic calculation
            const normalizedItemExp = (item.expiry || '').trim().toLowerCase();
            const normalizedRestockExp = (restockExpiry || '').trim().toLowerCase();
            const willBeSeparateEntity =
              isRestockingThis &&
              Boolean(restockExpiry.trim()) &&
              normalizedItemExp !== normalizedRestockExp;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-3.5 border transition-all shadow-xs flex flex-col gap-2.5 ${
                  isRestockingThis
                    ? 'border-[#1A3826] ring-1 ring-[#1A3826]/30'
                    : 'border-[#E6E4DD]'
                }`}
              >
                {/* Header row: Name, Badges, and Inline Restock Button */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[14px] font-bold text-[#1a1c1a]">{item.name}</span>

                      {/* Multi-Batch Tag */}
                      {hasMultipleBatches && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA] text-[10px] font-bold border border-[#C7D2FE] flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">layers</span>
                          <span>Batch #{batchIndex} of {sameIngredientItems.length}</span>
                        </span>
                      )}

                      {isPersonal ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[10px] font-semibold border border-[#D1E2D7]">
                          👤 Personal
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[10px] font-semibold border border-[#E9E1D6]">
                          👥 Shared
                        </span>
                      )}

                      {isCold ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#E0F2FE] text-[#0369A1]">
                          Fridge
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#F4F4F0] text-[#525252]">
                          Pantry
                        </span>
                      )}

                      {/* Expiry Badge */}
                      {item.expiry ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isExpiring
                              ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] animate-pulse'
                              : 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[11px]">event</span>
                          <span>Expires: {item.expiry}</span>
                        </span>
                      ) : (
                        isExpiring && (
                          <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold">
                            Use Soon!
                          </span>
                        )
                      )}
                    </div>

                    {item.name_hi && (
                      <p className="text-[12px] text-[#424843] mt-0.5">{item.name_hi}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#727972]">
                      <span>{item.contributed_by || (isPersonal ? 'Personal' : 'Shared 304')}</span>
                      <span>•</span>
                      <span>Shelf life: ~{item.shelf_life_days || 30} days</span>
                    </div>
                  </div>

                  {/* Quantity Display & Inline Restock Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span
                        className={`text-[17px] font-bold ${
                          item.qty_base === 0 ? 'text-[#991B1B]' : 'text-[#1A3826]'
                        }`}
                      >
                        {item.qty_base >= 1000 && item.unit_base === 'g'
                          ? `${(item.qty_base / 1000).toFixed(1)} kg`
                          : `${item.qty_base} ${item.unit_base}`}
                      </span>
                      {item.qty_base === 0 && (
                        <span className="block text-[9px] text-[#991B1B] font-bold uppercase">
                          Empty Batch
                        </span>
                      )}
                    </div>

                    {/* Dedicated Inline Restock Button right beside the item */}
                    <button
                      type="button"
                      onClick={() => handleToggleRestock(item)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer ${
                        isRestockingThis
                          ? 'bg-[#1A3826] text-white ring-2 ring-[#81a28a]'
                          : 'bg-[#1A3826] hover:bg-[#132a1d] text-white active:scale-95'
                      }`}
                      title={isRestockingThis ? 'Close Restock Panel' : `Restock ${item.name}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isRestockingThis ? 'expand_less' : 'add_circle'}
                      </span>
                      <span>{isRestockingThis ? 'Close' : 'Restock'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Restock Panel (Expands directly under this item) */}
                {isRestockingThis && (
                  <div className="mt-1 p-3.5 bg-[#FAF9F5] rounded-xl border border-[#E6E4DD] flex flex-col gap-3 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-[#E6E4DD]/80 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-[#1A3826]">
                          add_shopping_cart
                        </span>
                        <span className="text-[13px] font-bold text-[#1a1c1a]">
                          Restock {item.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#727972]">
                        Current batch: {item.expiry || 'No expiry'}
                      </span>
                    </div>

                    {/* Quick Quantity Chips & Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-[#424843] uppercase">
                          Restock Quantity
                        </label>
                        <div className="flex items-center gap-1">
                          {item.unit_base === 'g' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRestockQty(100)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 100
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +100g
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(250)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 250
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +250g
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(500)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 500
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +500g
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(1000)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 1000
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +1kg
                              </button>
                            </>
                          )}
                          {item.unit_base === 'ml' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRestockQty(250)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 250
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +250ml
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(500)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 500
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +500ml
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(1000)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 1000
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +1L
                              </button>
                            </>
                          )}
                          {item.unit_base === 'pcs' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setRestockQty(1)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 1
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(2)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 2
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +2
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(6)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 6
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +6
                              </button>
                              <button
                                type="button"
                                onClick={() => setRestockQty(12)}
                                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border ${
                                  restockQty === 12
                                    ? 'bg-[#1A3826] text-white border-[#1A3826]'
                                    : 'bg-white text-[#424843] border-[#E6E4DD]'
                                }`}
                              >
                                +12
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="1"
                          value={restockQty}
                          onChange={(e) => setRestockQty(Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-full px-3 py-1.5 rounded-xl border border-[#E6E4DD] text-[13px] bg-white font-medium"
                        />
                        <select
                          value={restockUnit}
                          onChange={(e: any) => setRestockUnit(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-[#E6E4DD] text-[13px] bg-white font-medium"
                        >
                          <option value="g">Grams (g)</option>
                          <option value="ml">Milliliters (ml)</option>
                          <option value="pcs">Pieces (pcs)</option>
                        </select>
                      </div>
                    </div>

                    {/* Expiry Date Section (Multi-Batch Engine) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[#424843] uppercase flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[#B45309]">event</span>
                          <span>Batch Expiry Date</span>
                        </label>
                        <span className="text-[10px] text-[#727972]">
                          Diff expiry = separate entity
                        </span>
                      </div>

                      {/* Quick Date Presets */}
                      <div className="flex items-center gap-1 flex-wrap mb-2">
                        <button
                          type="button"
                          onClick={() => setRestockExpiry(getFutureDateStr(3))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-[#E6E4DD] text-[#424843] hover:bg-[#e8f0ec]"
                        >
                          +3 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockExpiry(getFutureDateStr(7))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-[#E6E4DD] text-[#424843] hover:bg-[#e8f0ec]"
                        >
                          +7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockExpiry(getFutureDateStr(14))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-[#E6E4DD] text-[#424843] hover:bg-[#e8f0ec]"
                        >
                          +14 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockExpiry(getFutureDateStr(30))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-[#E6E4DD] text-[#424843] hover:bg-[#e8f0ec]"
                        >
                          +1 Month
                        </button>
                        {item.expiry && (
                          <button
                            type="button"
                            onClick={() => setRestockExpiry(item.expiry || '')}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E8F0EC] border border-[#A7D7B5] text-[#1E4620]"
                            title="Add to current batch entity"
                          >
                            Keep Current ({item.expiry})
                          </button>
                        )}
                      </div>

                      <input
                        type="date"
                        value={restockExpiry}
                        onChange={(e) => setRestockExpiry(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-[#E6E4DD] text-[13px] bg-white font-medium"
                      />

                      {/* Multi-batch explanation banner */}
                      <div
                        className={`mt-2 p-2 rounded-lg text-[11px] leading-tight flex items-start gap-1.5 ${
                          willBeSeparateEntity
                            ? 'bg-[#EEF2FF] text-[#3730A3] border border-[#C7D2FE]'
                            : 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">
                          {willBeSeparateEntity ? 'layers' : 'check_circle'}
                        </span>
                        <span>
                          {willBeSeparateEntity ? (
                            <>
                              <strong>New Batch Entity:</strong> Expiry date differs from current batch ({item.expiry || 'none'}). This will be created as a <strong>distinct entity</strong> in the stock list with separate expiry tracking.
                            </>
                          ) : (
                            <>
                              <strong>Same Batch:</strong> Will add +{restockQty} {restockUnit} to this existing batch entity.
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Scope & Storage Options */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-[#727972] uppercase block mb-1">
                          Scope
                        </label>
                        <select
                          value={restockScope}
                          onChange={(e: any) => setRestockScope(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6E4DD] text-[12px] bg-white"
                        >
                          <option value="shared">👥 Shared (All)</option>
                          <option value="personal">👤 Personal (Mine)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#727972] uppercase block mb-1">
                          Location
                        </label>
                        <select
                          value={restockLocation}
                          onChange={(e: any) => setRestockLocation(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6E4DD] text-[12px] bg-white"
                        >
                          <option value="pantry">🌾 Pantry</option>
                          <option value="fridge">❄️ Fridge</option>
                        </select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRestockingStockId(null)}
                        className="flex-1 py-2 rounded-xl border border-[#E6E4DD] text-[#424843] text-[12px] font-semibold hover:bg-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmRestock(item)}
                        className="flex-2 py-2 rounded-xl bg-[#1A3826] hover:bg-[#132a1d] text-white text-[12px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Confirm Restock (+{restockQty} {restockUnit})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Adjust & Move Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-[#E6E4DD]/60">
                  {/* Step Buttons (Deduct / Add to THIS specific batch) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5] cursor-pointer"
                      onClick={() => handleAdjust(item.id, -250, item.unit_base)}
                      title="Deduct 250 from this batch"
                    >
                      -250
                    </button>
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5] cursor-pointer"
                      onClick={() => handleAdjust(item.id, 250, item.unit_base)}
                      title="Add 250 to this batch"
                    >
                      +250
                    </button>
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5] cursor-pointer"
                      onClick={() => handleAdjust(item.id, 500, item.unit_base)}
                      title="Add 500 to this batch"
                    >
                      +500
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Scope Switcher Button */}
                    <button
                      className="text-[11px] text-[#1A3826] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      onClick={() => handleMoveScope(item.id, item.owner_user_id)}
                      title="Change scope between Personal and Shared"
                    >
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                      {isPersonal ? 'Make Shared' : 'Make Personal'}
                    </button>

                    {/* Delete Batch Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteBatch(item.id, item.name)}
                      title="Delete this batch from stock"
                      className="text-[#93a0b4] hover:text-[#dc2626] p-1 rounded-lg hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete_outline</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Manual Add Item Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] flex flex-col gap-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-2.5">
              <h3 className="text-[16px] font-bold text-[#1a1c1a]">Add Stock Item</h3>
              <button onClick={() => setShowAddModal(false)} className="cursor-pointer">
                <span className="material-symbols-outlined text-[20px] text-[#727972]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sona Masoori Rice, Maggi, Paneer..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">Unit</label>
                  <select
                    value={newItemUnit}
                    onChange={(e: any) => setNewItemUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-white"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date (Optional) */}
              <div>
                <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={newItemExpiry}
                  onChange={(e) => setNewItemExpiry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">Scope</label>
                  <select
                    value={newItemScope}
                    onChange={(e: any) => setNewItemScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-white"
                  >
                    <option value="shared">👥 Shared (All)</option>
                    <option value="personal">👤 Personal (Mine)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#727972] uppercase block mb-1">Storage</label>
                  <select
                    value={newItemStorage}
                    onChange={(e: any) => setNewItemStorage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-white"
                  >
                    <option value="pantry">🌾 Pantry</option>
                    <option value="fridge">❄️ Fridge</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1A3826] text-white font-semibold text-[13px] mt-1 cursor-pointer"
              >
                Save to Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Vision Scanner Modal (Receipt OCR & Fridge Scan) */}
      <ScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onItemsIngested={() => {
          refreshStock();
          setToastMessage('Scanned items successfully confirmed and added to stock!');
          setTimeout(() => setToastMessage(null), 3500);
        }}
        isHindi={isHindi}
      />
    </div>
  );
};
