import React, { useState } from 'react';
import { store } from '../services/store';
import {
  CloudOrder,
  OrderStatus,
  OrderSource,
  PaymentStatus,
  CloudKitchenRole,
} from '../types';
import { canPerformCloudAction } from '../services/cloudKitchenService';
import { shareNative } from '../utils/nativeApp';

interface CloudKitchenHomeProps {
  isHindi: boolean;
  onNavigate: (tab: any) => void;
  onOpenVoice: () => void;
}

const STATUS_COLUMNS: {
  status: OrderStatus;
  labelEn: string;
  labelHi: string;
  color: string;
  bgLight: string;
  icon: string;
}[] = [
  { status: 'new', labelEn: 'New Orders', labelHi: 'नए ऑर्डर्स', color: 'text-amber-800 border-amber-300', bgLight: 'bg-amber-50', icon: 'new_releases' },
  { status: 'accepted', labelEn: 'Accepted', labelHi: 'स्वीकृत (Reserved)', color: 'text-blue-800 border-blue-300', bgLight: 'bg-blue-50', icon: 'check_circle' },
  { status: 'preparing', labelEn: 'Cooking / In Prep', labelHi: 'तैयार हो रहा है', color: 'text-purple-800 border-purple-300', bgLight: 'bg-purple-50', icon: 'skillet' },
  { status: 'ready', labelEn: 'Ready / Packing', labelHi: 'तैयार / पैकिंग', color: 'text-emerald-800 border-emerald-300', bgLight: 'bg-emerald-50', icon: 'inventory' },
  { status: 'delivered', labelEn: 'Delivered', labelHi: 'डिलीवर हो गया', color: 'text-gray-700 border-gray-300', bgLight: 'bg-gray-100', icon: 'done_all' },
];

export const CloudKitchenHome: React.FC<CloudKitchenHomeProps> = ({
  isHindi,
  onNavigate,
  onOpenVoice,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const me = store.getMe();
  const householdId = me.household.id;
  const currentRole = store.getCloudKitchenRole(householdId);
  const isPureVeg = store.isPureVegOnly(householdId);

  const orders = store.getCloudOrders(householdId);
  const batches = store.getBatches(householdId);
  const menuItems = store.getMenuItems(householdId);
  const stockItems = store.getStock();

  // Modals
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [showKOTModal, setShowKOTModal] = useState<CloudOrder | null>(null);
  const [statusOverrideModal, setStatusOverrideModal] = useState<{
    orderId: string;
    nextStatus: OrderStatus;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Order Form state
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [orderSource, setOrderSource] = useState<OrderSource>('walk_in');
  const [orderNotes, setOrderNotes] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [orderCart, setOrderCart] = useState<{ menuItemId: string; qty: number; variantName?: string }[]>([]);

  // Announce cooking state
  const [announceItemId, setAnnounceItemId] = useState(menuItems[0]?.id || '');
  const [announcePortions, setAnnouncePortions] = useState(20);
  const [announceOverride, setAnnounceOverride] = useState(false);
  const [announceOverrideReason, setAnnounceOverrideReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const reload = () => setRefreshKey((k) => k + 1);

  // Stats
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const cookingBatches = batches.filter((b) => b.status === 'cooking' || b.status === 'announced');
  const todayRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total_amount_inr, 0);

  // Low stock shortage warnings
  const lowStockCount = Object.values(stockItems).filter((s) => s.qty_base < (s.unit_base === 'pcs' ? 10 : 2000)).length;

  const handleRoleChange = (newRole: CloudKitchenRole) => {
    store.setCloudKitchenRole(newRole, householdId);
    showToast(isHindi ? `रोल बदला: ${newRole.toUpperCase()}` : `Switched role to ${newRole.toUpperCase()}`);
    reload();
  };

  const handleTogglePureVeg = () => {
    const next = !isPureVeg;
    store.setPureVegOnly(next, householdId);
    showToast(
      next
        ? (isHindi ? 'शुद्ध शाकाहारी किचन सक्रिय (नॉन-वेज व्यंजन छिपे)' : 'Pure Veg Kitchen enabled (Non-veg dishes hidden)')
        : (isHindi ? 'सभी व्यंजन दिखाई दे रहे हैं' : 'All items visible')
    );
    reload();
  };

  const handleAdvanceOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    const res = store.updateCloudOrderStatus(orderId, nextStatus, overrideReason || undefined, householdId);
    if (!res.success) {
      showToast(res.message || 'Error updating order status');
    } else {
      showToast(isHindi ? `ऑर्डर स्टेटस अपडेट हुआ: ${nextStatus}` : `Order moved to ${nextStatus}`);
      setStatusOverrideModal(null);
      setOverrideReason('');
      reload();
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderCart.length === 0) {
      showToast(isHindi ? 'कृपया कम से कम 1 व्यंजन चुनें' : 'Please select at least 1 menu item');
      return;
    }

    const created = store.createCloudOrder(
      {
        customer_name: custName.trim() || 'Walk-in Guest',
        customer_phone: custPhone.trim(),
        source: orderSource,
        notes: orderNotes.trim(),
        scheduled_time: scheduledTime || 'Immediate',
        payment_status: 'paid',
        items: orderCart.map((c) => {
          const item = menuItems.find((m) => m.id === c.menuItemId);
          return {
            menu_item_id: c.menuItemId,
            quantity: c.qty,
            variant_name: c.variantName,
            unit_price_inr: item?.price_inr || 150,
          };
        }),
      },
      householdId
    );

    showToast(isHindi ? `नया KOT #${created.order_number} बनाया गया!` : `New Order #${created.order_number} created!`);
    setShowNewOrderModal(false);
    setOrderCart([]);
    setCustName('');
    setCustPhone('');
    setOrderNotes('');
    reload();
  };

  const handleAnnounceBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const res = store.announceBatch(
      announceItemId,
      announcePortions,
      announceOverride,
      announceOverrideReason || undefined,
      householdId
    );

    if (!res.success) {
      showToast(res.error || 'Stock shortage! Check required ingredients.');
      setAnnounceOverride(true);
    } else {
      showToast(isHindi ? `बैच शुरू: ${announcePortions} पोर्शन तैयार!` : `Batch announced: ${announcePortions} portions!`);
      setShowAnnounceModal(false);
      setAnnounceOverride(false);
      setAnnounceOverrideReason('');
      reload();
    }
  };

  const selectedAnnounceItem = menuItems.find((m) => m.id === announceItemId);

  return (
    <div key={refreshKey} className="flex flex-col w-full pb-8 max-w-5xl mx-auto px-3 sm:px-4 gap-y-4">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-[#1A3826] text-white px-4 py-2.5 rounded-2xl text-[13px] font-semibold flex items-center gap-2 shadow-lg animate-fade-in border border-[#c8ebd1]/30">
          <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Strip: Role Switcher & Kitchen Status */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#1A3826] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <span className="material-symbols-outlined text-[24px]">kitchen</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-bold text-[#1a1c1a] tracking-tight">
                {me.household.name || 'Food Business Live Ops'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                ● LIVE
              </span>
            </div>
            <p className="text-[11.5px] text-[#727972]">
              {isHindi ? 'ऑर्डर्स, बैच कुकिंग और KDS डिस्प्ले' : 'Real-time KDS, Cook-to-Order & Inventory Follow-the-Work'}
            </p>
          </div>
        </div>

        {/* Roles & Pure Veg Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pure Veg Toggle */}
          <button
            type="button"
            onClick={handleTogglePureVeg}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPureVeg
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-500'
                : 'bg-white border-[#E6E4DD] text-[#424843] hover:bg-gray-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>{isHindi ? 'शुद्ध शाकाहारी (Pure Veg)' : 'Pure Veg Only'}</span>
          </button>

          {/* Active Role Selector */}
          <div className="flex items-center bg-[#F4F3EE] p-1 rounded-xl border border-[#E6E4DD]">
            {(['owner', 'cook', 'packer'] as CloudKitchenRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold capitalize transition-all cursor-pointer ${
                  currentRole === r
                    ? 'bg-[#1A3826] text-white shadow-xs'
                    : 'text-[#5A605B] hover:text-[#1a1c1a]'
                }`}
              >
                {r === 'owner' ? (isHindi ? 'मालिक (Owner)' : 'Owner') : r === 'cook' ? (isHindi ? 'शेफ (Cook)' : 'Cook') : (isHindi ? 'हेल्पर (Packer)' : 'Packer')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metric Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col">
          <span className="text-[11px] text-[#727972] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-amber-600">receipt_long</span>
            {isHindi ? 'सक्रिय ऑर्डर्स' : 'Active Orders'}
          </span>
          <span className="text-[22px] font-bold text-[#1a1c1a] mt-0.5">{activeOrders.length}</span>
          <span className="text-[9.5px] text-amber-700 font-medium">In KDS Prep Queue</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col">
          <span className="text-[11px] text-[#727972] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-purple-600">soup_kitchen</span>
            {isHindi ? 'पकाए जा रहे बैच' : 'Cooking Batches'}
          </span>
          <span className="text-[22px] font-bold text-[#1a1c1a] mt-0.5">{batches.length}</span>
          <span className="text-[9.5px] text-purple-700 font-medium">Portions tracked live</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col">
          <span className="text-[11px] text-[#727972] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">currency_rupee</span>
            {isHindi ? 'आज की कुल बिक्री' : 'Revenue Today'}
          </span>
          <span className="text-[22px] font-bold text-[#1a1c1a] mt-0.5">₹{todayRevenue}</span>
          <span className="text-[9.5px] text-emerald-700 font-medium">{orders.length} orders total</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col">
          <span className="text-[11px] text-[#727972] font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-rose-600">warning</span>
            {isHindi ? 'स्टॉक कमी चेतावनी' : 'Stock Alerts'}
          </span>
          <span className="text-[22px] font-bold text-rose-700 mt-0.5">{lowStockCount}</span>
          <span className="text-[9.5px] text-rose-700 font-medium">SKUs near reorder point</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAnnounceModal(true)}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#1A3826] hover:bg-[#142d1e] text-white text-[12.5px] font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">skillet</span>
          <span>{isHindi ? '🍳 मैं क्या बना रहा हूँ (बैच)' : '🍳 Announce Cooking (Batch)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowNewOrderModal(true)}
          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#1a1c1a] border border-[#E6E4DD] text-[12.5px] font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px] text-[#1A3826]">add_circle</span>
          <span>{isHindi ? '➕ नया मैनुअल ऑर्डर' : '➕ New Manual Order'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenVoice}
          className="px-3 py-2.5 rounded-xl bg-[#EDF2EE] hover:bg-[#dbe7df] text-[#032212] border border-[#c8ebd1] text-[12.5px] font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          title="बोलकर ऑर्डर या बैच दर्ज करें"
        >
          <span className="material-symbols-outlined text-[18px]">mic</span>
          <span className="hidden sm:inline">{isHindi ? 'आवाज़ से आदेश दें' : 'Voice Command'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('stock')}
          className="px-3 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#424843] border border-[#E6E4DD] text-[12px] font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[17px]">inventory_2</span>
          <span>{isHindi ? 'स्टॉक व लेजर' : 'Stock & Ledger'}</span>
        </button>
      </div>

      {/* KITCHEN DISPLAY SYSTEM (KDS) KANBAN BOARD */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#1A3826]">view_kanban</span>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? 'किचन डिस्प्ले सिस्टम (Live KDS Queue)' : 'Live Kitchen Display (KDS Prep Queue)'}
            </h2>
          </div>
          <span className="text-[11px] text-[#727972]">
            Role: <strong className="text-[#1a1c1a] capitalize">{currentRole}</strong>
          </span>
        </div>

        {/* Kanban Columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1 overflow-x-auto">
          {STATUS_COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.status);
            return (
              <div
                key={col.status}
                className={`flex flex-col rounded-xl border ${col.bgLight} border-[#E6E4DD] p-2.5 min-w-[210px] min-h-[380px]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E6E4DD]">
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined text-[16px] ${col.color}`}>{col.icon}</span>
                    <span className="text-[12px] font-bold text-[#1a1c1a]">
                      {isHindi ? col.labelHi : col.labelEn}
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white border border-[#E6E4DD] text-[10.5px] font-bold flex items-center justify-center text-[#424843]">
                    {colOrders.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-0.5">
                  {colOrders.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-[#9aa09a] italic">
                      {isHindi ? 'कोई ऑर्डर नहीं' : 'No orders in this state'}
                    </div>
                  ) : (
                    colOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-white rounded-xl p-3 border border-[#E6E4DD] shadow-xs flex flex-col gap-2 hover:border-[#1A3826]/40 transition-all"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-extrabold text-[#1a1c1a] bg-[#F4F3EE] px-1.5 py-0.5 rounded-md">
                            #{ord.order_number}
                          </span>
                          <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-[#424843]">
                            {ord.source}
                          </span>
                        </div>

                        {/* Customer & Time */}
                        <div>
                          <div className="text-[12.5px] font-bold text-[#1a1c1a] truncate">
                            {ord.customer_name}
                          </div>
                          {ord.customer_phone && (
                            <div className="text-[10px] text-[#727972]">{ord.customer_phone}</div>
                          )}
                          <div className="text-[10px] text-emerald-800 font-medium mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            <span>{ord.scheduled_time || 'Immediate'}</span>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="border-t border-[#F0EFEA] pt-1.5 flex flex-col gap-1 text-[11.5px]">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-1">
                              <span className="text-[#1a1c1a] font-medium leading-tight">
                                <span className="font-bold text-[#1A3826]">{it.quantity}x</span> {it.name}
                                {it.variant_name && <span className="text-[9.5px] text-[#727972] block">({it.variant_name})</span>}
                              </span>
                              <span className="text-[11px] font-semibold text-[#424843] shrink-0">
                                ₹{it.total_price_inr}
                              </span>
                            </div>
                          ))}
                        </div>

                        {ord.notes && (
                          <div className="text-[10px] bg-amber-50 text-amber-900 p-1.5 rounded-lg border border-amber-200 italic">
                            &ldquo;{ord.notes}&rdquo;
                          </div>
                        )}

                        {/* Total and KOT Button */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#F0EFEA] text-[11px]">
                          <span className="font-bold text-[#1a1c1a]">Total: ₹{ord.total_amount_inr}</span>
                          <button
                            type="button"
                            onClick={() => setShowKOTModal(ord)}
                            className="text-[#1A3826] hover:underline font-bold text-[10.5px] flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">print</span>
                            <span>KOT / Bill</span>
                          </button>
                        </div>

                        {/* Workflow Actions Based on Role */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ord.status === 'new' && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrderStatus(ord.id, 'accepted')}
                              className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-all cursor-pointer"
                            >
                              {isHindi ? 'स्वीकार करें (Reserve Stock)' : 'Accept Order'}
                            </button>
                          )}

                          {ord.status === 'accepted' && canPerformCloudAction(currentRole, 'mark_cooking') && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrderStatus(ord.id, 'preparing')}
                              className="w-full py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] transition-all cursor-pointer"
                            >
                              {isHindi ? 'बनाना शुरू करें (Deduct Stock)' : 'Start Cooking'}
                            </button>
                          )}

                          {ord.status === 'preparing' && canPerformCloudAction(currentRole, 'mark_ready') && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrderStatus(ord.id, 'ready')}
                              className="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-all cursor-pointer"
                            >
                              {isHindi ? 'तैयार है (Mark Ready)' : 'Mark Ready'}
                            </button>
                          )}

                          {ord.status === 'ready' && canPerformCloudAction(currentRole, 'mark_delivered') && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrderStatus(ord.id, 'delivered')}
                              className="w-full py-1.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white font-bold text-[11px] transition-all cursor-pointer"
                            >
                              {isHindi ? 'डिलीवर किया (Dispatch)' : 'Mark Delivered'}
                            </button>
                          )}

                          {/* Cancel Order Action */}
                          {ord.status !== 'delivered' && ord.status !== 'cancelled' && currentRole === 'owner' && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceOrderStatus(ord.id, 'cancelled')}
                              className="w-full py-1 text-[10px] text-rose-700 hover:bg-rose-50 rounded font-semibold transition-all cursor-pointer"
                            >
                              {isHindi ? 'रद्द करें (Cancel & Release)' : 'Cancel Order'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIVE BATCHES SUMMARY STRIP */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[19px] text-[#1A3826]">soup_kitchen</span>
            <h2 className="text-[14px] font-bold text-[#1a1c1a]">
              {isHindi ? 'सक्रिय बैच (Cooking Now & Pools)' : 'Active Batches & Cooked Portions Available'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="text-[12px] font-bold text-[#1A3826] hover:underline flex items-center gap-1"
          >
            <span>{isHindi ? 'सभी बैच देखें' : 'View Production Planner'}</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {batches.slice(0, 3).map((b) => (
            <div key={b.id} className="p-3 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-[#1a1c1a]">{b.item_name}</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                  {b.status}
                </span>
              </div>
              <div className="text-[11px] text-[#5A605B] flex justify-between">
                <span>Cooked: {b.portions_cooked} portions</span>
                <span className="font-bold text-[#1A3826]">Remaining: {b.portions_remaining}</span>
              </div>
              <div className="text-[9.5px] text-[#727972]">
                By {b.announced_by} • {new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW ORDER MODAL */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#1A3826]">receipt_long</span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'नया मैनुअल ऑर्डर दर्ज करें' : 'Create Manual Order (KOT)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="text-[#727972] hover:text-[#1a1c1a]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#424843] block mb-1">
                    Customer Name (ग्राहक का नाम)
                  </label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6] focus:bg-white focus:outline-[#1A3826]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#424843] block mb-1">
                    Phone Number (फोन नंबर)
                  </label>
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6] focus:bg-white focus:outline-[#1A3826]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#424843] block mb-1">Source (स्रोत)</label>
                  <select
                    value={orderSource}
                    onChange={(e) => setOrderSource(e.target.value as OrderSource)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[12.5px] bg-[#FAF9F6]"
                  >
                    <option value="walk_in">Walk-in Counter</option>
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp">WhatsApp Order</option>
                    <option value="telegram">Telegram</option>
                    <option value="swiggy_manual">Swiggy (Manual)</option>
                    <option value="zomato_manual">Zomato (Manual)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#424843] block mb-1">Pickup / Schedule Time</label>
                  <input
                    type="text"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    placeholder="e.g. 8:30 PM"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                  />
                </div>
              </div>

              {/* Select Items */}
              <div>
                <label className="text-[11.5px] font-bold text-[#1a1c1a] block mb-1.5">
                  Select Menu Items (व्यंजन चुनें)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-[#E6E4DD] rounded-xl bg-[#FAF9F6]">
                  {menuItems.map((m) => {
                    const existing = orderCart.find((c) => c.menuItemId === m.id);
                    return (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg border flex items-center justify-between text-[12px] ${
                          existing ? 'bg-[#EDF2EE] border-[#1A3826]' : 'bg-white border-[#E6E4DD]'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-bold text-[#1a1c1a] truncate">{m.name}</div>
                          <div className="text-[10.5px] text-[#727972]">₹{m.price_inr} • {m.portion_size}</div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {existing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (existing.qty <= 1) {
                                    setOrderCart(orderCart.filter((c) => c.menuItemId !== m.id));
                                  } else {
                                    setOrderCart(
                                      orderCart.map((c) =>
                                        c.menuItemId === m.id ? { ...c, qty: c.qty - 1 } : c
                                      )
                                    );
                                  }
                                }}
                                className="w-6 h-6 rounded bg-gray-200 text-[#1a1c1a] font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-bold text-[12px]">{existing.qty}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setOrderCart(
                                    orderCart.map((c) =>
                                      c.menuItemId === m.id ? { ...c, qty: c.qty + 1 } : c
                                    )
                                  )
                                }
                                className="w-6 h-6 rounded bg-[#1A3826] text-white font-bold flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setOrderCart([
                                  ...orderCart,
                                  { menuItemId: m.id, qty: 1, variantName: m.variants[0]?.name },
                                ])
                              }
                              className="px-2 py-1 rounded bg-[#1A3826] text-white text-[11px] font-bold cursor-pointer"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#424843] block mb-1">
                  Preparation Notes / Customization (टिप्पणी)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Extra spicy, no onions in raita"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E6E4DD] text-[12px] font-semibold text-[#424843]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-bold shadow-xs cursor-pointer"
                >
                  Confirm &amp; Place KOT Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANNOUNCE WHAT I'M COOKING MODAL */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 flex flex-col gap-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E4DD]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[#1A3826]">skillet</span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'मैं क्या बना रहा हूँ (बैच उत्पादन)' : 'Announce Cooking Batch'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnounceModal(false)}
                className="text-[#727972] hover:text-[#1a1c1a]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAnnounceBatch} className="flex flex-col gap-3">
              <div>
                <label className="text-[11.5px] font-bold text-[#424843] block mb-1">
                  Select Dish to Cook (व्यंजन चुनें)
                </label>
                <select
                  value={announceItemId}
                  onChange={(e) => setAnnounceItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] bg-[#FAF9F6]"
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.cook_method === 'batch' ? 'Batch Dish' : 'To Order'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-[#424843] block mb-1">
                  Portions to Cook (कितने पोर्शन बनाने हैं?)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={announcePortions}
                    onChange={(e) => setAnnouncePortions(Number(e.target.value))}
                    className="w-24 px-3 py-2 rounded-xl border border-[#E6E4DD] text-[14px] font-bold text-center bg-[#FAF9F6]"
                  />
                  <div className="flex gap-1.5">
                    {[10, 20, 30, 40, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAnnouncePortions(num)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                          announcePortions === num
                            ? 'bg-[#1A3826] text-white border-[#1A3826]'
                            : 'bg-white border-[#E6E4DD] text-[#424843]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Required Ingredients Preview Table */}
              {selectedAnnounceItem && (
                <div className="border border-[#E6E4DD] rounded-xl p-2.5 bg-[#FAF9F6] flex flex-col gap-1.5 text-[11px]">
                  <span className="font-bold text-[#1a1c1a]">Required vs Available Ingredients:</span>
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                    {selectedAnnounceItem.ingredients.map((ing) => {
                      const totalNeeded = ing.qty_per_portion * announcePortions;
                      const stock = Object.values(stockItems).find((s) => s.ingredient_id === ing.ingredient_id);
                      const available = stock ? stock.qty_base : 0;
                      const isShort = available < totalNeeded && !ing.is_pinch_or_taste;

                      return (
                        <div
                          key={ing.ingredient_id}
                          className={`flex justify-between items-center px-2 py-1 rounded ${
                            isShort ? 'bg-rose-50 text-rose-900 border border-rose-200' : 'bg-white text-[#424843]'
                          }`}
                        >
                          <span>{ing.name}</span>
                          <span className="font-medium">
                            {totalNeeded} {ing.unit} <span className="opacity-60">(have: {available} {ing.unit})</span>
                            {isShort && <strong className="ml-1 text-rose-700 font-bold">⚠️ SHORT</strong>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {announceOverride && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex flex-col gap-1">
                  <span className="font-bold">⚠️ Stock Shortage Override:</span>
                  <input
                    type="text"
                    value={announceOverrideReason}
                    onChange={(e) => setAnnounceOverrideReason(e.target.value)}
                    placeholder="Enter reason e.g. Local purchase arriving soon"
                    className="w-full px-2 py-1 rounded border border-amber-300 text-[11px] bg-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#E6E4DD] text-[12px] font-semibold text-[#424843]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-bold shadow-xs cursor-pointer"
                >
                  Confirm &amp; Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KOT & BILL MODAL */}
      {showKOTModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 flex flex-col gap-4 shadow-xl border border-[#E6E4DD] font-mono">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h2 className="text-[17px] font-black uppercase tracking-wider text-[#1a1c1a]">
                {me.household.name || 'MAST MEALS FOOD BUSINESS'}
              </h2>
              <div className="text-[11px] text-gray-600">KITCHEN ORDER TICKET (KOT)</div>
              <div className="text-[15px] font-black mt-1 text-[#1A3826]">
                ORDER #{showKOTModal.order_number}
              </div>
            </div>

            <div className="text-[11.5px] flex flex-col gap-0.5 border-b border-dashed border-gray-400 pb-2">
              <div><strong>Customer:</strong> {showKOTModal.customer_name}</div>
              {showKOTModal.customer_phone && <div><strong>Phone:</strong> {showKOTModal.customer_phone}</div>}
              <div><strong>Source:</strong> {showKOTModal.source.toUpperCase()}</div>
              <div><strong>Time:</strong> {new Date(showKOTModal.created_at).toLocaleTimeString()}</div>
              <div><strong>Scheduled:</strong> {showKOTModal.scheduled_time}</div>
            </div>

            <div className="flex flex-col gap-1.5 border-b border-dashed border-gray-400 pb-2 text-[12px]">
              {showKOTModal.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span><strong>{it.quantity}x</strong> {it.name} {it.variant_name ? `(${it.variant_name})` : ''}</span>
                  <span>₹{it.total_price_inr}</span>
                </div>
              ))}
            </div>

            {showKOTModal.notes && (
              <div className="text-[11px] border-b border-dashed border-gray-400 pb-2 italic">
                Note: {showKOTModal.notes}
              </div>
            )}

            <div className="flex justify-between items-center text-[14px] font-black">
              <span>TOTAL AMOUNT:</span>
              <span>₹{showKOTModal.total_amount_inr}</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 font-sans">
              <button
                type="button"
                onClick={() => setShowKOTModal(null)}
                className="px-3 py-2 rounded-xl border border-gray-300 text-[12px] font-bold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  const kotText = [
                    `🍳 KOT / ORDER #${showKOTModal.id.slice(-6).toUpperCase()}`,
                    `Customer: ${showKOTModal.customer_name} ${showKOTModal.customer_phone ? `(${showKOTModal.customer_phone})` : ''}`,
                    `Source: ${showKOTModal.source.toUpperCase()} | Scheduled: ${showKOTModal.scheduled_time}`,
                    '---------------------------',
                    ...showKOTModal.items.map((it) => `${it.quantity}x ${it.name}${it.variant_name ? ` (${it.variant_name})` : ''} - ₹${it.total_price_inr}`),
                    '---------------------------',
                    `Total: ₹${showKOTModal.total_amount_inr} | Payment: ${showKOTModal.payment_status.toUpperCase()}`,
                    showKOTModal.notes ? `Note: ${showKOTModal.notes}` : '',
                  ].filter(Boolean).join('\n');

                  const shared = await shareNative(kotText, `KOT Order #${showKOTModal.id.slice(-6).toUpperCase()}`);
                  if (shared) showToast('KOT shared successfully');
                }}
                className="flex-1 py-2 rounded-xl bg-[#047857] text-white text-[12px] font-bold flex items-center justify-center gap-1 shadow-xs hover:bg-[#065f46]"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Share KOT</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  showToast('Sent to printer / KOT ready');
                }}
                className="flex-1 py-2 rounded-xl bg-[#1A3826] text-white text-[12px] font-bold flex items-center justify-center gap-1 hover:bg-[#132a1d]"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print KOT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
