import React, { useState, useEffect } from 'react';
import { store, getMonday, getTodayStr } from '../services/store';
import { GraphRecipe, MealSlot } from '../types';

interface RecipeModalProps {
  recipeId: string | null;
  initialServings?: number;
  initialDate?: string;
  initialSlot?: MealSlot;
  autoOpenPlanForm?: boolean;
  onClose: () => void;
  onPlanUpdated?: () => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipeId,
  initialServings = 2,
  initialDate,
  initialSlot = 'dinner',
  autoOpenPlanForm = false,
  onClose,
  onPlanUpdated,
}) => {
  const [servings, setServings] = useState(initialServings);
  const [graphData, setGraphData] = useState<GraphRecipe | null>(null);
  const [useDesiUnits, setUseDesiUnits] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(autoOpenPlanForm);
  const [planDate, setPlanDate] = useState(
    () => initialDate || getTodayStr()
  );
  const [planSlot, setPlanSlot] = useState<MealSlot>(initialSlot);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  const handleStartTimer = (seconds: number) => {
    setTimerSeconds(seconds);
    setIsTimerRunning(true);
  };

  useEffect(() => {
    setServings(initialServings);
    setShowPlanForm(Boolean(autoOpenPlanForm));
    if (initialDate) setPlanDate(initialDate);
    if (initialSlot) setPlanSlot(initialSlot);
    if (recipeId) {
      fetchGraphRecipe(recipeId);
    }
  }, [recipeId, initialServings, initialDate, initialSlot, autoOpenPlanForm]);

  const fetchGraphRecipe = async (id: string) => {
    try {
      const res = await fetch(`/api/graph/recipes/${id}`);
      if (res.ok) {
        const d = await res.json();
        setGraphData(d);
      }
    } catch {
      // ignore
    }
  };

  const stockMap = store.getStockMap();
  let detail: any = null;
  if (recipeId) {
    try {
      detail = store.getRecipeDetail(recipeId, servings);
    } catch {
      if (graphData) {
        const factor = servings / Math.max(graphData.servings || 2, 1);
        const scaledIngs = (graphData.ingredients || []).map((ing) => {
          const qty_base = Math.round((ing.qty_base || 100) * factor * 10) / 10;
          const slug = ing.canonicalId.replace('ing_', '');
          const have_base = stockMap[ing.canonicalId] || stockMap[slug] || 0;
          return {
            ingredient_id: ing.canonicalId,
            name: ing.name,
            qty_base,
            unit_base: ing.unit_base || 'g',
            have_base,
            enough: have_base >= qty_base - 1e-9,
          };
        });
        detail = {
          id: graphData.id,
          title: graphData.name,
          category: graphData.course || 'Main Course',
          servings,
          ingredients: scaledIngs,
          missing: scaledIngs.filter((i) => !i.enough),
          nutrition: {
            kcal: Math.round((graphData.nutrientsEstimated?.kcal || 320) * (servings / 2)),
            protein_g: Math.round((graphData.nutrientsEstimated?.protein_g || 14) * (servings / 2)),
            carbs_g: Math.round((graphData.nutrientsEstimated?.carbs_g || 42) * (servings / 2)),
            fat_g: Math.round((graphData.nutrientsEstimated?.fat_g || 8) * (servings / 2)),
          },
        };
      }
    }
  }

  const weekMonday = getMonday();
  const weekDays = store.getWeekDays(weekMonday);

  const handleAddMealToPlan = () => {
    if (!recipeId || !detail) return;
    store.addMeal(planDate, planSlot, recipeId, servings, ['mem_1', 'mem_2'], {
      title: detail.title,
      cuisine: graphData?.cuisine || 'Indian',
      protein_g: Math.round((detail.nutrition?.protein_g || 14) / Math.max(servings, 1)),
      kcal: Math.round((detail.nutrition?.kcal || 320) / Math.max(servings, 1)),
    });
    store.refreshPlanShortages();
    setActionNotice(`Added "${detail.title}" to ${planDate} (${planSlot})!`);
    setShowPlanForm(false);
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 3500);
  };

  // When opened from the weekly plan, find the planned meal so scaled servings can be saved back to it.
  const plannedMeal =
    recipeId && initialDate && initialSlot
      ? store
          .getPlan(getMonday(initialDate))
          .meals.find(
            (m) =>
              m.meal_date === initialDate &&
              m.slot === initialSlot &&
              m.household_recipe_id === recipeId
          )
      : undefined;
  const canApplyScale =
    !!plannedMeal && plannedMeal.status === 'planned' && servings !== plannedMeal.servings;

  const handleApplyScale = () => {
    if (!recipeId || !detail || !plannedMeal) return;
    store.addMeal(
      plannedMeal.meal_date,
      plannedMeal.slot,
      recipeId,
      servings,
      plannedMeal.diner_member_ids,
      {
        title: plannedMeal.title,
        variety_type: plannedMeal.variety_type,
        cuisine: plannedMeal.cuisine,
        ai_reason: plannedMeal.ai_reason,
        diet_tags: plannedMeal.diet_tags,
        protein_g: Math.round((detail.nutrition?.protein_g || 14) / Math.max(servings, 1)),
        kcal: Math.round((detail.nutrition?.kcal || 320) / Math.max(servings, 1)),
      },
      { replaceMealId: plannedMeal.id }
    );
    store.refreshPlanShortages();
    setActionNotice(`Updated \"${plannedMeal.title}\" to ${servings} servings in your plan!`);
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCookNow = () => {
    if (!recipeId || !detail) return;
    const targetDate = initialDate || getTodayStr();
    const targetSlot = initialSlot || 'lunch';
    const currentPlan = store.getPlan(getMonday(targetDate));
    const existingMeal = currentPlan.meals.find(
      (m) =>
        (m.meal_date === targetDate && m.slot === targetSlot && m.household_recipe_id === recipeId) ||
        (m.meal_date === targetDate && m.household_recipe_id === recipeId)
    );
    const mealToMark =
      existingMeal ||
      store.addMeal(targetDate, targetSlot, recipeId, servings, ['mem_1', 'mem_2'], {
        title: detail.title,
        cuisine: graphData?.cuisine || detail.cuisine || 'Indian',
      });
    const result = store.markMealDone(mealToMark.id);
    setActionNotice(
      result.alreadyDone
        ? `"${detail.title}" is already marked as Done!`
        : `Cooked ${detail.title}! Used from stock: ${result.deductions}`
    );
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRestockRecipeMissing = () => {
    store.restockAllMissingItems();
    setActionNotice(`Added all missing ingredients to Kitchen Stock!`);
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 3500);
  };

  const toDesiMeasure = (qty: number, unit: string) => {
    if (unit === 'g') {
      if (qty >= 1000) return `${(qty / 1000).toFixed(1)} kg (~${Math.round(qty / 200)} कटोरी)`;
      if (qty >= 200) return `${Math.round(qty)} g (~${Math.round(qty / 150)} कटोरी)`;
      return `${Math.round(qty)} g (~${Math.round(qty / 15)} चम्मच)`;
    }
    if (unit === 'ml') {
      if (qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
      return `${Math.round(qty)} ml (~${Math.round(qty / 200)} कप)`;
    }
    return `${qty} pcs`;
  };

  if (!recipeId || !detail) return null;

  const instructionsText = graphData?.translatedInstructions || detail.instructions;
  const equipmentList: string[] = graphData?.equipment || detail.equipment || ['stove', 'kadhai_pan'];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[92vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Notice toast */}
        {actionNotice && (
          <div className="bg-[#1A3826] text-white text-[12.5px] font-medium px-4 py-2 rounded-xl flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E6E4DD] pb-3">
          <div className="flex-1 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[18px] font-bold text-[#1a1c1a] leading-tight">{detail.title}</h3>
              {graphData?.isNonVeg ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#fdf2f2] text-[#9E2A2B] font-bold border border-[#fecaca]">
                  Non-Veg
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#EDF2EE] text-[#137333] font-bold border border-[#c8ebd1] flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#137333]"></span>
                  100% Veg
                </span>
              )}
              {graphData?.difficulty === 'beginner' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#e8f5e9] text-[#2e7d32] font-semibold">
                  Beginner Friendly
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#424843] capitalize mt-1">
              {graphData?.cuisine || detail.cuisine || 'Indian'} • {graphData?.course || detail.course || detail.category} • {graphData?.totalTime || detail.totalTime || 25} mins
            </p>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea] shrink-0"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Servings Scaler & Unit Toggle */}
        <div className="flex items-center justify-between bg-[#f4f4f0] p-3 rounded-2xl border border-[#E6E4DD]">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1a1c1a]">Servings:</span>
            <div className="flex items-center gap-1.5">
              <button
                className="w-7 h-7 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[15px] font-bold active:scale-95 transition-transform hover:bg-[#eeeeea]"
                type="button"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
              >
                -
              </button>
              <span className="text-[15px] font-bold min-w-[24px] text-center text-[#1A3826]">
                {servings}
              </span>
              <button
                className="w-7 h-7 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[15px] font-bold active:scale-95 transition-transform hover:bg-[#eeeeea]"
                type="button"
                onClick={() => setServings((s) => Math.min(20, s + 1))}
              >
                +
              </button>
            </div>
          </div>

          <button
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              useDesiUnits
                ? 'bg-[#1A3826] text-white border-[#1A3826]'
                : 'bg-white text-[#424843] border-[#E6E4DD]'
            }`}
            onClick={() => setUseDesiUnits((u) => !u)}
          >
            {useDesiUnits ? 'कटोरी / चम्मच (Desi)' : 'Standard (g/ml)'}
          </button>
        </div>

        {/* Required Cooking Equipment */}
        {equipmentList.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#727972] uppercase">Equipment:</span>
            {equipmentList.map((eq) => (
              <span
                key={eq}
                className="px-2 py-0.5 rounded-lg bg-[#FAF9F6] border border-[#E6E4DD] text-[11px] text-[#424843] capitalize flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px] text-[#3b684a]">skillet</span>
                {eq.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Ingredients & Stock availability */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider">
              Ingredients for {servings} Servings ({detail.ingredients.length})
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#424843]">
                {detail.missing.length === 0 ? '✓ All ingredients in kitchen' : `Short ${detail.missing.length} items`}
              </span>
              {detail.missing.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestockRecipeMissing}
                  className="px-2 py-0.5 rounded-lg bg-[#1A3826] text-white text-[10.5px] font-bold hover:bg-[#132a1d] active:scale-95 transition-all"
                >
                  + Bought Missing
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
            {detail.ingredients.map((ri: any) => (
              <div
                key={ri.ingredient_id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf9f6] border border-[#E6E4DD] text-[13px]"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="font-semibold text-[#1a1c1a] block truncate">{ri.name}</span>
                  <span className="text-[11.5px] text-[#424843]">
                    {useDesiUnits
                      ? toDesiMeasure(ri.qty_base, ri.unit_base)
                      : `${ri.qty_base} ${ri.unit_base}`}
                  </span>
                </div>
                <div>
                  {ri.enough ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] text-[11px] font-semibold border border-[#D1E2D7] shrink-0">
                      In Stock ({Math.round(ri.have_base)} {ri.unit_base})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold border border-[#E9E1D6] shrink-0">
                      Short {Math.round(ri.qty_base - ri.have_base)} {ri.unit_base}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Cautions Alerts (Spec 2.11) */}
        {(() => {
          const me = store.getMe();
          const allCautions = Array.from(new Set((me.members || []).flatMap((m) => m.cautions || [])));
          const warnings: { icon: string; title: string; text: string }[] = [];

          if (allCautions.includes('bp')) {
            warnings.push({
              icon: 'warning',
              title: 'Blood Pressure / Salt Advisory',
              text: 'A diner has high blood pressure caution. Reduce added salt/namak by half and avoid extra chaat masala.',
            });
          }
          if (allCautions.includes('cholesterol') || allCautions.includes('heart')) {
            warnings.push({
              icon: 'favorite',
              title: 'Heart Health / Low Oil Advisory',
              text: 'A diner has heart/cholesterol caution. Prepare with a single teaspoon of oil; prefer steaming or dry-roasting over deep frying.',
            });
          }
          if (allCautions.includes('diabetes')) {
            warnings.push({
              icon: 'bloodtype',
              title: 'Diabetes / Low-GI Advisory',
              text: 'A diner has diabetes caution. Pair with a high-fiber kachumber salad to blunt glycemic response.',
            });
          }

          if (warnings.length === 0) return null;

          return (
            <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-[#FFF9E6] border border-[#F0D58C] text-[#8C5200]">
              <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">medical_services</span>
                <span>Personalized Diner Health Cautions</span>
              </span>
              {warnings.map((w, idx) => (
                <div key={idx} className="text-[12px] leading-snug">
                  <strong>{w.title}:</strong> {w.text}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Perishable Storage Advice (Spec 2.12) */}
        {(() => {
          const me = store.getMe();
          const hasFridge = me.household.has_fridge;
          const hasPerishables = detail.ingredients.some((i: any) =>
            ['paneer', 'dahi', 'curd', 'doodh', 'milk', 'palak', 'spinach', 'tamatar', 'tomato'].some((k) =>
              i.name.toLowerCase().includes(k)
            )
          );

          if (!hasPerishables && hasFridge) return null;

          return (
            <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[11.5px] text-[#424843] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3b684a] text-[17px] shrink-0">
                {hasFridge ? 'kitchen' : 'inventory_2'}
              </span>
              <span>
                {!hasFridge
                  ? 'No-Fridge Notice: Buy perishable ingredients (paneer, milk, curd) in exact 1-meal quantities to cook immediately without storage.'
                  : 'Storage & Freshness Tip: Keep paneer immersed in water in the fridge; store greens wrapped in cloth/paper.'}
              </span>
            </div>
          );
        })()}

        {/* Beginner Cooking Timers & Glossary (Spec 2.16) */}
        <div className="p-3 bg-[#f4f7f5] rounded-2xl border border-[#d6e3da] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1A3826]">
              <span className="material-symbols-outlined text-[16px]">timer</span>
              <span>Beginner Cooking Timers</span>
            </div>
            <button
              type="button"
              onClick={() => setShowGlossary((g) => !g)}
              className="text-[11px] font-bold text-[#3b684a] hover:underline flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">menu_book</span>
              <span>{showGlossary ? 'Hide Glossary' : 'Kitchen Glossary'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleStartTimer(120)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#d6e3da] text-[11px] font-semibold text-[#1A3826] hover:bg-[#EDF2EE] active:scale-95"
            >
              ⏱️ 2m Tadka
            </button>
            <button
              type="button"
              onClick={() => handleStartTimer(300)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#d6e3da] text-[11px] font-semibold text-[#1A3826] hover:bg-[#EDF2EE] active:scale-95"
            >
              ⏱️ 5m Bhunao
            </button>
            <button
              type="button"
              onClick={() => handleStartTimer(600)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#d6e3da] text-[11px] font-semibold text-[#1A3826] hover:bg-[#EDF2EE] active:scale-95"
            >
              ⏱️ 10m Simmer
            </button>
            {timerSeconds !== null && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="px-2.5 py-0.5 rounded-full bg-[#1A3826] text-white text-[11.5px] font-mono font-bold">
                  {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTimerSeconds(null);
                    setIsTimerRunning(false);
                  }}
                  className="text-[11px] text-[#ba1a1a] font-bold"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {showGlossary && (
            <div className="mt-1 pt-2 border-t border-[#d6e3da] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#424843]">
              <div><strong>Tadka (तड़का):</strong> Quick spice tempering in hot oil or ghee.</div>
              <div><strong>Bhunao (भूनना):</strong> Sautéing onions/spices on medium heat until oil releases.</div>
              <div><strong>Dheemi Aanch (धीमी आंच):</strong> Cooking on low flame with lid closed.</div>
              <div><strong>Katori (कटोरी):</strong> Standard Indian bowl measure (~150 to 200 ml).</div>
            </div>
          )}
        </div>

        {/* Instructions & Cooking Steps */}
        {instructionsText && (
          <div>
            <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#3b684a]">receipt_long</span>
              Complete Recipe &amp; Step-by-Step Cooking Instructions
            </h4>
            <div className="p-3.5 bg-[#FAF9F6] border border-[#E6E4DD] rounded-2xl text-[12.5px] text-[#1a1c1a] leading-relaxed max-h-[210px] overflow-y-auto whitespace-pre-line">
              {instructionsText}
            </div>
          </div>
        )}

        {/* Nutritional Facts */}
        <div className="border-t border-[#E6E4DD] pt-3">
          <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#B45309]">local_fire_department</span>
            <span>Nutrition Facts ({servings} servings)</span>
          </h4>
          <div className="grid grid-cols-4 gap-2 text-center bg-[#f4f4f0] p-2.5 rounded-2xl border border-[#E6E4DD]">
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">CALORIES</div>
              <div className="text-[15px] font-bold text-[#B45309]">
                {detail.nutrition?.kcal || 320} kcal
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">PROTEIN</div>
              <div className="text-[15px] font-bold text-[#1A3826]">
                {detail.nutrition?.protein_g || 14}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">CARBS</div>
              <div className="text-[15px] font-bold text-[#1a1c1a]">
                {detail.nutrition?.carbs_g || 42}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">FAT</div>
              <div className="text-[15px] font-bold text-[#1a1c1a]">
                {detail.nutrition?.fat_g || 8}g
              </div>
            </div>
          </div>
        </div>

        {/* Similar Recipes in Graph Neighborhood */}
        {graphData?.similarRecipeObjects && graphData.similarRecipeObjects.length > 0 && (
          <div>
            <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2">
              Similar Recipes (Graph Neighbors)
            </h4>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {graphData.similarRecipeObjects.map((sim) => (
                <div
                  key={sim.id}
                  className="p-2.5 rounded-xl bg-[#f4f4f0] border border-[#E6E4DD] shrink-0 w-[160px] text-[12px]"
                >
                  <span className="font-bold text-[#1a1c1a] block truncate">{sim.name}</span>
                  <span className="text-[11px] text-[#727972]">{sim.totalTime}m • {sim.cuisine}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add to Plan Dropdown Picker */}
        {showPlanForm && (
          <div className="p-3.5 bg-[#FAF6F0] border border-[#E9E1D6] rounded-2xl flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-[#1a1c1a]">
                Schedule &ldquo;{detail.title}&rdquo; to Weekly Plan:
              </span>
              <span className="text-[11px] text-[#727972]">Pick a day &amp; meal slot</span>
            </div>

            {/* 7-Day Quick Date Selector Strip */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((wd) => {
                const selected = planDate === wd.dateStr;
                return (
                  <button
                    key={wd.dateStr}
                    type="button"
                    onClick={() => setPlanDate(wd.dateStr)}
                    className={`py-1.5 px-1 rounded-xl border flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
                      selected
                        ? 'bg-[#1A3826] text-white border-[#1A3826]'
                        : 'bg-white text-[#1a1c1a] border-[#E6E4DD]'
                    }`}
                  >
                    <span>{wd.dayKey}</span>
                    <span className="text-[13px]">{wd.dayNum}</span>
                    <span
                      className={`text-[8px] px-1 rounded ${
                        wd.varietyMode === 'new'
                          ? 'bg-[#FAF6F0] text-[#B45309]'
                          : 'bg-[#EDF2EE] text-[#1A3826]'
                      }`}
                    >
                      {wd.varietyMode === 'new' ? '✨NEW' : 'REG'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="flex-1 px-2.5 py-2 rounded-xl border border-[#E6E4DD] bg-white text-[12px] font-semibold"
              />
              <select
                value={planSlot}
                onChange={(e: any) => setPlanSlot(e.target.value)}
                className="flex-1 px-2.5 py-2 rounded-xl border border-[#E6E4DD] bg-white text-[12px] font-semibold capitalize"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
            <button
              className="py-2.5 px-3 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5"
              onClick={handleAddMealToPlan}
            >
              <span className="material-symbols-outlined text-[16px]">event_available</span>
              Confirm Schedule for {planDate} ({planSlot})
            </button>
          </div>
        )}

        {/* Actions Bar */}
        {canApplyScale && (
          <button
            type="button"
            className="w-full py-2.5 px-3 rounded-xl bg-[#EDF2EE] text-[#1A3826] border border-[#1A3826]/20 text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#d8e6db]"
            onClick={handleApplyScale}
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Apply Changes ({plannedMeal!.servings} → {servings} servings)
          </button>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[#E6E4DD]">
          <button
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#1A3826] text-white text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#132a1d]"
            onClick={handleCookNow}
          >
            <span className="material-symbols-outlined text-[18px]">soup_kitchen</span>
            Cook &amp; Deduct Stock
          </button>

          <button
            className="py-2.5 px-3 rounded-xl bg-[#EDF2EE] text-[#1A3826] text-[13px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1 hover:bg-[#d8e6db]"
            onClick={() => setShowPlanForm((f) => !f)}
          >
            <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            {showPlanForm ? 'Close' : 'Plan'}
          </button>
        </div>
      </div>
    </div>
  );
};
