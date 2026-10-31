import React, { useState } from 'react';
import { store } from '../services/store';
import { BaseUnit, WastageEntry } from '../types';

interface CloudKitchenStockProps {
  isHindi: boolean;
}

export const CloudKitchenStock: React.FC<CloudKitchenStockProps> = ({ isHindi }) => {
  const me = store.getMe();
  const householdId = me.household.id;
  const isPureVeg = store.isPureVegOnly(householdId);
  const currentRole = store.getCloudKitchenRole(householdId);

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'ledger' | 'wastage'>('inventory');
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Wastage Form
  const [wasteIngId, setWasteIngId] = useState('');
  const [wasteQty, setWasteQty] = useState(500);
  const [wasteUnit, setWasteUnit] = useState<BaseUnit>('g');
  const [wasteReason, setWasteReason] = useState<WastageEntry['reason']>('spoilage');
  const [wasteCost, setWasteCost] = useState(45);
  const [wasteNotes, setWasteNotes] = useState('');

  const stockMap = store.getStock();
  const reservations = store.getStockReservations(householdId).filter((r) => r.status === 'active');
  const ledger = store.getStockLedger(householdId);
  const wastageList = store.getWastageEntries(householdId);

  const stockList = Object.values(stockMap).filter((s) => {
    if (isPureVeg && s.is_non_veg) return false;
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLogWastage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteIngId) {
      showToast('Select an ingredient');
      return;
    }

    store.logWastage(wasteIngId, wasteQty, wasteUnit, wasteReason, wasteCost, wasteNotes, householdId);
    showToast(isHindi ? 'वेस्टेज दर्ज की गई और स्टॉक कम हुआ!' : 'Wastage logged and stock deducted!');
    setShowWastageModal(false);
    setWasteNotes('');
    setRefreshKey((k) => k + 1);
  };

  // Metrics
  const lowStockCount = stockList.filter((s) => s.qty_base < (s.unit_base === 'pcs' ? 20 : 3000)).length;
  const totalReservedCount = reservations.reduce((sum, r) => sum + r.qty_reserved, 0);
  const totalWastageCost = wastageList.reduce((sum, w) => sum + (w.cost_inr || 0), 0);

  return (
    <div key={refreshKey} className="flex flex-col w-full pb-8 max-w-4xl mx-auto px-3 sm:px-4 gap-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#1A3826] text-white px-4 py-2.5 rounded-2xl text-[13px] font-semibold flex items-center gap-2 shadow-lg animate-fade-in border border-[#c8ebd1]/30">
          <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#1A3826]">inventory_2</span>
            <h1 className="text-[20px] font-bold text-[#1a1c1a]">
              {isHindi ? 'क्लाउड किचन स्टॉक और ऑडिट लेजर' : 'Commercial Stock & Audit Ledger'}
            </h1>
          </div>
          <p className="text-[12px] text-[#727972] mt-0.5">
            {isHindi
              ? 'ऑर्डर रिजर्वेशन, बैच कटौतियाँ और अपरिहार्य लेजर ऑडिट'
              : 'Follow-the-work inventory tracking, par levels, reservations & immutable change ledger'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (stockList[0]) setWasteIngId(stockList[0].ingredient_id);
            setShowWastageModal(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[12px] font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
          <span>{isHindi ? '📝 वेस्टेज / नुकसान दर्ज करें' : '📝 Log Wastage / Spoilage'}</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs">
          <span className="text-[10.5px] text-[#727972] block">Total Stock Items</span>
          <span className="text-[20px] font-extrabold text-[#1a1c1a]">{stockList.length} SKUs</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs">
          <span className="text-[10.5px] text-[#727972] block">Low Stock (&lt; Par)</span>
          <span className="text-[20px] font-extrabold text-amber-700">{lowStockCount} items</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs">
          <span className="text-[10.5px] text-[#727972] block">Active Reservations</span>
          <span className="text-[20px] font-extrabold text-blue-700">{reservations.length} items</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs">
          <span className="text-[10.5px] text-[#727972] block">Wastage Recorded</span>
          <span className="text-[20px] font-extrabold text-rose-700">₹{totalWastageCost}</span>
        </div>
      </div>

      {/* Sub Tabs: Inventory vs Audit Ledger vs Wastage */}
      <div className="flex border-b border-[#E6E4DD] gap-4 text-[13px] font-bold">
        <button
          type="button"
          onClick={() => setActiveSubTab('inventory')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'inventory'
              ? 'border-[#1A3826] text-[#1A3826]'
              : 'border-transparent text-[#727972] hover:text-[#1a1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">inventory</span>
          <span>{isHindi ? 'वर्तमान स्टॉक' : 'Inventory Levels'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ledger')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'ledger'
              ? 'border-[#1A3826] text-[#1A3826]'
              : 'border-transparent text-[#727972] hover:text-[#1a1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">history_edu</span>
          <span>{isHindi ? 'ऑडिट लेजर (Audit Trail)' : 'Audit Ledger'}</span>
          <span className="text-[10px] bg-gray-100 text-[#424843] px-1.5 py-0.2 rounded-full">
            {ledger.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('wastage')}
          className={`pb-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
            activeSubTab === 'wastage'
              ? 'border-[#1A3826] text-[#1A3826]'
              : 'border-transparent text-[#727972] hover:text-[#1a1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">delete_outline</span>
          <span>{isHindi ? 'वेस्टेज लॉग' : 'Wastage Log'}</span>
          <span className="text-[10px] bg-gray-100 text-[#424843] px-1.5 py-0.2 rounded-full">
            {wastageList.length}
          </span>
        </button>
      </div>

      {/* 1. INVENTORY LEVELS VIEW */}
      {activeSubTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#FAF9F6] border-b border-[#E6E4DD] text-[11px] font-bold text-[#727972] uppercase">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Reserved</th>
                  <th className="py-3 px-4">Net Available</th>
                  <th className="py-3 px-4">Par Level</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {stockList.map((item) => {
                  const resForThis = reservations
                    .filter((r) => r.ingredient_id === item.ingredient_id)
                    .reduce((sum, r) => sum + r.qty_reserved, 0);

                  const netAvailable = Math.max(0, item.qty_base - resForThis);
                  const par = item.unit_base === 'pcs' ? 20 : 3000;
                  const isLow = netAvailable < par;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70">
                      <td className="py-3 px-4 font-bold text-[#1a1c1a]">
                        <div className="flex items-center gap-1.5">
                          {item.is_non_veg && (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Non-veg"></span>
                          )}
                          <span>{item.name}</span>
                        </div>
                        {item.name_hi && <div className="text-[10.5px] text-[#727972]">{item.name_hi}</div>}
                      </td>
                      <td className="py-3 px-4 capitalize text-[#727972]">{item.location}</td>
                      <td className="py-3 px-4 font-bold text-[#1a1c1a]">
                        {item.qty_base} {item.unit_base}
                      </td>
                      <td className="py-3 px-4 text-blue-700 font-semibold">
                        {resForThis > 0 ? `${resForThis} ${item.unit_base}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1A3826]">
                        {netAvailable} {item.unit_base}
                      </td>
                      <td className="py-3 px-4 text-[#727972]">{par} {item.unit_base}</td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. IMMUTABLE AUDIT LEDGER VIEW */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 bg-[#FAF9F6] border-b border-[#E6E4DD] text-[11px] text-[#727972]">
            Every raw ingredient movement is recorded here: who made the change, when, why, and linked KOT/Batch ID.
          </div>
          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#FAF9F6] border-b border-[#E6E4DD] text-[11px] font-bold text-[#727972] uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4">Change</th>
                  <th className="py-3 px-4">Balance After</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Notes / Linked ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                      No ledger entries yet. Cooking and order preparation will populate this audit trail.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/70">
                      <td className="py-2.5 px-4 text-[11px] text-[#727972] whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#1a1c1a]">{entry.ingredient_name}</td>
                      <td className="py-2.5 px-4 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            entry.change_qty > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {entry.change_qty > 0 ? `+${entry.change_qty}` : entry.change_qty} {entry.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#424843]">
                        {entry.balance_after} {entry.unit}
                      </td>
                      <td className="py-2.5 px-4 capitalize font-semibold text-[11.5px] text-[#1A3826]">
                        {entry.reason.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-[#5A605B]">{entry.performed_by}</td>
                      <td className="py-2.5 px-4 text-[11px] text-[#727972]">
                        {entry.notes || (entry.linked_order_id ? `Order ${entry.linked_order_id}` : '-')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. WASTAGE LOG VIEW */}
      {activeSubTab === 'wastage' && (
        <div className="bg-white rounded-2xl border border-[#E6E4DD] shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#FAF9F6] border-b border-[#E6E4DD] text-[11px] font-bold text-[#727972] uppercase">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4">Wasted Qty</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Cost Loss (₹)</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {wastageList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                      Zero wastage recorded today.
                    </td>
                  </tr>
                ) : (
                  wastageList.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/70">
                      <td className="py-2.5 px-4 text-[11px] text-[#727972]">
                        {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#1a1c1a]">{w.ingredient_name}</td>
                      <td className="py-2.5 px-4 font-bold text-rose-700">
                        {w.qty} {w.unit}
                      </td>
                      <td className="py-2.5 px-4 capitalize font-semibold text-[#1a1c1a]">
                        {w.reason.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#1a1c1a]">₹{w.cost_inr}</td>
                      <td className="py-2.5 px-4 text-[11px] text-[#727972]">{w.logged_by}</td>
                      <td className="py-2.5 px-4 text-[11px] text-[#727972] italic">{w.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOG WASTAGE MODAL */}
      {showWastageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-rose-700">delete_sweep</span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">Log Wastage or Spoilage</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWastageModal(false)}
                className="text-[#727972] hover:text-[#1a1c1a]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleLogWastage} className="flex flex-col gap-3 text-[12px]">
              <div>
                <label className="font-bold text-[#424843] block mb-1">Select Ingredient</label>
                <select
                  value={wasteIngId}
                  onChange={(e) => {
                    setWasteIngId(e.target.value);
                    const item = stockList.find((s) => s.ingredient_id === e.target.value);
                    if (item) setWasteUnit(item.unit_base as BaseUnit);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                >
                  {stockList.map((s) => (
                    <option key={s.ingredient_id} value={s.ingredient_id}>
                      {s.name} (Have: {s.qty_base} {s.unit_base})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={wasteQty}
                    onChange={(e) => setWasteQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Estimated Cost Loss (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={wasteCost}
                    onChange={(e) => setWasteCost(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#424843] block mb-1">Reason for Wastage</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[12px] bg-[#FAF9F6]"
                >
                  <option value="spoilage">Spoilage / Expired / Bruised</option>
                  <option value="spill">Spill / Preparation Drop</option>
                  <option value="staff_meal">Staff Meal Consumption</option>
                  <option value="customer_return">Customer Return / Replaced Dish</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#424843] block mb-1">Explanation Notes</label>
                <input
                  type="text"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="e.g. Milk got spoiled due to fridge condenser failure"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
                <button
                  type="button"
                  onClick={() => setShowWastageModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#E6E4DD] font-semibold text-[#424843]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold shadow-xs cursor-pointer"
                >
                  Deduct Stock &amp; Record Loss
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
