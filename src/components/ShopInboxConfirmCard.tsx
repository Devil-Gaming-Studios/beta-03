import React, { useState, useEffect, useCallback } from 'react';
import { store } from '../services/store';
import { BaseUnit } from '../types';

export interface ExtractedShopItem {
  name: string;
  name_hi?: string;
  quantity: number;
  unit: string;
  location?: 'fridge' | 'pantry';
  targetScope?: 'shared' | 'personal';
  notes?: string;
}

export interface ShopInboxItem {
  id: string;
  source: 'whatsapp' | 'telegram' | 'telegram_bot' | 'manual' | 'test';
  sender: string;
  rawText: string;
  timestamp: number;
  receivedAt: string;
  status: 'pending' | 'applied' | 'dismissed';
  summary?: string;
  extractedItems: ExtractedShopItem[];
}

interface ShopInboxConfirmCardProps {
  isHindi: boolean;
  onItemsApplied?: () => void;
}

// Augment window object for the Android Bridge
declare global {
  interface Window {
    AndroidBridge?: {
      onShopMessage?: (data: any) => void;
      [key: string]: any;
    };
    AndroidNative?: {
      getShopContactName?: () => string;
      setShopContactName?: (name: string) => void;
      isNotificationListenerGranted?: () => boolean;
      openNotificationSettings?: () => void;
      getServerUrl?: () => string;
      setServerUrl?: (url: string) => void;
      getAuthToken?: () => string;
      setAuthToken?: (token: string) => void;
      syncPendingMessages?: () => void;
    };
  }
}

export const ShopInboxConfirmCard: React.FC<ShopInboxConfirmCardProps> = ({
  isHindi,
  onItemsApplied,
}) => {
  const [inboxItems, setInboxItems] = useState<ShopInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editedItemsMap, setEditedItemsMap] = useState<Record<string, ExtractedShopItem[]>>({});
  const [liveToast, setLiveToast] = useState<{ sender: string; text: string; count: number } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isMonitoringPaused, setIsMonitoringPaused] = useState<boolean>(() => {
    return localStorage.getItem('kitchensync_shop_listener_paused') === 'true';
  });
  const [monitoredContact, setMonitoredContact] = useState<string>(() => {
    return localStorage.getItem('kitchensync_shop_contact') || 'Gupta Kirana Store';
  });
  const [pastedText, setPastedText] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testSender, setTestSender] = useState('Gupta Kirana Store');
  const [testSource, setTestSource] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [testText, setTestText] = useState('Bhaiya 2kg aloo, 1L milk, 500g paneer pack kar ke bhej diya hai.');
  const [isSimulating, setIsSimulating] = useState(false);

  const handleTogglePause = () => {
    const nextState = !isMonitoringPaused;
    setIsMonitoringPaused(nextState);
    localStorage.setItem('kitchensync_shop_listener_paused', String(nextState));
    setActionNotice(nextState ? 'Shop chat listener paused.' : 'Shop chat listener resumed.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleClearAllStoredMessages = async () => {
    if (!window.confirm('Delete all stored shop chat messages? This cannot be undone.')) {
      return;
    }
    try {
      await fetch('/api/shop-inbox/all', { method: 'DELETE' });
      setInboxItems([]);
      setEditedItemsMap({});
      setActionNotice('All stored shop chat messages deleted.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      alert(`Failed to delete messages: ${err?.message}`);
    }
  };

  const handlePasteExtract = async () => {
    if (!pastedText.trim()) return;
    setIsPasting(true);
    try {
      const res = await fetch('/api/shop-inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_token_household_alpha',
        },
        body: JSON.stringify({
          source: 'manual',
          sender: monitoredContact || 'Shop Contact',
          text: pastedText.trim(),
          timestamp: Date.now(),
        }),
      });

      if (res.ok) {
        setPastedText('');
        setShowPasteBox(false);
        await fetchInbox();
        setActionNotice('Pasted message analyzed & added to review inbox!');
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        const err = await res.json();
        alert(`Failed to extract message: ${err?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error submitting pasted message: ${err?.message}`);
    } finally {
      setIsPasting(false);
    }
  };

  const fetchInbox = useCallback(async (silent: boolean | unknown = false) => {
    const isSilent = silent === true;
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/shop-inbox', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const items: ShopInboxItem[] = data.items || [];
        setInboxItems(items);

        // Pre-populate editable items map; keep in-progress edits for cards already on screen
        setEditedItemsMap((prev) => {
          const nextMap: Record<string, ExtractedShopItem[]> = {};
          for (const item of items) {
            nextMap[item.id] = prev[item.id] || (item.extractedItems || []).map((it) => ({ ...it }));
          }
          return nextMap;
        });
      }
    } catch (err) {
      console.warn('Failed to fetch shop inbox:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // New WhatsApp/Telegram messages arrive server-side, so poll and refresh on focus
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchInbox(true);
    };
    const timer = window.setInterval(tick, 8000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [fetchInbox]);

  useEffect(() => {
    fetchInbox();

    // Hook up Android Bridge callback
    window.AndroidBridge = window.AndroidBridge || {};
    window.AndroidBridge.onShopMessage = (data: any) => {
      console.log('Received shop message via window.AndroidBridge.onShopMessage:', data);
      const sender = data?.sender || 'Shop Contact';
      const text = data?.text || data?.rawText || '';
      const count = Array.isArray(data?.extractedItems) ? data.extractedItems.length : 1;

      setLiveToast({ sender, text, count });
      fetchInbox();

      // Clear toast after 6 seconds
      setTimeout(() => {
        setLiveToast((prev) => (prev?.sender === sender ? null : prev));
      }, 6000);
    };

    return () => {
      if (window.AndroidBridge) {
        delete window.AndroidBridge.onShopMessage;
      }
    };
  }, [fetchInbox]);

  const handleItemFieldChange = (
    inboxId: string,
    index: number,
    field: keyof ExtractedShopItem,
    value: any
  ) => {
    setEditedItemsMap((prev) => {
      const currentList = prev[inboxId] ? [...prev[inboxId]] : [];
      if (!currentList[index]) return prev;
      currentList[index] = {
        ...currentList[index],
        [field]: value,
      };
      return {
        ...prev,
        [inboxId]: currentList,
      };
    });
  };

  const handleAddItemRow = (inboxId: string) => {
    setEditedItemsMap((prev) => {
      const currentList = prev[inboxId] ? [...prev[inboxId]] : [];
      currentList.push({
        name: 'New Item',
        quantity: 1,
        unit: 'pcs',
        location: 'pantry',
        targetScope: 'shared',
      });
      return {
        ...prev,
        [inboxId]: currentList,
      };
    });
  };

  const handleRemoveItemRow = (inboxId: string, index: number) => {
    setEditedItemsMap((prev) => {
      const currentList = prev[inboxId] ? [...prev[inboxId]] : [];
      currentList.splice(index, 1);
      return {
        ...prev,
        [inboxId]: currentList,
      };
    });
  };

  // Confirm and Apply items to Kitchen Stock
  const handleConfirmAndApplyToStock = async (inboxItem: ShopInboxItem) => {
    const itemsToApply = editedItemsMap[inboxItem.id] || inboxItem.extractedItems || [];
    if (itemsToApply.length === 0) {
      alert('Please add at least one item before confirming.');
      return;
    }

    try {
      // 1. Notify server that item is applied
      await fetch(`/api/shop-inbox/${inboxItem.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToApply }),
      });

      // 2. Add each item to persistent store (Stock)
      for (const it of itemsToApply) {
        const canonicalUnit: BaseUnit =
          it.unit === 'ml' ? 'ml' : it.unit === 'pcs' ? 'pcs' : 'g';
        const isFridge = it.location === 'fridge';
        const targetScope = it.targetScope === 'personal' ? 'personal' : 'shared';

        store.adjustStock(
          `ing_${it.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          'add',
          it.quantity,
          targetScope,
          `Shop Chat (${inboxItem.sender})`,
          {
            name: it.name,
            name_hi: it.name_hi,
            unit: canonicalUnit,
            location: isFridge ? 'fridge' : 'pantry',
            targetScope: targetScope,
          }
        );
      }

      setActionNotice(`Successfully added ${itemsToApply.length} item(s) from "${inboxItem.sender}" to Kitchen Stock!`);
      setTimeout(() => setActionNotice(null), 4500);

      // Refresh inbox list
      setInboxItems((prev) => prev.filter((i) => i.id !== inboxItem.id));
      if (onItemsApplied) onItemsApplied();
    } catch (e: any) {
      alert(`Error applying items: ${e?.message}`);
    }
  };

  // Add items to Shopping List instead
  const handleAddToShoppingList = async (inboxItem: ShopInboxItem) => {
    const itemsToApply = editedItemsMap[inboxItem.id] || inboxItem.extractedItems || [];
    try {
      await fetch(`/api/shop-inbox/${inboxItem.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToApply }),
      });

      for (const it of itemsToApply) {
        const canonicalUnit: BaseUnit =
          it.unit === 'ml' ? 'ml' : it.unit === 'pcs' ? 'pcs' : 'g';
        store.updateShoppingListFromChat(it.name, 'add', it.quantity, canonicalUnit);
      }

      setActionNotice(`Added ${itemsToApply.length} item(s) to Shopping List!`);
      setTimeout(() => setActionNotice(null), 4000);

      setInboxItems((prev) => prev.filter((i) => i.id !== inboxItem.id));
      if (onItemsApplied) onItemsApplied();
    } catch (e: any) {
      alert(`Error adding to shopping list: ${e?.message}`);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/shop-inbox/${id}`, { method: 'DELETE' });
      setInboxItems((prev) => prev.filter((i) => i.id !== id));
      setActionNotice('Dismissed shop message.');
      setTimeout(() => setActionNotice(null), 2500);
    } catch (e: any) {
      console.warn('Failed to dismiss:', e);
    }
  };

  const handleSimulateMessage = async () => {
    if (!testText.trim()) return;
    setIsSimulating(true);
    try {
      const res = await fetch('/api/shop-inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test_token_household_alpha',
        },
        body: JSON.stringify({
          source: testSource,
          sender: testSender.trim(),
          text: testText.trim(),
          timestamp: Date.now(),
        }),
      });

      if (res.ok) {
        setIsTestModalOpen(false);
        await fetchInbox();
        setActionNotice(`Simulated incoming ${testSource} message from "${testSender}"!`);
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        const err = await res.json();
        alert(`Simulation error: ${err.error || 'Failed to submit'}`);
      }
    } catch (err: any) {
      alert(`Failed to simulate shop message: ${err?.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Check if running inside Android WebView with native bridge
  const hasAndroidNative = typeof window !== 'undefined' && Boolean(window.AndroidNative);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Live Toast from AndroidBridge.onShopMessage */}
      {liveToast && (
        <div className="bg-[#032212] text-white p-3.5 rounded-2xl shadow-xl border border-[#34D399]/40 flex items-start justify-between gap-3 animate-bounce">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#34D399] shrink-0 mt-0.5">
              chat
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#A7F3D0] uppercase tracking-wide">
                  Live Shop Chat Received
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#10B981]/20 text-[#34D399] text-[10px] font-semibold">
                  Android Listener
                </span>
              </div>
              <p className="text-[13px] font-bold text-white mt-0.5">{liveToast.sender}</p>
              <p className="text-[12px] text-stone-300 line-clamp-1 italic">"{liveToast.text}"</p>
            </div>
          </div>
          <button
            onClick={() => setLiveToast(null)}
            className="text-stone-400 hover:text-white p-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Action Notification */}
      {actionNotice && (
        <div className="bg-[#1A3826] text-white text-[12.5px] font-medium px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between gap-2 border border-[#81a28a]/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px] text-[#c8ebd1]">check_circle</span>
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Main Card Header */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8F0EC] text-[#1E4620] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">mark_chat_unread</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'दुकानदार चैट इनबॉक्स' : 'Shop Chat Listener'}
                </h3>
                {inboxItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-bold animate-pulse">
                    {inboxItems.length} {inboxItems.length === 1 ? 'Pending' : 'Pending'}
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#727972]">
                {isHindi
                  ? 'WhatsApp/Telegram से प्राप्त किराने के ऑर्डर - पुष्टि के बाद ही स्टॉक में जुड़ेंगे'
                  : 'Incoming WhatsApp/Telegram orders • Items applied only after your confirmation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchInbox()}
              disabled={loading}
              className="p-1.5 rounded-xl border border-[#E6E4DD] text-[#424843] hover:bg-[#faf9f6] text-[12px] flex items-center gap-1"
              title="Refresh inbox"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFF7ED] border border-[#FC8019]/30 text-[#EA580C] text-[11.5px] font-bold flex items-center gap-1 hover:bg-[#FFEDD5] transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">content_paste</span>
              <span>Paste / Web Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#EDF2EE] border border-[#137333]/30 text-[#137333] text-[11.5px] font-bold flex items-center gap-1 hover:bg-[#dbe7de] transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">send_time_extension</span>
              <span>Test Chat</span>
            </button>
          </div>
        </div>

        {/* Privacy & Monitoring Notice Banner */}
        <div className="bg-[#FAF9F6] border border-[#E6E4DD] rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-[11.5px]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#137333] shrink-0 mt-0.5">
              shield_person
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#1a1c1a]">
                  Monitored Shop Contact:
                </span>
                <span className="font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[#1A3826]">
                  {monitoredContact}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isMonitoringPaused
                      ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
                      : 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]'
                  }`}
                >
                  {isMonitoringPaused ? 'PAUSED' : 'ACTIVE'}
                </span>
              </div>
              <p className="text-[#727972] text-[10.5px] mt-0.5">
                Strict privacy: Only notifications from this shop contact are processed. All other personal chats and messages are never read or stored.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleTogglePause}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                isMonitoringPaused
                  ? 'bg-[#15803D] text-white border-[#15803D]'
                  : 'bg-white text-[#424843] border-[#E6E4DD] hover:bg-[#f0eee6]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">
                {isMonitoringPaused ? 'play_arrow' : 'pause'}
              </span>
              <span>{isMonitoringPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              type="button"
              onClick={handleClearAllStoredMessages}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#9E2A2B] hover:bg-[#FEE2E2] border border-transparent hover:border-[#FCA5A5] transition-all flex items-center gap-1"
              title="Delete all stored messages from server"
            >
              <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
              <span>Delete All</span>
            </button>
          </div>
        </div>

        {/* Fallback for Web-only / iPhone Users: Paste & WhatsApp deep link */}
        {showPasteBox && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#92400E]">
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                <span>Paste or Share Shop Message (Web & iPhone Fallback)</span>
              </div>
              <a
                href="https://wa.me/?text=Hi%2C%20please%20send%20the%20grocery%20order%20status%20or%20bill"
                target="_blank"
                rel="noreferrer"
                className="px-2 py-0.5 rounded-lg bg-[#25D366] text-white text-[11px] font-bold flex items-center gap-1 hover:bg-[#20ba59]"
              >
                <span className="material-symbols-outlined text-[13px]">chat</span>
                <span>Open WhatsApp</span>
              </a>
            </div>

            <textarea
              rows={2}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste WhatsApp/SMS shop text here (e.g., 'Bhaiya 5kg atta, 2L amul milk, 1kg aloo pack ready hai')..."
              className="w-full bg-white border border-[#FDE68A] rounded-lg p-2 text-[12.5px] text-[#1a1c1a] focus:border-[#B45309] outline-none resize-none"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-[#B45309]">
                Gemini extracts items with Hindi transliteration & base units before user review.
              </span>
              <button
                type="button"
                onClick={handlePasteExtract}
                disabled={isPasting || !pastedText.trim()}
                className="px-3 py-1 rounded-lg bg-[#D97706] text-white text-[11.5px] font-bold hover:bg-[#B45309] transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {isPasting ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">neurology</span>
                )}
                <span>Extract with Gemini</span>
              </button>
            </div>
          </div>
        )}

        {/* Status notice when running in Android WebView vs Browser */}
        {hasAndroidNative && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2 flex items-center justify-between text-[11.5px] text-[#166534]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#16a34a]">android</span>
              <span>
                Native Android Shop Listener Active (Contact: <strong>{window.AndroidNative?.getShopContactName?.() || monitoredContact}</strong>)
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.AndroidNative?.openNotificationSettings?.()}
              className="font-bold underline hover:text-[#14532d]"
            >
              Settings
            </button>
          </div>
        )}

        {/* Empty State */}
        {inboxItems.length === 0 && !loading && (
          <div className="py-6 px-4 text-center rounded-xl bg-[#faf9f6] border border-dashed border-[#E6E4DD]">
            <span className="material-symbols-outlined text-[32px] text-[#727972]">inbox</span>
            <p className="text-[13px] font-bold text-[#1a1c1a] mt-1.5">No pending shop orders</p>
            <p className="text-[11.5px] text-[#727972] mt-0.5 max-w-sm mx-auto">
              Messages received from your configured shopkeeper on WhatsApp or Telegram will appear here for review and confirmation.
            </p>
            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-[#1A3826] text-white text-[11.5px] font-semibold inline-flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[15px]">add_comment</span>
              <span>Simulate an Incoming Chat</span>
            </button>
          </div>
        )}

        {/* Pending Items List */}
        {inboxItems.map((inboxItem) => {
          const currentItems = editedItemsMap[inboxItem.id] || inboxItem.extractedItems || [];
          const sourceBadge =
            inboxItem.source === 'whatsapp'
              ? { name: 'WhatsApp', color: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]', icon: 'chat' }
              : inboxItem.source === 'telegram'
              ? { name: 'Telegram', color: 'bg-[#E0F2FE] text-[#0369A1] border-[#7DD3FC]', icon: 'send' }
              : inboxItem.source === 'telegram_bot'
              ? { name: 'Telegram Bot', color: 'bg-[#F3E8FF] text-[#7E22CE] border-[#D8B4FE]', icon: 'smart_toy' }
              : { name: 'Manual/Test', color: 'bg-[#F4F4F5] text-[#3F3F46] border-[#D4D4D8]', icon: 'input' };

          return (
            <div
              key={inboxItem.id}
              className="bg-[#faf9f6] rounded-xl p-3.5 border border-[#E6E4DD] shadow-xs flex flex-col gap-3"
            >
              {/* Message Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1 ${sourceBadge.color}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{sourceBadge.icon}</span>
                    <span>{sourceBadge.name}</span>
                  </span>
                  <span className="text-[13px] font-bold text-[#1a1c1a]">{inboxItem.sender}</span>
                  <span className="text-[11px] text-[#727972]">
                    {new Date(inboxItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDismiss(inboxItem.id)}
                  className="text-[#727972] hover:text-[#9E2A2B] p-1 rounded-md hover:bg-[#fce8e8] transition-all"
                  title="Dismiss order"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              {/* Raw Message Card (Untrusted boundary) */}
              <div className="bg-white rounded-lg p-2.5 border border-[#E6E4DD] text-[12px] text-[#424843]">
                <div className="flex items-center justify-between text-[10px] text-[#727972] uppercase font-bold tracking-wider mb-1">
                  <span>Original Chat Message</span>
                  <span className="text-[#137333] flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">security</span>
                    Untrusted Input Handled
                  </span>
                </div>
                <p className="italic text-[#1a1c1a] bg-[#faf9f6] p-2 rounded border border-[#E6E4DD]/60">
                  "{inboxItem.rawText}"
                </p>
                {inboxItem.summary && (
                  <p className="mt-1 text-[11px] text-[#1A3826] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-[#137333]">neurology</span>
                    <span>{inboxItem.summary}</span>
                  </p>
                )}
              </div>

              {/* Extracted Items Confirm-and-Edit Form */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#1a1c1a] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-[#137333]">checklist</span>
                    <span>Extracted Items ({currentItems.length}) - Edit & Confirm</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddItemRow(inboxItem.id)}
                    className="text-[11px] font-bold text-[#137333] hover:underline flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                    <span>Add Item</span>
                  </button>
                </div>

                {currentItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg p-2 border border-[#E6E4DD] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    {/* Item Name */}
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemFieldChange(inboxItem.id, idx, 'name', e.target.value)}
                        className="w-full text-[12.5px] font-bold text-[#1a1c1a] border-b border-transparent hover:border-[#E6E4DD] focus:border-[#1A3826] outline-none px-1 py-0.5"
                        placeholder="Item name"
                      />
                      {item.notes && (
                        <span className="text-[10px] text-[#727972] px-1 block">{item.notes}</span>
                      )}
                    </div>

                    {/* Quantity & Unit */}
                    <div className="flex items-center gap-1 w-full sm:w-auto">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemFieldChange(inboxItem.id, idx, 'quantity', Math.max(1, parseFloat(e.target.value) || 1))
                        }
                        className="w-16 px-1.5 py-0.5 text-[12px] font-bold text-center border border-[#E6E4DD] rounded-md focus:border-[#1A3826] outline-none"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemFieldChange(inboxItem.id, idx, 'unit', e.target.value)}
                        className="px-1.5 py-0.5 text-[11.5px] border border-[#E6E4DD] rounded-md focus:border-[#1A3826] outline-none bg-white font-medium"
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>

                    {/* Location & Scope Toggles */}
                    <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                      {/* Fridge vs Pantry */}
                      <button
                        type="button"
                        onClick={() =>
                          handleItemFieldChange(
                            inboxItem.id,
                            idx,
                            'location',
                            item.location === 'fridge' ? 'pantry' : 'fridge'
                          )
                        }
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-0.5 border transition-all ${
                          item.location === 'fridge'
                            ? 'bg-[#E0F2FE] border-[#7DD3FC] text-[#0369A1]'
                            : 'bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]'
                        }`}
                        title="Storage Location"
                      >
                        <span>{item.location === 'fridge' ? '❄️ Fridge' : '🥫 Pantry'}</span>
                      </button>

                      {/* Shared vs Personal */}
                      <button
                        type="button"
                        onClick={() =>
                          handleItemFieldChange(
                            inboxItem.id,
                            idx,
                            'targetScope',
                            item.targetScope === 'personal' ? 'shared' : 'personal'
                          )
                        }
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-0.5 border transition-all ${
                          item.targetScope === 'personal'
                            ? 'bg-[#F3E8FF] border-[#D8B4FE] text-[#7E22CE]'
                            : 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                        }`}
                        title="Household Scope"
                      >
                        <span>{item.targetScope === 'personal' ? '👤 Personal' : '👥 Shared'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(inboxItem.id, idx)}
                        className="p-1 text-[#727972] hover:text-[#9E2A2B] rounded"
                        title="Delete item"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#E6E4DD]/60">
                <button
                  type="button"
                  onClick={() => handleAddToShoppingList(inboxItem)}
                  className="px-3 py-1.5 rounded-xl border border-[#FC8019]/40 bg-[#FFF7ED] text-[#EA580C] text-[11.5px] font-bold hover:bg-[#FFEDD5] transition-all"
                >
                  Add to Shop List
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAndApplyToStock(inboxItem)}
                  className="px-4 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-bold shadow-xs hover:bg-[#132a1d] active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#c8ebd1]">check</span>
                  <span>Confirm & Add to Stock</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator Modal for Testing */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-[#E6E4DD] shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#137333]">send_time_extension</span>
                <h3 className="text-[16px] font-bold text-[#1a1c1a]">Simulate Incoming Shop Chat</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-[#727972] hover:text-[#1a1c1a] p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-[12px] text-[#727972]">
              Test how the backend Gemini extractor validates, sanitizes, and extracts items from a kirana shopkeeper's message without needing an Android phone.
            </p>

            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#1a1c1a] block mb-1">Source Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestSource('whatsapp')}
                    className={`py-1.5 px-3 rounded-xl text-[12px] font-bold border transition-all ${
                      testSource === 'whatsapp'
                        ? 'bg-[#DCFCE7] text-[#15803D] border-[#15803D]'
                        : 'bg-white text-[#727972] border-[#E6E4DD]'
                    }`}
                  >
                    💬 WhatsApp (com.whatsapp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestSource('telegram')}
                    className={`py-1.5 px-3 rounded-xl text-[12px] font-bold border transition-all ${
                      testSource === 'telegram'
                        ? 'bg-[#E0F2FE] text-[#0369A1] border-[#0369A1]'
                        : 'bg-white text-[#727972] border-[#E6E4DD]'
                    }`}
                  >
                    ✈️ Telegram (org.telegram.messenger)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#1a1c1a] block mb-1">Sender Name (Shopkeeper)</label>
                <input
                  type="text"
                  value={testSender}
                  onChange={(e) => setTestSender(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] font-medium text-[#1a1c1a] focus:border-[#1A3826] outline-none"
                  placeholder="e.g. Gupta Kirana Store"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#1a1c1a] block mb-1">Chat Message Text</label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E4DD] text-[13px] font-medium text-[#1a1c1a] focus:border-[#1A3826] outline-none resize-none"
                  placeholder="e.g. 5kg atta, 2L doodh, 500g paneer pack ready"
                />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTestText('5kg Aashirvaad Atta, 1L Amul Gold Milk, 500g fresh paneer ready for pickup.')}
                  className="text-[10.5px] bg-[#faf9f6] border border-[#E6E4DD] px-2 py-1 rounded-md text-[#424843] hover:bg-[#f0eee6]"
                >
                  Preset 1: Atta + Milk + Paneer
                </button>
                <button
                  type="button"
                  onClick={() => setTestText('Bhaiya 2kg desi aloo, 1kg pyaz, 500g tamatar aur 1 bunch dhaniya dal diya hai bill 180 rs')}
                  className="text-[10.5px] bg-[#faf9f6] border border-[#E6E4DD] px-2 py-1 rounded-md text-[#424843] hover:bg-[#f0eee6]"
                >
                  Preset 2: Vegetables & Bill
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E4DD]">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#E6E4DD] text-[12px] font-medium text-[#727972] hover:bg-[#faf9f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSimulateMessage}
                disabled={isSimulating}
                className="px-4 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-bold hover:bg-[#132a1d] shadow-sm flex items-center gap-1.5"
              >
                {isSimulating ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">send</span>
                )}
                <span>{isSimulating ? 'Processing with Gemini...' : 'Send to Shop Inbox'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
