import React, { useState } from 'react';
import { KitchenSyncHeader } from './components/KitchenSyncHeader';
import { KitchenSyncNavbar, NavTab } from './components/KitchenSyncNavbar';
import { HomeScreen } from './components/HomeScreen';
import { PlannerScreen } from './components/PlannerScreen';
import { RecipesScreen } from './components/RecipesScreen';
import { StockScreen } from './components/StockScreen';
import { ShopScreen } from './components/ShopScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { CloudKitchenHome } from './components/CloudKitchenHome';
import { CloudKitchenBatches } from './components/CloudKitchenBatches';
import { CloudKitchenMenu } from './components/CloudKitchenMenu';
import { CloudKitchenStock } from './components/CloudKitchenStock';
import { CloudKitchenShop } from './components/CloudKitchenShop';
import { OmnirushVoiceModal } from './components/OmnirushVoiceModal';
import { RecipeModal } from './components/RecipeModal';
import { ScanModal } from './components/ScanModal';
import { AuthScreen } from './components/AuthScreen';
import { CommunityScreen } from './components/CommunityScreen';
import { DownloadAppModal } from './components/DownloadAppModal';
import { store } from './services/store';
import { syncClient } from './services/syncClient';
import { MealSlot } from './types';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('swiggy') === 'connected') return true;
    }
    return store.isLoggedIn();
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
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Start cross-device sync and refresh the screens whenever another device's changes arrive.
  React.useEffect(() => {
    syncClient.start();
    const onSynced = () => setPlanRefreshKey((k) => k + 1);
    window.addEventListener('mastmeals:synced', onSynced);
    return () => window.removeEventListener('mastmeals:synced', onSynced);
  }, []);

  const toggleLanguage = () => {
    setIsHindi((prev) => !prev);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setPlanRefreshKey((k) => k + 1);
  };

  // Gate: when not logged in or onboarded, show dedicated Auth & Login Screen
  if (!isAuthenticated) {
    return (
      <AuthScreen
        isHindi={isHindi}
        onToggleLang={toggleLanguage}
        onLoginSuccess={handleLoginSuccess}
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
        onOpenScan={(mode) => setScanModalMode(mode || 'receipt')}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-20 pb-24">
        {/* Tab 1: Home / KDS */}
        {currentTab === 'home' &&
          (store.getMe().household.household_type === 'cloud_kitchen' ? (
            <CloudKitchenHome
              key={planRefreshKey}
              isHindi={isHindi}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenVoice={() => setIsVoiceOpen(true)}
            />
          ) : (
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
          ))}

        {/* Tab 2: Planner / Batches */}
        {currentTab === 'planner' &&
          (store.getMe().household.household_type === 'cloud_kitchen' ? (
            <CloudKitchenBatches
              key={planRefreshKey}
              isHindi={isHindi}
              onOpenVoice={() => setIsVoiceOpen(true)}
            />
          ) : (
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
          ))}

        {/* Tab 3: Recipes / Menu */}
        {currentTab === 'recipes' &&
          (store.getMe().household.household_type === 'cloud_kitchen' ? (
            <CloudKitchenMenu key={planRefreshKey} isHindi={isHindi} />
          ) : (
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
          ))}

        {/* Tab 4: Stock / Inventory & Ledger */}
        {currentTab === 'stock' &&
          (store.getMe().household.household_type === 'cloud_kitchen' ? (
            <CloudKitchenStock key={planRefreshKey} isHindi={isHindi} />
          ) : (
            <StockScreen
              key={planRefreshKey}
              isHindi={isHindi}
              onOpenVoice={() => setIsVoiceOpen(true)}
              onOpenScan={(mode) => setScanModalMode(mode || 'receipt')}
            />
          ))}

        {/* Tab 5: Shop / Procurement */}
        {currentTab === 'shop' &&
          (store.getMe().household.household_type === 'cloud_kitchen' ? (
            <CloudKitchenShop key={planRefreshKey} isHindi={isHindi} />
          ) : (
            <ShopScreen key={planRefreshKey} isHindi={isHindi} />
          ))}

        {/* Tab 6: Community Dish Feed (Threads style) */}
        {currentTab === 'community' && (
          <CommunityScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onViewRecipe={(id, servings) =>
              setViewRecipe({ id, servings, autoOpenPlanForm: false })
            }
          />
        )}

        {/* Tab 7: Household & Cloud Kitchen Profile / Roles / P&L Reports */}
        {currentTab === 'household' && (
          <HouseholdScreen
            key={planRefreshKey}
            isHindi={isHindi}
            onLogout={() => {
              setIsAuthenticated(false);
            }}
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
