import React from 'react';

export type NavTab = 'home' | 'planner' | 'recipes' | 'stock' | 'shop' | 'community' | 'household';

interface KitchenSyncNavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenVoiceAI: () => void;
  isHindi: boolean;
}

// Exactly seven tab columns, in this order, for every household type:
// Home · Plan · Recipes · Stock · Shop · Feed · Profile
// The centre Ask AI (Omnirush) button sits between Recipes and Stock; it is an action, not a tab.
const TABS: { id: NavTab; icon: string; labelEn: string; labelHi: string }[] = [
  { id: 'home', icon: 'cottage', labelEn: 'Home', labelHi: 'होम' },
  { id: 'planner', icon: 'calendar_month', labelEn: 'Plan', labelHi: 'प्लान' },
  { id: 'recipes', icon: 'menu_book', labelEn: 'Recipes', labelHi: 'रेसिपीज़' },
  { id: 'stock', icon: 'inventory_2', labelEn: 'Stock', labelHi: 'स्टॉक' },
  { id: 'shop', icon: 'shopping_bag', labelEn: 'Shop', labelHi: 'खरीदें' },
  { id: 'community', icon: 'forum', labelEn: 'Feed', labelHi: 'फ़ीड' },
  { id: 'household', icon: 'person', labelEn: 'Profile', labelHi: 'प्रोफ़ाइल' },
];

export const KitchenSyncNavbar: React.FC<KitchenSyncNavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenVoiceAI,
  isHindi,
}) => {
  const renderTab = (tab: (typeof TABS)[number]) => {
    const active = currentTab === tab.id;
    return (
      <button
        key={tab.id}
        className={`flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all ${
          active ? 'text-[#032212] font-semibold' : 'text-[#424843] hover:text-[#1a1c1a]'
        }`}
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelectTab(tab.id)}
      >
        <span
          className={`w-8 sm:w-10 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
            active ? 'bg-[#E8F0EC]' : ''
          }`}
        >
          <span
            className="material-symbols-outlined text-[21px]"
            style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {tab.icon}
          </span>
        </span>
        <span className="text-[9.5px] sm:text-[10px] font-medium mt-0.5 text-center leading-tight truncate max-w-full">
          {isHindi ? tab.labelHi : tab.labelEn}
        </span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#faf9f6]/95 backdrop-blur-xl border-t border-[#E6E4DD] pb-[calc(env(safe-area-inset-bottom,0px)+4px)]">
      <div className="flex justify-between items-center h-16 px-1 sm:px-3 max-w-xl mx-auto relative">
        {TABS.slice(0, 3).map(renderTab)}

        {/* Centre Ask AI (Omnirush) Voice Button */}
        <div className="flex flex-col items-center justify-center -mt-4 sm:-mt-5 px-0.5 sm:px-1 shrink-0">
          <button
            aria-label="बोलें / Ask AI Voice Action"
            className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1A3826] shadow-md shadow-[#1A3826]/30 text-white active:scale-95 transition-transform hover:bg-[#132a1d]"
            type="button"
            onClick={onOpenVoiceAI}
          >
            <span className="material-symbols-outlined text-[21px] sm:text-[22px]">mic</span>
          </button>
          <span className="text-[9px] sm:text-[9.5px] text-[#1a1c1a] font-bold mt-0.5">Omnirush</span>
        </div>

        {TABS.slice(3).map(renderTab)}
      </div>
    </nav>
  );
};