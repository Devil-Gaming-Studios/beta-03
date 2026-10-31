import React, { useState } from 'react';
import { store } from '../services/store';
import { MenuItem, MenuItemDietTag, MenuItemCookMethod } from '../types';

interface CloudKitchenMenuProps {
  isHindi: boolean;
}

export const CloudKitchenMenu: React.FC<CloudKitchenMenuProps> = ({ isHindi }) => {
  const me = store.getMe();
  const householdId = me.household.id;
  const currentRole = store.getCloudKitchenRole(householdId);
  const isPureVeg = store.isPureVegOnly(householdId);

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showEditModal, setShowEditModal] = useState<MenuItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuItems = store.getMenuItems(householdId);

  const categories = ['All', ...Array.from(new Set(menuItems.map((m) => m.category)))];

  const filteredItems = menuItems.filter((m) => {
    if (selectedCategory !== 'All' && m.category !== selectedCategory) return false;
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleAvailable = (itemId: string, currentVal: boolean) => {
    store.toggleMenuItemAvailability(itemId, !currentVal, householdId);
    showToast(isHindi ? 'उपलब्धता अपडेट की गई' : 'Availability updated');
    setRefreshKey((k) => k + 1);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    try {
      store.addOrUpdateMenuItem(showEditModal, householdId);
      showToast(isHindi ? 'मेन्यू आइटम सेव हुआ!' : 'Menu item saved!');
      setShowEditModal(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      showToast(err.message || 'Error saving menu item');
    }
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

      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#1A3826]">menu_book</span>
            <h1 className="text-[20px] font-bold text-[#1a1c1a]">
              {isHindi ? 'फूड बिज़नेस मेन्यू और रेसिपी लिंक्स' : 'Food Business Menu & Recipe Links'}
            </h1>
          </div>
          <p className="text-[12px] text-[#727972] mt-0.5">
            {isHindi
              ? 'व्यंजनों का मूल्य, फूड कॉस्ट, ग्रॉस मार्जिन %, और ऑटो सोल्ड-आउट'
              : 'Linked to recipes, cost-per-portion, yield scaling, variants & auto sold-out'}
          </p>
        </div>

        {currentRole === 'owner' ? (
          <button
            type="button"
            onClick={() =>
              setShowEditModal({
                id: '',
                household_id: householdId,
                name: '',
                name_hi: '',
                description: '',
                category: 'Curries & Gravies',
                price_inr: 200,
                cost_inr: 60,
                portion_size: '400g Box',
                yield_per_batch: 20,
                prep_time_mins: 30,
                cook_method: 'batch',
                is_available: true,
                diet_tag: 'veg',
                allergens: [],
                variants: [],
                ingredients: [
                  { ingredient_id: 'ing_chawal', name: 'Basmati Rice', qty_per_portion: 100, unit: 'g', cost_estimate_inr: 15 },
                ],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
            className="px-4 py-2 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>{isHindi ? '➕ नया व्यंजन जोड़ें' : '➕ Add Menu Item'}</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#727972] bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
            Role: <strong>{currentRole}</strong> (View only)
          </span>
        )}
      </div>

      {/* Pure Veg Mode Banner if active */}
      {isPureVeg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-[12px] text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
            <span>
              <strong>Pure-Veg Kitchen Mode is Active:</strong> All non-veg dishes &amp; ingredients are strictly hidden.
            </span>
          </div>
        </div>
      )}

      {/* Category Pills Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#1A3826] text-white shadow-xs'
                : 'bg-white border border-[#E6E4DD] text-[#424843] hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredItems.map((item) => {
          const margin = item.price_inr > 0 ? Math.round(((item.price_inr - item.cost_inr) / item.price_inr) * 100) : 0;
          const isLowMargin = margin < 40;
          const isSoldOut = (item as any).is_sold_out || !item.is_available;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                isSoldOut ? 'border-gray-200 opacity-80' : 'border-[#E6E4DD] shadow-xs'
              }`}
            >
              <div className="flex flex-col gap-2">
                {/* Header: Diet badge & Availability */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Strict Veg/Non-veg/Egg indicator */}
                    <span
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                        item.diet_tag === 'veg'
                          ? 'border-emerald-600'
                          : item.diet_tag === 'egg'
                          ? 'border-amber-600'
                          : 'border-rose-600'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.diet_tag === 'veg'
                            ? 'bg-emerald-600'
                            : item.diet_tag === 'egg'
                            ? 'bg-amber-600'
                            : 'bg-rose-600'
                        }`}
                      ></span>
                    </span>

                    <span className="text-[11px] font-bold uppercase text-[#727972]">
                      {item.category}
                    </span>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F4F3EE] text-[#424843]">
                      {item.cook_method === 'batch' ? 'Batch Cook' : 'Cook to Order'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSoldOut ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        Sold Out
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Available
                      </span>
                    )}

                    <input
                      type="checkbox"
                      checked={item.is_available}
                      onChange={() => handleToggleAvailable(item.id, item.is_available)}
                      className="cursor-pointer"
                      title="Toggle availability"
                    />
                  </div>
                </div>

                {/* Name & Description */}
                <div>
                  <h3 className="text-[15px] font-bold text-[#1a1c1a]">{item.name}</h3>
                  {item.name_hi && <div className="text-[11.5px] text-[#727972]">{item.name_hi}</div>}
                  {item.description && (
                    <p className="text-[11.5px] text-[#5A605B] mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Price, Cost & Margin % */}
                <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E4DD] grid grid-cols-3 gap-2 text-center text-[11.5px]">
                  <div>
                    <span className="text-[10px] text-[#727972] block">Price</span>
                    <strong className="text-[14px] text-[#1a1c1a]">₹{item.price_inr}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#727972] block">Food Cost</span>
                    <strong className="text-[14px] text-[#5A605B]">₹{item.cost_inr}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#727972] block">Gross Margin</span>
                    <strong className={`text-[14px] font-extrabold ${isLowMargin ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {margin}% {isLowMargin && '⚠️'}
                    </strong>
                  </div>
                </div>

                {/* Cooked Portions Pool (For Batch Items) */}
                {item.cook_method === 'batch' && (
                  <div className="text-[11.5px] flex items-center justify-between px-2 py-1 bg-purple-50 text-purple-900 rounded-lg border border-purple-200">
                    <span>Cooked Portions in Pool:</span>
                    <strong className="font-bold">{item.cooked_portions_available ?? 0} ready to pack</strong>
                  </div>
                )}

                {/* Variants Preview */}
                {item.variants && item.variants.length > 0 && (
                  <div className="text-[10.5px] text-[#727972] flex flex-wrap gap-1">
                    <span className="font-medium text-[#424843]">Variants:</span>
                    {item.variants.map((v) => (
                      <span key={v.id} className="bg-white border border-[#E6E4DD] px-1.5 py-0.5 rounded">
                        {v.name} (₹{v.price_inr})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {currentRole === 'owner' && (
                <div className="pt-2 border-t border-[#F0EFEA] flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(item)}
                    className="px-3 py-1.5 rounded-lg border border-[#E6E4DD] hover:bg-gray-50 text-[11px] font-bold text-[#424843] flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    <span>Edit Price &amp; Yield</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* EDIT MENU ITEM MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                {showEditModal.id ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
                className="text-[#727972] hover:text-[#1a1c1a]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col gap-3 text-[12px]">
              <div>
                <label className="font-bold text-[#424843] block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={showEditModal.name}
                  onChange={(e) => setShowEditModal({ ...showEditModal, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={showEditModal.price_inr}
                    onChange={(e) => setShowEditModal({ ...showEditModal, price_inr: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Food Cost (₹)</label>
                  <input
                    type="number"
                    required
                    value={showEditModal.cost_inr}
                    onChange={(e) => setShowEditModal({ ...showEditModal, cost_inr: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Cook Method</label>
                  <select
                    value={showEditModal.cook_method}
                    onChange={(e) => setShowEditModal({ ...showEditModal, cook_method: e.target.value as MenuItemCookMethod })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[12px] bg-[#FAF9F6]"
                  >
                    <option value="batch">Batch Cook (Biryani, Dal)</option>
                    <option value="to_order">Cook to Order (Roti, Fresh Tadka)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#424843] block mb-1">Batch Yield (Portions)</label>
                  <input
                    type="number"
                    value={showEditModal.yield_per_batch}
                    onChange={(e) => setShowEditModal({ ...showEditModal, yield_per_batch: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#424843] block mb-1">Portion Size</label>
                <input
                  type="text"
                  value={showEditModal.portion_size}
                  onChange={(e) => setShowEditModal({ ...showEditModal, portion_size: e.target.value })}
                  placeholder="e.g. 450g Handi Box"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-3 py-2 rounded-xl border border-[#E6E4DD] font-semibold text-[#424843]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1A3826] text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
