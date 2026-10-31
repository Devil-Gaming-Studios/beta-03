import React from 'react';
import { store } from '../services/store';

export type NavTab = 'home' | 'planner' | 'recipes' | 'stock' | 'shop' | 'community' | 'household';

interface KitchenSyncNavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenVoiceAI: () => void;
  isHindi: boolean;
}

export const KitchenSyncNavbar: React.FC<KitchenSyncNavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenVoiceAI,
  isHindi,
}) => {
  const me = store.getMe();
  const isCloudKitchen = me.household.household_type === 'cloud_kitchen';
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#faf9f6]/95 backdrop-blur-xl border-t border-[#E6E4DD] pb-[calc(env(safe-area-inset-bottom,0px)+4px)]">
      <div className="flex justify-between items-center h-16 sm:h-18 px-1.5 sm:px-3 max-w-xl mx-auto relative">
        {/* 1. Home Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'home' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('home')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'home' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'home' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isCloudKitchen ? 'receipt_long' : 'cottage'}
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'ऑर्डर / KDS'
                : 'Orders / KDS'
              : isHindi
              ? 'होम'
              : 'Home'}
          </span>
        </button>

        {/* 2. Planner Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'planner' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('planner')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'planner' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'planner' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isCloudKitchen ? 'soup_kitchen' : 'calendar_month'}
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'बैच / प्रिप'
                : 'Batches'
              : isHindi
              ? 'प्लानर'
              : 'Plan'}
          </span>
        </button>

        {/* 3. Recipes Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'recipes' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('recipes')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'recipes' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'recipes' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              menu_book
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'मेन्यू'
                : 'Menu'
              : isHindi
              ? 'रेसिपीज़'
              : 'Recipes'}
          </span>
        </button>

        {/* 4. Center Ask AI Voice Button */}
        <div className="flex flex-col items-center justify-center -mt-4 sm:-mt-5 px-0.5 sm:px-1 shrink-0">
          <button
            aria-label="बोलें / Ask AI Voice Action"
            className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1A3826] shadow-md shadow-[#1A3826]/30 text-white active:scale-95 transition-transform hover:bg-[#132a1d]"
            type="button"
            onClick={onOpenVoiceAI}
          >
            <span className="material-symbols-outlined text-[21px] sm:text-[22px]">mic</span>
          </button>
          <span className="text-[9px] sm:text-[9.5px] text-[#1a1c1a] font-bold mt-0.5">
            Omnirush
          </span>
        </div>

        {/* 5. Stock Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'stock' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('stock')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'stock' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'stock' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              inventory_2
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'स्टॉक / लेजर'
                : 'Stock / Ledger'
              : isHindi
              ? 'स्टॉक'
              : 'Stock'}
          </span>
        </button>

        {/* 6. Shop Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'shop' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('shop')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'shop' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'shop' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isCloudKitchen ? 'local_shipping' : 'shopping_bag'}
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'खरीद व PO'
                : 'Purchases'
              : isHindi
              ? 'खरीदें'
              : 'Shop'}
          </span>
        </button>

        {/* Community Dish Feed Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'community' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('community')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'community' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'community' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              forum
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isHindi ? 'कम्युनिटी' : 'Feed'}
          </span>
        </button>

        {/* 7. Household Profile Tab */}
        <button
          className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
            currentTab === 'household' ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('household')}
        >
          <span
            className={`w-8 sm:w-10 h-6 sm:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'household' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] sm:text-[22px]"
              style={currentTab === 'household' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isCloudKitchen ? 'analytics' : 'manage_accounts'}
            </span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
            {isCloudKitchen
              ? isHindi
                ? 'रिपोर्ट्स'
                : 'Reports'
              : isHindi
              ? 'घर'
              : 'Profile'}
          </span>
        </button>
      </div>
    </nav>
  );
};
