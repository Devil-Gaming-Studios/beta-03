import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { GraphRecipe } from '../types';

interface RecipesScreenProps {
  isHindi: boolean;
  onViewRecipe: (id: string, servings: number) => void;
  onAddToPlan: (recipeId: string, recipeTitle: string) => void;
}

export const RecipesScreen: React.FC<RecipesScreenProps> = ({
  isHindi,
  onViewRecipe,
  onAddToPlan,
}) => {
  const [recipes, setRecipes] = useState<GraphRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [onlyBeginner, setOnlyBeginner] = useState(false);
  const [highProtein, setHighProtein] = useState(false);
  const [stats, setStats] = useState<{ totalRecipes: number; vegRecipesCount: number; totalIngredients: number } | null>(null);

  const me = store.getMe();
  const isVegUser = me.user.diet_pref === 'veg';

  useEffect(() => {
    fetchStats();
    fetchRecipes();
  }, [selectedCuisine, selectedCourse, onlyBeginner, highProtein, searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/graph/stats');
      if (res.ok) {
        const d = await res.json();
        setStats(d);
      }
    } catch {
      // ignore
    }
  };

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('query', searchQuery.trim());
      if (isVegUser) params.append('diet_pref', 'veg');
      if (onlyBeginner || me.user.is_beginner_cook) params.append('is_beginner', 'true');
      if (selectedCuisine !== 'all') params.append('cuisine', selectedCuisine);
      if (selectedCourse !== 'all') params.append('course', selectedCourse);
      if (highProtein) params.append('high_protein', 'true');
      params.append('limit', '30');

      const res = await fetch(`/api/graph/recipes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.recipes || []);
      } else {
        // Fallback to local store recipes
        fallbackToStore();
      }
    } catch (err) {
      console.warn('Error fetching graph recipes:', err);
      fallbackToStore();
    } finally {
      setLoading(false);
    }
  };

  const fallbackToStore = () => {
    const list = store.getRecipes().map((r) => ({
      id: r.id,
      srno: 1,
      name: r.title,
      translatedName: r.title,
      prepTime: 10,
      cookTime: 20,
      totalTime: 30,
      servings: r.base_servings || 2,
      cuisine: 'Indian',
      course: r.category || 'Main Course',
      diet: 'Vegetarian',
      isNonVeg: false,
      difficulty: 'beginner' as const,
      equipment: ['kadhai_pan'],
      instructions: 'Cook ingredients together with spices until aromatic.',
      translatedInstructions: 'Cook ingredients together with spices until aromatic.',
      url: '',
      ingredients: (r.ingredients || []).map((i: any) => ({
        raw: i.name || i.ingredient_id,
        name: i.name || i.ingredient_id,
        canonicalId: i.ingredient_id,
        qty_base: i.qty_base,
        unit_base: i.unit_base || 'g',
        isNonVeg: false,
      })),
      nutrientsEstimated: {
        kcal: 350,
        protein_g: 14,
        carbs_g: 45,
        fat_g: 8,
        sodium_mg: 400,
      },
    }));
    setRecipes(list);
  };

  const cuisines = [
    { id: 'all', label: 'All Cuisines' },
    { id: 'South Indian', label: 'South Indian' },
    { id: 'North Indian', label: 'North Indian' },
    { id: 'Punjabi', label: 'Punjabi' },
    { id: 'Andhra', label: 'Andhra' },
    { id: 'Bengali', label: 'Bengali' },
    { id: 'Maharashtrian', label: 'Maharashtrian' },
    { id: 'Gujarati', label: 'Gujarati' },
  ];

  const courses = [
    { id: 'all', label: 'All Courses' },
    { id: 'Breakfast', label: 'Breakfast' },
    { id: 'Lunch', label: 'Lunch' },
    { id: 'Dinner', label: 'Dinner' },
    { id: 'Side Dish', label: 'Side Dish / Sabzi' },
    { id: 'Snack', label: 'Snacks' },
    { id: 'Dessert', label: 'Desserts' },
  ];

  const stockMap = store.getStockMap();

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Header & Graph RAG Info */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
              {isHindi ? 'रेसिपी ज्ञान ग्राफ (Graph RAG)' : 'Recipe Knowledge Graph'}
            </h1>
            <p className="text-[12px] text-[#424843]">
              {isHindi
                ? '6,800+ प्रामाणिक भारतीय व्यंजन और घटक संबंध'
                : '6,800+ authentic Indian recipes & ingredient graph relations'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[11px] font-semibold border border-[#D1E2D7]">
            <span className="w-2 h-2 rounded-full bg-[#1A3826] animate-pulse"></span>
            Graph RAG Live
          </span>
        </div>

        {/* Stats Pill Bar */}
        {stats && (
          <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar py-1">
            <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[11px] font-medium text-[#424843]">
              <strong>{stats.totalRecipes.toLocaleString()}</strong> Recipes
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[11px] font-medium text-[#137333]">
              <strong>{stats.vegRecipesCount.toLocaleString()}</strong> 100% Veg
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[11px] font-medium text-[#424843]">
              <strong>{stats.totalIngredients.toLocaleString()}</strong> Ingredients
            </span>
            {isVegUser && (
              <span className="px-2.5 py-0.5 rounded-md bg-[#EDF2EE] text-[#137333] text-[11px] font-semibold border border-[#c8ebd1]">
                ✓ Strict Veg Filter On
              </span>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727972] text-[20px]">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isHindi ? 'व्यंजन या सामग्री खोजें (उदा. पनीर, आलू, दाल)...' : 'Search recipes or ingredients (e.g. Paneer, Aloo, Dal)...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E6E4DD] text-[13px] text-[#1a1c1a] placeholder:text-[#93a0b4] focus:outline-none focus:border-[#1A3826] shadow-xs"
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727972] hover:text-[#1a1c1a]"
            onClick={() => setSearchQuery('')}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* Filter Toggles: Beginner Cook & High Protein */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold shrink-0 transition-all flex items-center gap-1.5 border ${
            onlyBeginner
              ? 'bg-[#1A3826] text-white border-[#1A3826]'
              : 'bg-white text-[#424843] border-[#E6E4DD] hover:bg-[#f4f4f0]'
          }`}
          onClick={() => setOnlyBeginner((b) => !b)}
        >
          <span className="material-symbols-outlined text-[16px]">child_care</span>
          {isHindi ? 'शुरुआती रसोइया (Beginner Mode)' : 'Beginner Friendly (Quick)'}
        </button>

        <button
          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold shrink-0 transition-all flex items-center gap-1.5 border ${
            highProtein
              ? 'bg-[#1A3826] text-white border-[#1A3826]'
              : 'bg-white text-[#424843] border-[#E6E4DD] hover:bg-[#f4f4f0]'
          }`}
          onClick={() => setHighProtein((p) => !p)}
        >
          <span className="material-symbols-outlined text-[16px]">fitness_center</span>
          {isHindi ? 'उच्च प्रोटीन (High Protein)' : 'High Protein'}
        </button>
      </div>

      {/* Cuisines Filter Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {cuisines.map((c) => (
          <button
            key={c.id}
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all ${
              selectedCuisine === c.id
                ? 'bg-[#1A3826] text-white font-semibold'
                : 'bg-white text-[#424843] border border-[#E6E4DD] hover:bg-[#f4f4f0]'
            }`}
            onClick={() => setSelectedCuisine(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Course Filter Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {courses.map((cr) => (
          <button
            key={cr.id}
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all ${
              selectedCourse === cr.id
                ? 'bg-[#3b684a] text-white font-semibold'
                : 'bg-[#eeeeea] text-[#424843] hover:bg-[#e2e3df]'
            }`}
            onClick={() => setSelectedCourse(cr.id)}
          >
            {cr.label}
          </button>
        ))}
      </div>

      {/* Recipe Cards List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="p-8 text-center text-[#424843] flex flex-col items-center justify-center gap-2">
            <span className="w-6 h-6 border-2 border-[#1A3826] border-t-transparent rounded-full animate-spin"></span>
            <span className="text-[13px]">{isHindi ? 'ग्राफ डेटाबेस से रेसिपी लोड हो रही हैं...' : 'Traversing recipe graph...'}</span>
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-[#E6E4DD] text-[#424843]">
            <span className="material-symbols-outlined text-[32px] text-[#727972]">search_off</span>
            <p className="text-[14px] font-semibold mt-2">{isHindi ? 'कोई रेसिपी नहीं मिली' : 'No recipes matched your criteria'}</p>
            <p className="text-[12px] text-[#727972] mt-1">Try relaxing filters or search terms.</p>
          </div>
        ) : (
          recipes.map((recipe) => {
            // Calculate matched ingredients from current stock
            let matchedCount = 0;
            const totalIngs = recipe.ingredients.length;
            recipe.ingredients.forEach((ing) => {
              const slug = ing.canonicalId.replace('ing_', '');
              if (stockMap[ing.canonicalId] || stockMap[slug]) matchedCount++;
            });
            const hasAll = matchedCount === totalIngs && totalIngs > 0;

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs hover:border-[#1A3826]/40 transition-all flex flex-col gap-2.5"
              >
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-bold text-[#1a1c1a] leading-tight">
                        {recipe.name}
                      </span>
                      {recipe.isNonVeg ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#fdf2f2] text-[#9E2A2B] font-bold border border-[#fecaca]">
                          Non-Veg
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#EDF2EE] text-[#137333] font-bold border border-[#c8ebd1] flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#137333]"></span>
                          Veg
                        </span>
                      )}
                      {recipe.difficulty === 'beginner' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#e8f5e9] text-[#2e7d32] font-semibold">
                          Beginner
                        </span>
                      )}
                    </div>
                    {recipe.translatedName && recipe.translatedName !== recipe.name && (
                      <p className="text-[12px] text-[#424843] mt-0.5">{recipe.translatedName}</p>
                    )}
                  </div>

                  {/* Cook time */}
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#424843] bg-[#f4f4f0] px-2 py-1 rounded-lg shrink-0">
                    <span className="material-symbols-outlined text-[14px]">timer</span>
                    <span>{recipe.totalTime}m</span>
                  </div>
                </div>

                {/* Recipe Meta Info */}
                <div className="flex items-center gap-3 text-[12px] text-[#424843] flex-wrap">
                  <span className="capitalize">{recipe.cuisine}</span>
                  <span>•</span>
                  <span className="capitalize">{recipe.course}</span>
                  <span>•</span>
                  <span className="font-semibold text-[#1A3826]">
                    {recipe.nutrientsEstimated.protein_g}g Protein
                  </span>
                  <span>•</span>
                  <span>{recipe.nutrientsEstimated.kcal} kcal</span>
                </div>

                {/* Stock Coverage Indicator */}
                <div className="flex items-center justify-between text-[11.5px] bg-[#FAF9F6] p-2 rounded-xl border border-[#E6E4DD]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-[16px] ${
                        hasAll ? 'text-[#137333]' : matchedCount > 0 ? 'text-[#B45309]' : 'text-[#727972]'
                      }`}
                    >
                      {hasAll ? 'check_circle' : 'inventory_2'}
                    </span>
                    <span className="font-medium text-[#1a1c1a]">
                      Stock status: {matchedCount}/{totalIngs} ingredients in kitchen
                    </span>
                  </div>
                  {hasAll && (
                    <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] font-bold text-[10px]">
                      Ready to Cook!
                    </span>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#E6E4DD]/60">
                  <button
                    className="flex-1 py-2 px-3 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#132a1d]"
                    onClick={() => onViewRecipe(recipe.id, recipe.servings || 2)}
                  >
                    <span className="material-symbols-outlined text-[16px]">menu_book</span>
                    {isHindi ? 'रेसिपी व मात्रा देखें' : 'View & Scale'}
                  </button>

                  <button
                    className="py-2 px-3 rounded-xl bg-[#EDF2EE] text-[#1A3826] text-[12px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1 hover:bg-[#d8e6db]"
                    onClick={() => onAddToPlan(recipe.id, recipe.name)}
                    title="Add to Weekly Meal Plan"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    {isHindi ? 'प्लान में जोड़ें' : 'Add to Plan'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
