import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { StockItem } from '../types';
import { ScanModal } from './ScanModal';

interface StockScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
}

export const StockScreen: React.FC<StockScreenProps> = ({ isHindi, onOpenVoice }) => {
  const [scope, setScope] = useState<'all' | 'mine' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'fridge' | 'pantry' | 'expiring'>('all');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Add manual item state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(500);
  const [newItemUnit, setNewItemUnit] = useState<'g' | 'ml' | 'pcs'>('g');
  const [newItemScope, setNewItemScope] = useState<'personal' | 'shared'>('shared');
  const [newItemStorage, setNewItemStorage] = useState<'pantry' | 'fridge'>('pantry');

  useEffect(() => {
    refreshStock();
  }, [scope]);

  const refreshStock = () => {
    setStockItems(store.getStock(scope));
  };

  const handleAdjust = (ingredientId: string, delta: number, unit: string) => {
    const item = stockItems.find((i) => i.ingredient_id === ingredientId || i.id === ingredientId);
    if (!item) return;

    const op = delta > 0 ? 'add' : 'remove';
    const absQty = Math.abs(delta);
    store.adjustStock(
      item.ingredient_id,
      op,
      absQty,
      item.owner_user_id ? 'personal' : 'shared',
      'manual_adjust'
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

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const slug = newItemName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);
    const ingId = `ing_${slug}`;

    store.adjustStock(ingId, 'set', newItemQty, newItemScope, 'manual_create');
    setShowAddModal(false);
    setNewItemName('');
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
          <button onClick={() => setToastMessage(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header & Scan Button */}
      <section className="pt-2 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
              {isHindi ? 'रसोई का स्टॉक' : 'Kitchen Stock'}
            </h1>
            <p className="text-[12px] text-[#424843]">
              {isHindi ? 'पर्सनल और शेयर्ड इन्वेंटरी कंट्रोल' : 'Personal vs Shared shelf with unit conversion'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3.5 py-2 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all hover:bg-[#132a1d]"
              onClick={() => setIsScanOpen(true)}
              title="Scan Receipt or Fridge with Vision AI"
            >
              <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">document_scanner</span>
              <span>{isHindi ? 'स्कैन करें' : 'AI Scan'}</span>
            </button>

            <button
              className="w-9 h-9 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[#1A3826] hover:bg-[#f4f4f0]"
              onClick={() => setShowAddModal(true)}
              title="Add Item Manually"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>

        {/* 2-Scope Inventory Tabs (Spec Section 2.13) */}
        <div className="flex rounded-2xl bg-[#f4f4f0] p-1 border border-[#E6E4DD]">
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              scope === 'all'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('all')}
          >
            All Stock (Kitchen)
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              scope === 'mine'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('mine')}
          >
            👤 Personal (Mine)
          </button>
          <button
            className={`flex-1 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all ${
              scope === 'shared'
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'text-[#424843] hover:text-[#1a1c1a]'
            }`}
            onClick={() => setScope('shared')}
          >
            👥 Shared (Room 304)
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
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 ${
              filterCategory === 'all'
                ? 'bg-[#1A3826] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('all')}
          >
            All Items
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 ${
              filterCategory === 'expiring'
                ? 'bg-[#B45309] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('expiring')}
          >
            ⚠️ Expiring Soon
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 ${
              filterCategory === 'fridge'
                ? 'bg-[#3b684a] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD]'
            }`}
            onClick={() => setFilterCategory('fridge')}
          >
            ❄️ Fridge
          </button>
          <button
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 ${
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
            const isExpiring = Boolean(item.expiry) || (item.shelf_life_days && item.shelf_life_days <= 3);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-3.5 border border-[#E6E4DD] shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[14px] font-bold text-[#1a1c1a]">{item.name}</span>
                      {isPersonal ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[10px] font-semibold border border-[#D1E2D7]">
                          👤 Personal (Mine)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[10px] font-semibold border border-[#E9E1D6]">
                          👥 Shared Flat
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
                      {isExpiring && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold animate-pulse">
                          {item.expiry ? `Expires: ${item.expiry}` : 'Use Soon!'}
                        </span>
                      )}
                    </div>

                    {item.name_hi && (
                      <p className="text-[12px] text-[#424843] mt-0.5">{item.name_hi}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#727972]">
                      <span>{item.contributed_by || (isPersonal ? 'Divyansh' : 'Shared')}</span>
                      <span>•</span>
                      <span>Shelf life: ~{item.shelf_life_days || 30} days</span>
                    </div>
                  </div>

                  {/* Quantity Display */}
                  <div className="text-right shrink-0">
                    <span className="text-[18px] font-bold text-[#1A3826]">
                      {item.qty_base >= 1000 && item.unit_base === 'g'
                        ? `${(item.qty_base / 1000).toFixed(1)} kg`
                        : `${item.qty_base} ${item.unit_base}`}
                    </span>
                  </div>
                </div>

                {/* Adjust & Move Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-[#E6E4DD]/60">
                  {/* Desi Step Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5]"
                      onClick={() => handleAdjust(item.id, -250, item.unit_base)}
                      title="Deduct 250"
                    >
                      -250
                    </button>
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5]"
                      onClick={() => handleAdjust(item.id, 250, item.unit_base)}
                      title="Add 250"
                    >
                      +250
                    </button>
                    <button
                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] text-[#1a1c1a] text-[11px] font-bold active:scale-95 transition-all hover:bg-[#e8e8e5]"
                      onClick={() => handleAdjust(item.id, 500, item.unit_base)}
                      title="Add 500"
                    >
                      +500
                    </button>
                  </div>

                  {/* Scope Switcher Button */}
                  <button
                    className="text-[11px] text-[#1A3826] font-semibold hover:underline flex items-center gap-1"
                    onClick={() => handleMoveScope(item.id, item.owner_user_id)}
                    title="Change scope between Personal and Shared"
                  >
                    <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                    {isPersonal ? 'Make Shared' : 'Make Personal'}
                  </button>
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
              <button onClick={() => setShowAddModal(false)}>
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
                className="w-full py-2.5 rounded-xl bg-[#1A3826] text-white font-semibold text-[13px] mt-1"
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
