import React, { useState } from 'react';
import { store } from '../services/store';
import { CookBatch } from '../types';
import { calculatePortionsFeasibility } from '../services/cloudKitchenService';

interface CloudKitchenBatchesProps {
  isHindi: boolean;
  onOpenVoice: () => void;
}

export const CloudKitchenBatches: React.FC<CloudKitchenBatchesProps> = ({ isHindi, onOpenVoice }) => {
  const me = store.getMe();
  const householdId = me.household.id;
  const currentRole = store.getCloudKitchenRole(householdId);
  const batches = store.getBatches(householdId);
  const menuItems = store.getMenuItems(householdId).filter((m) => m.cook_method === 'batch');
  const stockItems = store.getStock();

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState(menuItems[0]?.id || '');
  const [portions, setPortions] = useState(25);
  const [overrideAllowed, setOverrideAllowed] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedItem = menuItems.find((m) => m.id === selectedMenuItemId) || menuItems[0];
  const feasibility = selectedItem
    ? calculatePortionsFeasibility(selectedItem, portions, stockItems)
    : { canCook: true, maxPossiblePortions: 0, shortages: [] };

  const handleAnnounce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const res = store.announceBatch(
      selectedItem.id,
      portions,
      overrideAllowed,
      overrideReason || undefined,
      householdId
    );

    if (!res.success) {
      showToast(res.error || 'Stock shortage! Please verify or override.');
      setOverrideAllowed(true);
    } else {
      showToast(
        isHindi
          ? `बैच तैयार: ${portions} पोर्शन ${selectedItem.name} का स्टॉक काट लिया गया!`
          : `Batch announced: ${portions} portions of ${selectedItem.name} deducted from stock!`
      );
      setOverrideAllowed(false);
      setOverrideReason('');
      setRefreshKey((k) => k + 1);
    }
  };

  const handleCompleteBatch = (batchId: string) => {
    store.completeBatch(batchId, householdId);
    showToast(isHindi ? 'बैच पूरा हो गया!' : 'Batch marked complete and ready!');
    setRefreshKey((k) => k + 1);
  };

  return (
    <div key={refreshKey} className="flex flex-col w-full pb-8 max-w-4xl mx-auto px-3 sm:px-4 gap-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#1A3826] text-white px-4 py-2.5 rounded-2xl text-[13px] font-semibold flex items-center gap-2 shadow-lg animate-fade-in border border-[#c8ebd1]/30">
          <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title & Guidance */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#1A3826]">soup_kitchen</span>
            <h1 className="text-[20px] font-bold text-[#1a1c1a]">
              {isHindi ? 'बैच कुकिंग और उत्पादन योजना' : 'Batch Cooking & Production Queue'}
            </h1>
          </div>
          <p className="text-[12px] text-[#727972] mt-0.5">
            {isHindi
              ? 'फूड बिज़नेस में कोई 3 निश्चित भोजन नहीं होते — यहाँ मांग और बैच के अनुसार खाना बनता है।'
              : 'Cook to orders and announced batches. Raw inventory follows what is actually cooked and sold.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenVoice}
          className="px-3.5 py-2 rounded-xl bg-[#EDF2EE] hover:bg-[#dbe7df] text-[#032212] border border-[#c8ebd1] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">mic</span>
          <span>{isHindi ? '"40 वेज बिरयानी बना रहा हूँ"' : 'Voice Announce'}</span>
        </button>
      </div>

      {/* "ANNOUNCE WHAT I'M COOKING" ENGINE */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6E4DD] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#1A3826]">skillet</span>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? '1. नया बैच घोषित करें (Announce What I\'m Cooking)' : '1. Announce What I\'m Cooking (Batch Scaler)'}
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#1A3826]">
            Confirm-Before-Deduct Safety
          </span>
        </div>

        <form onSubmit={handleAnnounce} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11.5px] font-bold text-[#424843] block mb-1">
                Select Batch Recipe (बैच व्यंजन)
              </label>
              <select
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6E4DD] text-[13px] font-medium bg-[#FAF9F6] focus:bg-white focus:outline-[#1A3826]"
              >
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Yield: {m.yield_per_batch} per std batch)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11.5px] font-bold text-[#424843] block mb-1">
                Portions to Cook (पोर्शन संख्या)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={portions}
                  onChange={(e) => setPortions(Math.max(1, Number(e.target.value)))}
                  className="w-24 px-3 py-2 rounded-xl border border-[#E6E4DD] text-[15px] font-bold text-center bg-[#FAF9F6]"
                />
                <div className="flex flex-wrap gap-1">
                  {[10, 20, 25, 40, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPortions(num)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        portions === num
                          ? 'bg-[#1A3826] text-white border-[#1A3826]'
                          : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843] hover:bg-gray-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scaled Recipe Ingredient Analysis */}
          {selectedItem && (
            <div className="border border-[#E6E4DD] rounded-xl p-3 bg-[#FAF9F6] flex flex-col gap-2">
              <div className="flex justify-between items-center text-[12px] font-bold">
                <span className="text-[#1a1c1a]">Ingredient Scaling for {portions} Portions:</span>
                <span className={feasibility.canCook ? 'text-emerald-700' : 'text-rose-700'}>
                  {feasibility.canCook ? '✓ All Ingredients Available' : `⚠️ ${feasibility.shortages.length} Shortages Flagged`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {selectedItem.ingredients.map((ing) => {
                  const totalNeeded = ing.qty_per_portion * portions;
                  const stock = Object.values(stockItems).find((s) => s.ingredient_id === ing.ingredient_id);
                  const available = stock ? stock.qty_base : 0;
                  const isShort = available < totalNeeded && !ing.is_pinch_or_taste;

                  return (
                    <div
                      key={ing.ingredient_id}
                      className={`p-2 rounded-lg border text-[11.5px] flex items-center justify-between ${
                        isShort ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-[#E6E4DD] text-[#424843]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-[#1a1c1a]">{ing.name}</div>
                        <div className="text-[10px] text-[#727972]">
                          Need: <strong className="text-[#1a1c1a]">{totalNeeded} {ing.unit}</strong> • Have: {available} {ing.unit}
                        </div>
                      </div>
                      {isShort ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-800 text-[10px] font-bold shrink-0">
                          Short: {totalNeeded - available} {ing.unit}
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-[10px] font-bold">OK</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {overrideAllowed && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex flex-col gap-1.5">
              <span className="font-bold">⚠️ Owner Shortage Override:</span>
              <p className="text-[11px]">
                Stock is below requirement. As Owner/Head Chef, enter a reason to allow cooking anyway (e.g. fresh delivery in kitchen).
              </p>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason e.g. Local vendor supplied 5kg paneer directly"
                className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-[12px]"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white text-[13px] font-bold flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Confirm &amp; Deduct Raw Stock ({portions} Portions)</span>
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVE BATCHES & COOKED PORTIONS POOLS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#1A3826]">inventory</span>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? '2. तैयार बैच और उपलब्ध पोर्शन पूल' : '2. Active Batches & Cooked Portions Available'}
            </h2>
          </div>
          <span className="text-[11.5px] text-[#727972]">
            Orders draw directly from these cooked pools
          </span>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-[#727972] italic">
            No active batches announced today. Announce cooking above to fill cooked portion pools.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {batches.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] flex flex-col gap-2 hover:border-[#1A3826]/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#1a1c1a]">{b.item_name}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {b.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] bg-white p-2 rounded-lg border border-[#E6E4DD]">
                  <div>
                    <span className="text-[#727972] text-[10.5px] block">Cooked Total:</span>
                    <span className="font-bold text-[#1a1c1a]">{b.portions_cooked} portions</span>
                  </div>
                  <div>
                    <span className="text-[#727972] text-[10.5px] block">Ready to Pack:</span>
                    <span className="font-bold text-[#1A3826]">{b.portions_remaining} left</span>
                  </div>
                </div>

                <div className="text-[10.5px] text-[#727972] flex items-center justify-between">
                  <span>Chef: <strong>{b.announced_by}</strong></span>
                  <span>{new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {b.ingredients_deducted.length > 0 && (
                  <div className="text-[10px] text-[#5A605B] border-t border-[#E6E4DD] pt-1">
                    Deducted: {b.ingredients_deducted.map((i) => `${i.qty}${i.unit} ${i.name}`).slice(0, 3).join(', ')}...
                  </div>
                )}

                {b.status === 'cooking' && (
                  <button
                    type="button"
                    onClick={() => handleCompleteBatch(b.id)}
                    className="w-full mt-1 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px]"
                  >
                    Mark Batch Cooking Completed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
