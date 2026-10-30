import React, { useState, useEffect } from 'react';
import { store, getMonday } from '../services/store';
import { MealPlan, PlannedMeal, MealSlot } from '../types';

interface PlannerScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
  onViewRecipe: (id: string, servings: number) => void;
  onOpenRecipesTab?: () => void;
}

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  isHindi,
  onOpenVoice,
  onViewRecipe,
  onOpenRecipesTab,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(3); // Default Thursday (index 3 from Mon)
  const [plan, setPlan] = useState<MealPlan>(() => store.getPlan());
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const weekStart = getMonday();
  const startDate = new Date(weekStart);

  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + idx);
    const dateStr = d.toISOString().slice(0, 10);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hindiNames = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];
    const isToday = dateStr === new Date().toISOString().slice(0, 10);

    return {
      index: idx,
      dateStr,
      dayNumber: d.getDate(),
      dayName: dayNames[idx],
      dayLabel: isHindi ? hindiNames[idx] : dayNames[idx],
      isToday,
    };
  });

  const selectedDateStr = days[selectedDayOffset]?.dateStr;

  useEffect(() => {
    refreshPlan();
  }, [selectedDayOffset]);

  const refreshPlan = () => {
    setPlan(store.getPlan());
  };

  const dayMeals = plan.meals.filter((m) => m.meal_date === selectedDateStr);

  const handleMarkDone = (mealId: string) => {
    try {
      const res = store.markMealDone(mealId);
      if (res.alreadyDone) {
        setActionMessage('Meal was already marked as cooked.');
      } else {
        setActionMessage(`Cooked! Stock deducted: ${res.deductions}`);
      }
      refreshPlan();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAutoFillWeek = () => {
    store.autoFillWeekPlan();
    refreshPlan();
    setActionMessage('AI filled 7-day meal plan from your available stock & Graph RAG!');
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleAddShortfallToShop = (shortfallItems: any[]) => {
    store.generateShoppingList();
    setActionMessage(`Added ${shortfallItems.length} shortfall item(s) to Shopping List!`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Action Notification */}
      {actionMessage && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <button className="text-white/70 hover:text-white" onClick={() => setActionMessage(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Planner Header */}
      <section className="pt-2 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
              {isHindi ? 'साप्ताहिक भोजन योजना' : 'Weekly Meal Planner'}
            </h1>
            <span className="text-[12px] text-[#424843]">
              Week of {weekStart} • Stock-synced planner
            </span>
          </div>

          <button
            className="px-3.5 py-2 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all hover:bg-[#132a1d]"
            onClick={handleAutoFillWeek}
            title="Auto-generate 7-day meal plan from kitchen stock"
          >
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">auto_awesome</span>
            <span>{isHindi ? 'AI सुझाव' : 'AI Auto-Plan'}</span>
          </button>
        </div>

        {/* Household Info Strip */}
        <div className="bg-white border border-[#E6E4DD] rounded-2xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#EDF2EE] flex items-center justify-center text-[#1A3826] shrink-0">
              <span className="material-symbols-outlined text-[20px]">apartment</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] text-[#1a1c1a] font-semibold truncate">
                Room 304 Hostel Flat
              </span>
              <span className="text-[11px] text-[#424843] truncate">
                Diners: Divyansh (100% Veg) &amp; Rohan (Non-Veg)
              </span>
            </div>
          </div>
          <button
            className="text-[11px] font-bold text-[#1A3826] bg-[#EDF2EE] px-2.5 py-1 rounded-full border border-[#D1E2D7]"
            onClick={onOpenVoice}
          >
            Ask Omnirush
          </button>
        </div>
      </section>

      {/* Horizontal 7-Day Calendar Strip */}
      <section className="overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-2" role="tablist">
          {days.map((d) => {
            const isSelected = selectedDayOffset === d.index;
            return (
              <button
                key={d.index}
                className={`flex flex-col items-center justify-center min-w-[56px] py-2 px-1 rounded-2xl transition-all border ${
                  isSelected
                    ? 'bg-[#1A3826] text-white border-[#1A3826] shadow-xs scale-102'
                    : 'bg-white text-[#424843] border-[#E6E4DD] hover:bg-[#f4f4f0]'
                }`}
                onClick={() => setSelectedDayOffset(d.index)}
              >
                <span className={`text-[10px] font-semibold ${isSelected ? 'text-[#c8ebd1]' : 'text-[#727972]'}`}>
                  {d.isToday ? 'TODAY' : d.dayLabel}
                </span>
                <span className="text-[17px] font-bold mt-0.5">{d.dayNumber}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${
                    isSelected ? 'bg-white' : d.isToday ? 'bg-[#1A3826]' : 'bg-transparent'
                  }`}
                ></span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Meals for Selected Day */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1c1a]">
            Meals for {days[selectedDayOffset]?.dayName}, {selectedDateStr}
          </h2>
          {onOpenRecipesTab && (
            <button
              className="text-[12px] font-semibold text-[#1A3826] hover:underline flex items-center gap-1"
              onClick={onOpenRecipesTab}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add from Graph RAG
            </button>
          )}
        </div>

        {slots.map((slot) => {
          const slotMeal = dayMeals.find((m) => m.slot === slot);

          if (!slotMeal) {
            return (
              <div
                key={slot}
                className="bg-white rounded-2xl p-4 border border-dashed border-[#D5D2C7] flex items-center justify-between"
              >
                <div>
                  <span className="text-[11px] font-bold text-[#727972] uppercase tracking-wider block">
                    {slot}
                  </span>
                  <span className="text-[13px] text-[#424843] italic">No meal scheduled yet</span>
                </div>
                {onOpenRecipesTab && (
                  <button
                    className="px-3 py-1.5 rounded-xl bg-[#f4f4f0] border border-[#E6E4DD] text-[12px] font-semibold text-[#1a1c1a] hover:bg-[#eeeeea]"
                    onClick={onOpenRecipesTab}
                  >
                    + Pick Recipe
                  </button>
                )}
              </div>
            );
          }

          const hasMissing = slotMeal.missing && slotMeal.missing.length > 0;
          const isDone = slotMeal.status === 'done';

          return (
            <div
              key={slotMeal.id}
              className={`rounded-2xl p-4 border transition-all flex flex-col gap-2.5 ${
                isDone
                  ? 'bg-[#F5F8F6] border-[#D1E2D7]'
                  : 'bg-white border-[#E6E4DD] shadow-xs'
              }`}
            >
              {/* Slot & Status Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#727972]">
                  {slotMeal.slot} • {slotMeal.servings} servings
                </span>
                {isDone ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] font-bold text-[10px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check</span>
                    Cooked &amp; Deducted
                  </span>
                ) : hasMissing ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] font-bold text-[10px]">
                    Missing Ingredients
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] font-bold text-[10px]">
                    Ready in Stock
                  </span>
                )}
              </div>

              {/* Title & Diners */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-bold text-[#1a1c1a] leading-tight">
                    {slotMeal.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[12px] text-[#424843] mt-0.5">
                    <span>
                      Diners: {slotMeal.diner_member_ids?.length || 2} members
                    </span>
                    <span>•</span>
                    <span className="text-[#1A3826] font-semibold">
                      ~{slotMeal.nutrition?.protein_g || 14}g Protein
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing Alert if any */}
              {hasMissing && !isDone && (
                <div className="p-2.5 bg-[#FAF6F0] border border-[#E9E1D6] rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[#B45309] text-[16px] shrink-0">
                      warning
                    </span>
                    <span className="text-[12px] text-[#B45309] font-medium truncate">
                      Short: {slotMeal.missing.map((m) => `${m.short_base} ${m.unit_base} ${m.name}`).join(', ')}
                    </span>
                  </div>
                  <button
                    className="text-[11px] font-bold text-[#B45309] underline hover:text-[#92400e] shrink-0"
                    onClick={() => handleAddShortfallToShop(slotMeal.missing)}
                  >
                    Add to Shop
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#E6E4DD]/60">
                <button
                  className="py-1.5 px-3 rounded-xl bg-white border border-[#E6E4DD] text-[12px] font-semibold text-[#1a1c1a] hover:bg-[#f4f4f0]"
                  onClick={() => onViewRecipe(slotMeal.household_recipe_id, slotMeal.servings)}
                >
                  View Details
                </button>

                {!isDone ? (
                  <button
                    className="flex-1 py-1.5 px-3 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#132a1d]"
                    onClick={() => handleMarkDone(slotMeal.id)}
                  >
                    <span className="material-symbols-outlined text-[16px]">soup_kitchen</span>
                    Mark as Cooked (Deduct)
                  </button>
                ) : (
                  <span className="text-[12px] text-[#1E4620] font-medium italic">
                    Stock ledger updated.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
