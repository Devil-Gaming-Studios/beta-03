import React, { useState } from 'react';
import { KitchenSyncHeader } from './components/KitchenSyncHeader';
import { KitchenSyncNavbar, NavTab } from './components/KitchenSyncNavbar';
import { HomeScreen } from './components/HomeScreen';
import { PlannerScreen } from './components/PlannerScreen';
import { RecipesScreen } from './components/RecipesScreen';
import { StockScreen } from './components/StockScreen';
import { ShopScreen } from './components/ShopScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { OmnirushVoiceModal } from './components/OmnirushVoiceModal';
import { RecipeModal } from './components/RecipeModal';
import { ScanModal } from './components/ScanModal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DownloadAppModal } from './components/DownloadAppModal';
import { store } from './services/store';
import { DietPreference, MealSlot } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('swiggy') === 'connected' || params.has('swiggy_error')) {
        return 'shop';
      }
    }
    return 'home';
  });
  const [isHindi, setIsHindi] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [scanModalMode, setScanModalMode] = useState<'receipt' | 'fridge' | null>(null);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('swiggy') === 'connected') return true;
    }
    return store.isOnboardingComplete();
  });
  const [viewRecipe, setViewRecipe] = useState<{
    id: string;
    servings: number;
    initialDate?: string;
    initialSlot?: MealSlot;
    autoOpenPlanForm?: boolean;
  } | null>(null);

  // Automatically switch to shop tab if Swiggy redirected back with ?swiggy=connected
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('swiggy') === 'connected' || params.has('swiggy_error')) {
        setCurrentTab('shop');
        setOnboarded(true);
      }
    }
  }, []);

  const toggleLanguage = () => {
    setIsHindi((prev) => !prev);
  };

  const handleOnboardingComplete = (diet: DietPreference, isBeginner: boolean) => {
    store.completeOnboarding(diet, isBeginner);
    setPlanRefreshKey((k) => k + 1);
    setOnboarded(true);
  };

  // Gate: nothing else renders until diet preference has been chosen.
  if (!onboarded) {
    return (
      <OnboardingScreen
        isHindi={isHindi}
        onToggleLang={toggleLanguage}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div className="bg-[#faf9f6] min-h-screen text-[#1a1c1a] flex flex-col selection:bg-[#EDF2EE] selection:text-[#032212]">
      {/* Fixed Sticky Header */}
      <KitchenSyncHeader
        isHindi={isHindi}
        onToggleLang={toggleLanguage}
        onOpenProfile={() => setCurrentTab('household')}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenDownload={() => setIsDownloadModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-20 pb-24">
        {currentTab === 'home' && (
          <HomeScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenScan={(mode) => setScanModalMode(mode)}
            onOpenDownload={() => setIsDownloadModalOpen(true)}
            onViewRecipe={(id, servings, planDate, planSlot) =>
              setViewRecipe({
                id,
                servings,
                initialDate: planDate,
                initialSlot: planSlot,
                autoOpenPlanForm: false,
              })
            }
          />
        )}

        {currentTab === 'planner' && (
          <PlannerScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onViewRecipe={(id, servings, planDate, planSlot) =>
              setViewRecipe({
                id,
                servings,
                initialDate: planDate,
                initialSlot: planSlot,
                autoOpenPlanForm: false,
              })
            }
            onOpenRecipesTab={() => setCurrentTab('recipes')}
          />
        )}

        {currentTab === 'recipes' && (
          <RecipesScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onViewRecipe={(id, servings) =>
              setViewRecipe({ id, servings, autoOpenPlanForm: false })
            }
            onAddToPlan={(id) => {
              setViewRecipe({ id, servings: 2, autoOpenPlanForm: true });
            }}
          />
        )}

        {currentTab === 'stock' && (
          <StockScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        )}

        {currentTab === 'shop' && (
          <ShopScreen
            key={planRefreshKey}
            isHindi={isHindi}
          />
        )}

        {currentTab === 'household' && (
          <HouseholdScreen
            key={planRefreshKey}
            isHindi={isHindi}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar with Center AI Button */}
      <KitchenSyncNavbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenVoiceAI={() => setIsVoiceOpen(true)}
        isHindi={isHindi}
      />

      {/* Voice / Omnirush AI Assistant Modal */}
      <OmnirushVoiceModal
        isOpen={isVoiceOpen}
        onClose={() => {
          setIsVoiceOpen(false);
          setPlanRefreshKey((k) => k + 1);
        }}
        onDataChanged={() => setPlanRefreshKey((k) => k + 1)}
        isHindi={isHindi}
      />

      {/* Real Gemini Vision OCR & Fridge Scanner Modal */}
      <ScanModal
        isOpen={scanModalMode !== null}
        initialMode={scanModalMode || 'receipt'}
        onClose={() => setScanModalMode(null)}
        onItemsIngested={() => {
          setScanModalMode(null);
          setCurrentTab('stock');
        }}
        isHindi={isHindi}
      />

      {/* Recipe Scaling & Nutrition Modal */}
      <RecipeModal
        recipeId={viewRecipe?.id || null}
        initialServings={viewRecipe?.servings || 2}
        initialDate={viewRecipe?.initialDate}
        initialSlot={viewRecipe?.initialSlot}
        autoOpenPlanForm={viewRecipe?.autoOpenPlanForm}
        onClose={() => setViewRecipe(null)}
        onPlanUpdated={() => setPlanRefreshKey((k) => k + 1)}
      />

      {/* Download Web App / PWA Install Modal */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        isHindi={isHindi}
      />
    </div>
  );
};

export default App;
