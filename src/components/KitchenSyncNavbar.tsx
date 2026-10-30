import React from 'react';

export type NavTab = 'home' | 'planner' | 'stock' | 'household';

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
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#faf9f6]/95 backdrop-blur-xl border-t border-[#E6E4DD]">
      <div className="flex justify-around items-center h-20 px-2 max-w-lg mx-auto relative">
        {/* 1. Home Tab */}
        <button
          className={`group flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 transition-all ${
            currentTab === 'home'
              ? 'text-[#032212] font-semibold'
              : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('home')}
        >
          <span
            className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'home' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={currentTab === 'home' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              cottage
            </span>
          </span>
          <span className="text-[11px] font-medium mt-0.5 text-center leading-tight">
            {isHindi ? 'होम' : 'Home'}
            <span className="block text-[9px] opacity-75">{isHindi ? 'Home' : 'होम'}</span>
          </span>
        </button>

        {/* 2. Planner Tab */}
        <button
          className={`group flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 transition-all ${
            currentTab === 'planner'
              ? 'text-[#032212] font-semibold'
              : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('planner')}
        >
          <span
            className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'planner' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={currentTab === 'planner' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              calendar_month
            </span>
          </span>
          <span className="text-[11px] font-medium mt-0.5 text-center leading-tight">
            {isHindi ? 'प्लानर' : 'Plan'}
            <span className="block text-[9px] opacity-75">{isHindi ? 'Plan' : 'प्लानर'}</span>
          </span>
        </button>

        {/* 3. Center Elevated Voice / Ask AI Button */}
        <div className="flex flex-col items-center justify-center -mt-6">
          <button
            aria-label="बोलें / Ask AI Voice Action"
            className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-[#1A3826] shadow-md shadow-[#1A3826]/30 text-white active:scale-95 transition-transform hover:bg-[#132a1d]"
            type="button"
            onClick={onOpenVoiceAI}
          >
            <span className="material-symbols-outlined text-[26px]">mic</span>
          </button>
          <span className="text-[11px] text-[#1a1c1a] font-bold mt-1">
            {isHindi ? 'बोलें AI' : 'Ask AI'}
          </span>
        </div>

        {/* 4. Stock Tab */}
        <button
          className={`group flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 transition-all ${
            currentTab === 'stock'
              ? 'text-[#032212] font-semibold'
              : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('stock')}
        >
          <span
            className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'stock' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={currentTab === 'stock' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              kitchen
            </span>
          </span>
          <span className="text-[11px] font-medium mt-0.5 text-center leading-tight">
            {isHindi ? 'स्टॉक' : 'Stock'}
            <span className="block text-[9px] opacity-75">{isHindi ? 'Stock' : 'स्टॉक'}</span>
          </span>
        </button>

        {/* 5. Household Settings Tab */}
        <button
          className={`group flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 transition-all ${
            currentTab === 'household'
              ? 'text-[#032212] font-semibold'
              : 'text-[#424843] hover:text-[#1a1c1a]'
          }`}
          type="button"
          onClick={() => onSelectTab('household')}
        >
          <span
            className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              currentTab === 'household' ? 'bg-[#E8F0EC]' : ''
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={currentTab === 'household' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              group
            </span>
          </span>
          <span className="text-[11px] font-medium mt-0.5 text-center leading-tight">
            {isHindi ? 'घर' : 'House'}
            <span className="block text-[9px] opacity-75">{isHindi ? 'House' : 'घर'}</span>
          </span>
        </button>
      </div>
      <div className="w-full flex justify-center pb-1">
        <div className="w-32 h-1 bg-[#1a1c1a]/20 rounded-full"></div>
      </div>
    </nav>
  );
};
