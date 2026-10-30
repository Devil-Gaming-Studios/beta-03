import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { GraphRecipe } from '../types';

interface RecipeModalProps {
  recipeId: string | null;
  initialServings?: number;
  onClose: () => void;
  onPlanUpdated?: () => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipeId,
  initialServings = 2,
  onClose,
  onPlanUpdated,
}) => {
  const [servings, setServings] = useState(initialServings);
  const [graphData, setGraphData] = useState<GraphRecipe | null>(null);
  const [useDesiUnits, setUseDesiUnits] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planSlot, setPlanSlot] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (recipeId) {
      fetchGraphRecipe(recipeId);
    }
  }, [recipeId]);

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

  let detail: any = null;
  if (recipeId) {
    try {
      detail = store.getRecipeDetail(recipeId, servings);
    } catch {
      detail = null;
    }
  }

  const me = store.getMe();
  const householdCautions = Array.from(
    new Set(me.members.flatMap((m) => m.cautions || []))
  );

  const handleAddMealToPlan = () => {
    if (!recipeId) return;
    store.addMeal(planDate, planSlot, recipeId, servings, ['mem_1', 'mem_2']);
    setActionNotice(`Added ${detail.title} to ${planDate} (${planSlot})!`);
    setShowPlanForm(false);
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleCookNow = () => {
    if (!recipeId) return;
    const meal = store.addMeal(
      new Date().toISOString().slice(0, 10),
      'lunch',
      recipeId,
      servings,
      ['mem_1', 'mem_2']
    );
    const result = store.markMealDone(meal.id);
    setActionNotice(`Cooked ${detail.title}! Deducted: ${result.deductions}`);
    if (onPlanUpdated) onPlanUpdated();
    setTimeout(() => setActionNotice(null), 4000);
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
              {graphData?.cuisine || 'Indian'} • {graphData?.course || detail.category} • {graphData?.totalTime || 30} mins
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
        {graphData?.equipment && graphData.equipment.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#727972] uppercase">Equipment:</span>
            {graphData.equipment.map((eq) => (
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
            <span className="text-[11px] text-[#424843]">
              {detail.missing.length === 0 ? '✓ All ingredients in kitchen' : `Short ${detail.missing.length} items`}
            </span>
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
                      In Stock
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

        {/* Instructions & Cooking Steps */}
        {graphData?.translatedInstructions && (
          <div>
            <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#3b684a]">receipt_long</span>
              Step-by-Step Cooking Instructions
            </h4>
            <div className="p-3 bg-[#FAF9F6] border border-[#E6E4DD] rounded-2xl text-[12.5px] text-[#1a1c1a] leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-line">
              {graphData.translatedInstructions}
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
          <div className="p-3 bg-[#FAF6F0] border border-[#E9E1D6] rounded-2xl flex flex-col gap-2.5 animate-fade-in">
            <span className="text-[12.5px] font-bold text-[#1a1c1a]">Schedule to Weekly Plan:</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[#E6E4DD] bg-white text-[12px] font-medium"
              />
              <select
                value={planSlot}
                onChange={(e: any) => setPlanSlot(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[#E6E4DD] bg-white text-[12px] font-medium capitalize"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
            <button
              className="py-2 px-3 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all"
              onClick={handleAddMealToPlan}
            >
              Confirm Schedule
            </button>
          </div>
        )}

        {/* Actions Bar */}
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
