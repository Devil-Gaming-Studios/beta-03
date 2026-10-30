import React, { useState } from 'react';
import { store } from '../services/store';

interface RecipeModalProps {
  recipeId: string | null;
  initialServings?: number;
  onClose: () => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipeId,
  initialServings = 2,
  onClose,
}) => {
  if (!recipeId) return null;

  const [servings, setServings] = useState(initialServings);

  let detail: any = null;
  try {
    detail = store.getRecipeDetail(recipeId, servings);
  } catch {
    return null;
  }

  const me = store.getMe();
  const householdCautions = Array.from(
    new Set(me.members.flatMap((m) => m.cautions || []))
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[90vh] overflow-y-auto flex flex-col gap-4 text-[#1a1c1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[#1a1c1a]">{detail.title}</h3>
            <p className="text-[12px] text-[#424843] capitalize">
              Category: {detail.category} • Cooked {detail.times_cooked || 0} times
            </p>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#424843] hover:bg-[#eeeeea]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Servings Scaler */}
        <div className="flex items-center justify-between bg-[#f4f4f0] p-3 rounded-2xl border border-[#E6E4DD]">
          <span className="text-[13px] font-semibold text-[#1a1c1a]">
            Scale Recipe Servings:
          </span>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[16px] font-bold active:scale-95 transition-transform hover:bg-[#eeeeea]"
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
            >
              -
            </button>
            <span className="text-[15px] font-bold min-w-[28px] text-center text-[#1A3826]">
              {servings}
            </span>
            <button
              className="w-8 h-8 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[16px] font-bold active:scale-95 transition-transform hover:bg-[#eeeeea]"
              type="button"
              onClick={() => setServings((s) => Math.min(20, s + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* Ingredients & Stock availability */}
        <div>
          <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2">
            Required Ingredients ({servings} servings)
          </h4>
          <div className="flex flex-col gap-2">
            {detail.ingredients.map((ri: any) => (
              <div
                key={ri.ingredient_id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#faf9f6] border border-[#E6E4DD] text-[13px]"
              >
                <div>
                  <span className="font-semibold text-[#1a1c1a]">{ri.name}</span>
                  <span className="text-[12px] text-[#424843] ml-2">
                    {ri.qty_base} {ri.unit_base}
                  </span>
                </div>
                <div>
                  {ri.enough ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] text-[11px] font-semibold border border-[#D1E2D7]">
                      In Stock
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold border border-[#E9E1D6]">
                      Short {Math.round(ri.qty_base - ri.have_base)} {ri.unit_base}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nutritional Profile */}
        <div className="border-t border-[#E6E4DD] pt-3">
          <h4 className="text-[12px] font-bold text-[#727972] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#B45309]">local_fire_department</span>
            <span>Nutrition Estimate ({servings} servings)</span>
          </h4>
          <div className="grid grid-cols-5 gap-1.5 text-center bg-[#f4f4f0] p-2.5 rounded-2xl border border-[#E6E4DD]">
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">CALORIES</div>
              <div className="text-[14px] font-bold text-[#B45309]">
                {detail.nutrition?.kcal || 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">PROTEIN</div>
              <div className="text-[14px] font-bold text-[#1A3826]">
                {detail.nutrition?.protein_g || 0}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">CARBS</div>
              <div className="text-[14px] font-bold text-[#1a1c1a]">
                {detail.nutrition?.carbs_g || 0}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">FAT</div>
              <div className="text-[14px] font-bold text-[#1a1c1a]">
                {detail.nutrition?.fat_g || 0}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#727972] font-semibold">SODIUM</div>
              <div className="text-[14px] font-bold text-[#1a1c1a]">
                {detail.nutrition?.sodium_mg || 0}mg
              </div>
            </div>
          </div>
        </div>

        {/* Health Guidance Notice */}
        {householdCautions.length > 0 && (
          <div className="p-3 bg-[#FAF6F0] border border-[#E9E1D6] rounded-xl text-[12px] text-[#424843]">
            <div className="font-bold text-[#B45309] flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[16px]">shield</span>
              <span>Diet Cautions Active: {householdCautions.join(', ')}</span>
            </div>
            <p className="text-[11px] leading-snug">
              General guidance for household health monitoring. Not medical advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
