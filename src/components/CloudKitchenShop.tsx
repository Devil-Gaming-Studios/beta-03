import React, { useState } from 'react';
import { store } from '../services/store';
import { BaseUnit, PurchaseList, Supplier } from '../types';

interface CloudKitchenShopProps {
  isHindi: boolean;
}

const DEFAULT_CATEGORIES = [
  'Dairy (पनीर, मक्खन, क्रीम, दूध)',
  'Fresh Vegetables (प्याज, टमाटर, लहसुन, अदरक)',
  'Dry Spices & Grains (चावल, दाल, मसाले)',
  'Packaging & Disposables (Handi Boxes, Tubs, Foil)',
  'Poultry & Meat (Chicken, Mutton, Eggs)',
  'Oils, Ghee & Bakery (तेल, घी, ब्रेड)',
];

export const CloudKitchenShop: React.FC<CloudKitchenShopProps> = ({ isHindi }) => {
  const me = store.getMe();
  const householdId = me.household.id;
  const suppliers = store.getSuppliers(householdId);
  const purchaseLists = store.getPurchaseLists(householdId);

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeList, setActiveList] = useState<PurchaseList | null>(purchaseLists[0] || null);
  const [showGoodsReceiveModal, setShowGoodsReceiveModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Supplier Management State
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Form Fields for Add/Edit Supplier
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLeadTime, setFormLeadTime] = useState(3);
  const [formBrands, setFormBrands] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleGenerateList = () => {
    const list = store.generatePurchaseList(householdId);
    setActiveList(list);
    showToast(isHindi ? `खरीद सूची तैयार: ${list.items.length} आइटम` : `Purchase list generated: ${list.items.length} items`);
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmReceive = () => {
    if (!activeList) return;
    const itemsToReceive = activeList.items.map((i) => ({
      ingredient_id: i.ingredient_id,
      qty_received: i.needed_qty,
      unit: i.unit,
    }));

    store.receiveGoods(activeList.id, itemsToReceive, householdId);
    showToast(isHindi ? 'माल प्राप्त हुआ! स्टॉक और लेजर अपडेट हो गए।' : 'Goods received! Stock and audit ledger updated.');
    setShowGoodsReceiveModal(false);
    setRefreshKey((k) => k + 1);
  };

  // Supplier modal handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormCategory(DEFAULT_CATEGORIES[0]);
    setFormPhone('');
    setFormContactPerson('');
    setFormEmail('');
    setFormAddress('');
    setFormLeadTime(3);
    setFormBrands('');
    setFormNotes('');
    setFormError(null);
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormCategory(sup.category);
    setFormPhone(sup.phone);
    setFormContactPerson(sup.contact_person || '');
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormLeadTime(sup.lead_time_hours || 3);
    setFormBrands(sup.preferred_brands?.join(', ') || '');
    setFormNotes(sup.notes || '');
    setFormError(null);
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError(isHindi ? 'सप्लायर का नाम आवश्यक है' : 'Supplier name is required');
      return;
    }
    if (!formPhone.trim()) {
      setFormError(isHindi ? 'सम्पर्क फोन नंबर आवश्यक है' : 'Contact phone number is required');
      return;
    }

    const brandsArray = formBrands
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    if (editingSupplier) {
      // Update existing supplier
      const res = store.updateSupplier(
        editingSupplier.id,
        {
          name: formName.trim(),
          category: formCategory.trim() || 'General Food & Provisions',
          phone: formPhone.trim(),
          contact_person: formContactPerson.trim() || undefined,
          email: formEmail.trim() || undefined,
          address: formAddress.trim() || undefined,
          lead_time_hours: Number(formLeadTime) || 2,
          preferred_brands: brandsArray,
          notes: formNotes.trim() || undefined,
        },
        householdId
      );

      if (res.success) {
        showToast(
          isHindi
            ? `सप्लायर "${formName}" का विवरण सफलतापूर्वक अपडेट हुआ`
            : `Supplier "${formName}" details updated successfully`
        );
        setShowSupplierModal(false);
        setRefreshKey((k) => k + 1);
      } else {
        setFormError(res.message || 'Update failed');
      }
    } else {
      // Add new supplier
      const newSup = store.addSupplier(
        {
          name: formName.trim(),
          category: formCategory.trim() || 'General Food & Provisions',
          phone: formPhone.trim(),
          contact_person: formContactPerson.trim() || undefined,
          email: formEmail.trim() || undefined,
          address: formAddress.trim() || undefined,
          lead_time_hours: Number(formLeadTime) || 2,
          preferred_brands: brandsArray,
          notes: formNotes.trim() || undefined,
        },
        householdId
      );

      showToast(
        isHindi
          ? `नया सप्लायर "${newSup.name}" सफलतापूर्वक जोड़ा गया`
          : `New contractor "${newSup.name}" added to supplier directory`
      );
      setShowSupplierModal(false);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDeleteSupplier = () => {
    if (!supplierToDelete) return;
    const name = supplierToDelete.name;
    const res = store.deleteSupplier(supplierToDelete.id, householdId);
    if (res.success) {
      showToast(
        isHindi
          ? `सप्लायर "${name}" को डायरेक्टरी से हटा दिया गया`
          : `Supplier "${name}" removed from directory`
      );
      setSupplierToDelete(null);
      setRefreshKey((k) => k + 1);
    } else {
      showToast(res.message || 'Failed to remove supplier');
    }
  };

  // Filter suppliers by search
  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearch.trim()) return true;
    const q = supplierSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.preferred_brands && s.preferred_brands.some((b) => b.toLowerCase().includes(q)))
    );
  });

  // Group current active list items by supplier
  const groupedItems: Record<string, NonNullable<typeof activeList>['items']> = {};
  if (activeList && activeList.items) {
    for (const item of activeList.items) {
      const supName = item.supplier_name || 'General Wholesale';
      if (!groupedItems[supName]) groupedItems[supName] = [];
      groupedItems[supName].push(item);
    }
  }

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
            <span className="material-symbols-outlined text-[24px] text-[#1A3826]">local_shipping</span>
            <h1 className="text-[20px] font-bold text-[#1a1c1a]">
              {isHindi ? 'सप्लायर खरीदारी और खरीद ऑर्डर' : 'Commercial Procurement & Goods Received'}
            </h1>
          </div>
          <p className="text-[12px] text-[#727972] mt-0.5">
            {isHindi
              ? 'अनुबंधित सप्लायरों के सम्पर्क, पार लेवल और आगामी ऑर्डर मांग के आधार पर खरीद प्रबंधन'
              : 'Contracted supplier directory, contractor contacts, par levels, and purchase orders'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateList}
            className="px-4 py-2 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
            <span>{isHindi ? '⚡ ऑटो-जेनरेट PO' : '⚡ Auto-Generate PO'}</span>
          </button>
        </div>
      </div>

      {/* CONTRACTED SUPPLIERS DIRECTORY */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6E4DD] shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#1A3826]">contacts</span>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? 'अनुबंधित सप्लायर्स और ठेकेदार' : 'Contracted Suppliers & Vendor Contacts'}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#1A3826]/10 text-[#1A3826] text-[11px] font-bold">
              {suppliers.length}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#727972]">
                search
              </span>
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder={isHindi ? 'सप्लायर खोजें...' : 'Search contractors...'}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] text-[12px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenAddSupplier}
              className="px-3.5 py-1.5 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white text-[12px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>{isHindi ? 'सप्लायर जोड़ें' : 'Add Supplier'}</span>
            </button>
          </div>
        </div>

        {/* Suppliers Grid */}
        {filteredSuppliers.length === 0 ? (
          <div className="p-6 text-center text-[#727972] text-[12.5px] border border-dashed border-[#E6E4DD] rounded-xl bg-[#FAF9F6]">
            {supplierSearch
              ? (isHindi ? `"${supplierSearch}" के लिए कोई सप्लायर नहीं मिला` : `No contractors found matching "${supplierSearch}"`)
              : (isHindi ? 'अभी कोई अनुबंधित सप्लायर नहीं है। नया सप्लायर जोड़ें।' : 'No contracted suppliers registered. Click "Add Supplier" above.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSuppliers.map((sup) => {
              const cleanPhone = sup.phone.replace(/[^0-9]/g, '');
              const whatsappUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(`Hello ${sup.name}, sending commercial procurement order from KitchenSync Cloud Kitchen.`)}`;

              return (
                <div
                  key={sup.id}
                  className="p-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] hover:bg-white hover:border-[#1A3826]/40 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                >
                  {/* Top info */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[14px] text-[#1a1c1a] flex items-center gap-1.5">
                          <span>{sup.name}</span>
                        </div>
                        {sup.contact_person && (
                          <div className="text-[11px] text-[#424843] flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[13px] text-[#727972]">person</span>
                            <span>{isHindi ? 'सम्पर्क व्यक्ति:' : 'Contact:'} <strong>{sup.contact_person}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-[#1A3826]/10 text-[#1A3826] text-[10.5px] font-semibold whitespace-nowrap">
                          ⚡ {sup.lead_time_hours}h lead
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#727972] font-medium bg-white px-2 py-1 rounded-lg border border-[#E6E4DD]/60">
                      {sup.category}
                    </div>

                    {/* Contact Details */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#424843] pt-0.5">
                      <div className="flex items-center gap-1 font-semibold text-[#1A3826]">
                        <span className="material-symbols-outlined text-[13px]">phone</span>
                        <a href={`tel:${sup.phone}`} className="hover:underline">
                          {sup.phone}
                        </a>
                      </div>

                      {sup.email && (
                        <div className="flex items-center gap-1 text-[#727972]">
                          <span className="material-symbols-outlined text-[13px]">mail</span>
                          <a href={`mailto:${sup.email}`} className="hover:underline truncate max-w-[150px]">
                            {sup.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {sup.address && (
                      <div className="text-[10.5px] text-[#727972] flex items-start gap-1">
                        <span className="material-symbols-outlined text-[13px] mt-0.5 text-[#727972]">location_on</span>
                        <span className="line-clamp-1">{sup.address}</span>
                      </div>
                    )}

                    {/* Preferred Brands */}
                    {sup.preferred_brands && sup.preferred_brands.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[9.5px] text-[#727972] font-bold uppercase tracking-wider">
                          {isHindi ? 'ब्रांड्स:' : 'Brands:'}
                        </span>
                        {sup.preferred_brands.map((brand, bIdx) => (
                          <span
                            key={bIdx}
                            className="px-1.5 py-0.5 bg-white border border-[#E6E4DD] rounded text-[10px] text-[#424843]"
                          >
                            {brand}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notes / Terms */}
                    {sup.notes && (
                      <div className="text-[10px] text-[#5A605B] italic bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/50 mt-0.5">
                        &ldquo;{sup.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-[#E6E4DD] flex items-center justify-between gap-1.5 mt-1">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${sup.phone}`}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E4DD] text-[11px] font-semibold text-[#1A3826] hover:bg-[#F4F3EE] flex items-center gap-1 transition-colors"
                        title="Call Contractor"
                      >
                        <span className="material-symbols-outlined text-[13px]">call</span>
                        <span>{isHindi ? 'कॉल' : 'Call'}</span>
                      </a>

                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[13px] text-emerald-700">chat</span>
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSupplier(sup)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E4DD] text-[11px] font-bold text-[#424843] hover:text-[#1A3826] hover:border-[#1A3826] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">edit</span>
                        <span>{isHindi ? 'संपादित' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSupplierToDelete(sup)}
                        className="p-1 rounded-lg text-[#9E2A2B] hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        title={isHindi ? 'सप्लायर हटाएं' : 'Remove Supplier'}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVE PURCHASE LIST / PO */}
      {activeList ? (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6E4DD] shadow-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#E6E4DD] gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[#1a1c1a]">
                  Purchase Order #{activeList.id.slice(-6)}
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  activeList.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeList.status}
                </span>
              </div>
              <div className="text-[11px] text-[#727972]">
                Date: {activeList.date} • Total Estimated Cost: <strong>₹{activeList.total_estimated_cost_inr}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  showToast('Purchase order dispatched to suppliers via WhatsApp');
                }}
                className="px-3.5 py-1.5 rounded-xl border border-[#E6E4DD] text-[11.5px] font-bold text-[#424843] hover:bg-gray-50 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                <span>Share PO</span>
              </button>

              {activeList.status !== 'received' && (
                <button
                  type="button"
                  onClick={() => setShowGoodsReceiveModal(true)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>{isHindi ? '📥 माल प्राप्त हुआ (Check-in)' : '📥 Goods Received'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Grouped by Supplier */}
          <div className="flex flex-col gap-4">
            {Object.entries(groupedItems).map(([supplierName, items]) => (
              <div key={supplierName} className="border border-[#E6E4DD] rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-[#FAF9F6] px-3.5 py-2 border-b border-[#E6E4DD] font-bold text-[12.5px] text-[#1A3826] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">store</span>
                    <span>{supplierName}</span>
                  </div>
                  <span className="text-[11px] text-[#727972] font-normal">{items.length} items</span>
                </div>

                <div className="divide-y divide-[#F0EFEA]">
                  {items.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-[12px] bg-white hover:bg-gray-50/50">
                      <div>
                        <div className="font-bold text-[#1a1c1a]">{it.name}</div>
                        <div className="text-[10.5px] text-[#727972]">
                          Current: {it.current_stock} {it.unit} • Par Target: {it.par_level} {it.unit}
                          {it.preferred_brand && ` • Brand: ${it.preferred_brand}`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-[#1A3826]">
                          Order: {it.needed_qty} {it.unit}
                        </div>
                        <div className="text-[10.5px] text-[#727972]">
                          Est: ₹{it.estimated_price_inr}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-[#E6E4DD] text-center flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[40px] text-gray-300">shopping_cart_checkout</span>
          <span className="text-[14px] font-bold text-[#1a1c1a]">No Active Purchase List</span>
          <p className="text-[12px] text-[#727972] max-w-sm">
            Click &ldquo;Auto-Generate PO&rdquo; to evaluate inventory par levels and upcoming orders to build a procurement list.
          </p>
        </div>
      )}

      {/* ADD / EDIT SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 flex flex-col gap-4 shadow-xl my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#1A3826]">
                  {editingSupplier ? 'edit_note' : 'person_add'}
                </span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  {editingSupplier
                    ? (isHindi ? 'सप्लायर और कॉन्टैक्ट विवरण संपादित करें' : 'Edit Supplier & Contractor Details')
                    : (isHindi ? 'नया अनुबंधित सप्लायर जोड़ें' : 'Add New Contracted Supplier')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="text-[#727972] hover:text-[#1a1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-[12px] flex items-center gap-2 border border-red-200">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="flex flex-col gap-3.5 text-[12.5px]">
              {/* Name & Contact Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'सप्लायर / फर्म का नाम *' : 'Supplier / Firm Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Krishna Dairy & Cold Store"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'सम्पर्क व्यक्ति (Contact Person)' : 'Contact Person Name'}
                  </label>
                  <input
                    type="text"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'फोन / मोबाइल नंबर *' : 'Phone / Mobile Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +91 98234 11223"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'ईमेल (वैकल्पिक)' : 'Email Address (Optional)'}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. orders@krishnadairy.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>
              </div>

              {/* Category & Lead Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'सप्लाई श्रेणी (Category)' : 'Supply Category'}
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Dairy (पनीर, मक्खन, क्रीम, दूध)"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {DEFAULT_CATEGORIES.map((cat, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => setFormCategory(cat)}
                        className={`text-[9.5px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          formCategory === cat
                            ? 'bg-[#1A3826] text-white border-[#1A3826]'
                            : 'bg-gray-100 text-[#424843] border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {cat.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#424843] mb-1">
                    {isHindi ? 'लीड टाइम (घंटे)' : 'Lead Time (Hours)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={formLeadTime}
                    onChange={(e) => setFormLeadTime(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>
              </div>

              {/* Preferred Brands */}
              <div>
                <label className="block text-[11px] font-bold text-[#424843] mb-1">
                  {isHindi ? 'पसंदीदा ब्रांड्स (अल्पविराम से अलग करें)' : 'Preferred Brands (Comma separated)'}
                </label>
                <input
                  type="text"
                  value={formBrands}
                  onChange={(e) => setFormBrands(e.target.value)}
                  placeholder="e.g. Amul, Gowardhan, Desi Fresh, Local Mandi"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              {/* Physical Address / Mandi Stall */}
              <div>
                <label className="block text-[11px] font-bold text-[#424843] mb-1">
                  {isHindi ? 'दुकान / मंडी पता (वैकल्पिक)' : 'Address / Mandi Stall Location (Optional)'}
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Stall #14, APMC Fruit & Veg Wholesale Yard"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              {/* Notes / Contract Terms */}
              <div>
                <label className="block text-[11px] font-bold text-[#424843] mb-1">
                  {isHindi ? 'ठेका शर्तें व नोट्स (Contract Terms & Notes)' : 'Contract Terms & Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Morning 6 AM delivery, net 15 days payment, weekly billing"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E6E4DD]">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E6E4DD] font-semibold text-[#424843] hover:bg-gray-50 cursor-pointer"
                >
                  {isHindi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white font-bold cursor-pointer transition-colors shadow-xs"
                >
                  {editingSupplier
                    ? (isHindi ? 'सहेजें (Save Changes)' : 'Save Changes')
                    : (isHindi ? 'सप्लायर जोड़ें' : 'Save Supplier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE SUPPLIER CONFIRMATION MODAL */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 flex flex-col gap-3.5 shadow-xl">
            <div className="w-10 h-10 rounded-full bg-red-100 text-[#9E2A2B] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">delete_forever</span>
            </div>

            <div>
              <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                {isHindi ? 'सप्लायर हटाएं?' : 'Remove Supplier?'}
              </h3>
              <p className="text-[12px] text-[#727972] mt-1">
                {isHindi
                  ? `क्या आप वाकई "${supplierToDelete.name}" को अपने अनुबंधित सप्लायर डायरेक्टरी से हटाना चाहते हैं?`
                  : `Are you sure you want to remove "${supplierToDelete.name}" from your active contractor list?`}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-[#E6E4DD] text-[12px] font-semibold text-[#424843] hover:bg-gray-50 cursor-pointer"
              >
                {isHindi ? 'नहीं, रखें' : 'Keep'}
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
                className="px-4 py-2 rounded-xl bg-[#9E2A2B] hover:bg-red-800 text-white text-[12px] font-bold cursor-pointer transition-colors shadow-xs"
              >
                {isHindi ? 'हटाएं' : 'Remove Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOODS RECEIVED CONFIRMATION MODAL */}
      {showGoodsReceiveModal && activeList && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-700">verified</span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">Confirm Goods Received</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoodsReceiveModal(false)}
                className="text-[#727972] hover:text-[#1a1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-[12px] text-[#5A605B]">
              Verifying invoice &amp; delivery ticket. Confirming will immediately increment your stock inventory and log entries to the immutable Audit Ledger.
            </p>

            <div className="max-h-48 overflow-y-auto border border-[#E6E4DD] rounded-xl p-2 bg-[#FAF9F6] flex flex-col gap-1.5 text-[11.5px]">
              {activeList.items.map((i, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-[#E6E4DD]">
                  <span className="font-bold text-[#1a1c1a]">{i.name}</span>
                  <span className="text-emerald-700 font-bold">+{i.needed_qty} {i.unit}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
              <button
                type="button"
                onClick={() => setShowGoodsReceiveModal(false)}
                className="px-3.5 py-2 rounded-xl border border-[#E6E4DD] text-[12px] font-semibold text-[#424843]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-bold shadow-xs cursor-pointer"
              >
                Confirm Receipt &amp; Restock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
