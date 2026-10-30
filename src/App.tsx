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

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isHindi, setIsHindi] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [viewRecipe, setViewRecipe] = useState<{ id: string; servings: number } | null>(null);

  const toggleLanguage = () => {
    setIsHindi((prev) => !prev);
  };

  return (
    <div className="bg-[#faf9f6] min-h-screen text-[#1a1c1a] flex flex-col selection:bg-[#EDF2EE] selection:text-[#032212]">
      {/* Fixed Sticky Header */}
      <KitchenSyncHeader
        isHindi={isHindi}
        onToggleLang={toggleLanguage}
        onOpenProfile={() => setCurrentTab('household')}
        onOpenVoice={() => setIsVoiceOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-20 pb-24">
        {currentTab === 'home' && (
          <HomeScreen
            isHindi={isHindi}
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        )}

        {currentTab === 'planner' && (
          <PlannerScreen
            isHindi={isHindi}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onViewRecipe={(id, servings) => setViewRecipe({ id, servings })}
            onOpenRecipesTab={() => setCurrentTab('recipes')}
          />
        )}

        {currentTab === 'recipes' && (
          <RecipesScreen
            isHindi={isHindi}
            onViewRecipe={(id, servings) => setViewRecipe({ id, servings })}
            onAddToPlan={(id) => {
              setViewRecipe({ id, servings: 2 });
            }}
          />
        )}

        {currentTab === 'stock' && (
          <StockScreen
            isHindi={isHindi}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        )}

        {currentTab === 'shop' && (
          <ShopScreen
            isHindi={isHindi}
          />
        )}

        {currentTab === 'household' && (
          <HouseholdScreen
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
        onClose={() => setIsVoiceOpen(false)}
        isHindi={isHindi}
      />

      {/* Recipe Scaling & Nutrition Modal */}
      <RecipeModal
        recipeId={viewRecipe?.id || null}
        initialServings={viewRecipe?.servings || 2}
        onClose={() => setViewRecipe(null)}
      />
    </div>
  );
};

export default App;
