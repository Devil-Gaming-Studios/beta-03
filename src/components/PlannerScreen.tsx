import React, { useState, useEffect } from 'react';
import { store, getMonday } from '../services/store';
import {
  DayOfWeekKey,
  DayVarietyMode,
  GraphRecipe,
  MealSlot,
  PlannedMeal,
  UserDietMemory,
} from '../types';

interface PlannerScreenProps {
  isHindi: boolean;
  onOpenVoice: () => void;
  onViewRecipe: (recipeId: string, servings: number, planDate?: string, planSlot?: MealSlot) => void;
  onOpenRecipesTab: () => void;
}

const DAY_KEYS: DayOfWeekKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  isHindi,
  onOpenVoice,
  onViewRecipe,
}) => {
  const [weekStart] = useState(() => getMonday());
  const [plan, setPlan] = useState(() => store.getPlan(weekStart));
  const [dietMemory, setDietMemory] = useState<UserDietMemory>(() => store.getDietMemory());

  // Default selectedDayOffset to today's day of the week (0 = Mon .. 6 = Sun)
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(() => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sun, 1 = Mon ...
    return day === 0 ? 6 : day - 1;
  });

  const [notice, setNotice] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiPlanning, setIsAiPlanning] = useState(false);

  // Direct Recipe Picker Modal state for adding/changing recipes on a specific date & slot
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string>('');
  const [pickerSlot, setPickerSlot] = useState<MealSlot>('dinner');
  const [pickerReplaceId, setPickerReplaceId] = useState<string | null>(null);
  const [pickerServings, setPickerServings] = useState<number>(2);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [pickerFilter, setPickerFilter] = useState<'all' | 'regular' | 'new' | 'stock'>('all');
  const [pickerRecipes, setPickerRecipes] = useState<GraphRecipe[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const refreshPlan = () => {
    setPlan({ ...store.getPlan(weekStart) });
    setDietMemory({ ...store.getDietMemory() });
  };

  // Build 7-day calendar strip from canonical weekStart (Monday) using shared store helper
  const days =
    typeof (store as any).getWeekDays === 'function'
      ? store.getWeekDays(weekStart, isHindi)
      : DAY_KEYS.map((dayKey, idx) => {
          const parts = weekStart.split('-').map(Number);
          const d = new Date(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + idx);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayNum = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${dayNum}`;
          const now = new Date();
          const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          return {
            offset: idx,
            dayKey,
            dateStr,
            dayName: d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            monthShort: d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { month: 'short' }),
            isToday: dateStr === todayLocal,
            varietyMode: dietMemory.weekly_variety_schedule[dayKey] || 'regular',
          };
        });

  const selectedDay = days[selectedDayOffset] || days[0];
  const selectedDateStr = selectedDay.dateStr;
  const dayMeals =
    typeof (store as any).getMealsForDate === 'function'
      ? store.getMealsForDate(selectedDateStr)
      : (plan?.meals || []).filter((m) => m.meal_date === selectedDateStr);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // Fetch recipes when direct Recipe Picker is open
  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    const loadPickerRecipes = async () => {
      setPickerLoading(true);
      try {
        const me = store.getMe();
        const params = new URLSearchParams();
        if (pickerSearch.trim()) params.append('query', pickerSearch.trim());
        if (me.user.diet_pref === 'veg') params.append('diet_pref', 'veg');
        if (dietMemory.diet_goals.includes('protein_rich')) params.append('high_protein', 'true');
        params.append('limit', '35');

        const res = await fetch(`/api/graph/recipes?${params.toString()}`);
        if (res.ok && active) {
          const data = await res.json();
          setPickerRecipes(data.recipes || []);
        }
      } catch {
        // Fallback to local recipes
      } finally {
        if (active) setPickerLoading(false);
      }
    };
    loadPickerRecipes();
    return () => {
      active = false;
    };
  }, [pickerOpen, pickerSearch, dietMemory.diet_goals]);

  const openSlotPicker = (dateStr: string, slot: MealSlot, defaultServings = 2, replaceMealId: string | null = null) => {
    setPickerReplaceId(replaceMealId);
    setPickerDate(dateStr);
    setPickerSlot(slot);
    setPickerServings(defaultServings);
    setPickerSearch('');
    const dayObj = days.find((d) => d.dateStr === dateStr);
    if (dayObj?.varietyMode === 'new') {
      setPickerFilter('new');
    } else {
      setPickerFilter('all');
    }
    setPickerOpen(true);
  };

  const handleSelectRecipeForSlot = (item: {
    id: string;
    title: string;
    cuisine?: string;
    protein_g?: number;
    kcal?: number;
    variety_type?: 'regular' | 'new';
  }) => {
    const targetDay = days.find((d) => d.dateStr === pickerDate);
    const vType = item.variety_type || targetDay?.varietyMode || 'regular';
    store.addMeal(pickerDate, pickerSlot, item.id, pickerServings, ['mem_1', 'mem_2'], {
      title: item.title,
      cuisine: item.cuisine || 'Indian',
      variety_type: vType,
      protein_g: item.protein_g,
      kcal: item.kcal,
      ai_reason:
        vType === 'new'
          ? `Added as a ✨ New Discovery dish (${item.cuisine || 'Indian'}) for ${pickerSlot}.`
          : `Added to your ${pickerSlot} schedule (${item.cuisine || 'Indian'}).`,
    }, pickerReplaceId ? { replaceMealId: pickerReplaceId } : { append: true });
    store.refreshPlanShortages();
    setPickerReplaceId(null);
    setPickerOpen(false);
    refreshPlan();

    // Jump to the date if it's in the current week
    const idx = days.findIndex((d) => d.dateStr === pickerDate);
    if (idx >= 0) setSelectedDayOffset(idx);

    showToast(
      isHindi
        ? `${item.title} को ${pickerDate} (${pickerSlot}) में जोड़ा गया!`
        : `Scheduled "${item.title}" for ${pickerDate} (${pickerSlot})!`
    );
  };

  const handleToggleDayVariety = (dayKey: DayOfWeekKey) => {
    const cur = dietMemory.weekly_variety_schedule[dayKey] || 'regular';
    const next: DayVarietyMode = cur === 'regular' ? 'new' : 'regular';
    const updated = store.setDayVarietyMode(dayKey, next);
    setDietMemory({ ...updated });
    showToast(
      `${dayKey} marked as ${
        next === 'new'
          ? '✨ New Food Day (AI will pick new dishes)'
          : 'Regular Food Day (AI will plan from your past habitual diet)'
      }`
    );
  };

  const handleAiAutoPlanWeek = async () => {
    setIsAiPlanning(true);
    setAiSummary(null);
    try {
      const me = store.getMe();
      const stock = store.getStock('all');
      const currentDietMem = store.getDietMemory();
      const householdCautions = Array.from(
        new Set(me.members.flatMap((m) => m.cautions || []))
      );

      // Automatically include diabetes in diet_goals if any member has diabetes caution
      const mergedGoals = Array.from(
        new Set([
          ...currentDietMem.diet_goals,
          ...(householdCautions.includes('diabetes') ? ['diabetes'] : []),
        ])
      );

      const response = await fetch('/api/plan/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          days: days.map((d) => ({
            date: d.dateStr,
            dayKey: d.dayKey,
            varietyMode: currentDietMem.weekly_variety_schedule[d.dayKey] || 'regular',
          })),
          stock,
          userProfile: {
            diet_pref: me.user.diet_pref,
            is_beginner_cook: me.user.is_beginner_cook,
            cautions: householdCautions,
            diet_goals: mergedGoals,
          },
          dietMemory: {
            ...currentDietMem,
            diet_goals: mergedGoals,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI plan');
      }

      const data = await response.json();
      if (Array.isArray(data.meals) && data.meals.length > 0) {
        store.applyAIWeekPlan(weekStart, data.meals);
        refreshPlan();
        setAiSummary(
          data.summary ||
            `AI planned ${data.meals.length} meals across Regular & New Food days!`
        );
        showToast(
          isHindi
            ? 'Gemini AI और Graph RAG द्वारा पूरे सप्ताह का भोजन प्लान तैयार किया गया!'
            : `AI Auto-Planned ${data.meals.length} meals for the week using your stock, ${mergedGoals.join('/')} profile & our recipe collection!`
        );
      } else {
        store.autoFillWeekPlan(weekStart);
        refreshPlan();
        showToast('7-day meal plan created from our recipe collection & your diet history.');
      }
    } catch (err) {
      console.warn('AI Auto-Plan error, using local Graph RAG fallback:', err);
      store.autoFillWeekPlan(weekStart);
      refreshPlan();
      showToast('7-day meal plan populated using your Regular/New schedule & stock!');
    } finally {
      setIsAiPlanning(false);
    }
  };

  const handleMarkCooked = (meal: PlannedMeal) => {
    try {
      const res = store.markMealDone(meal.id);
      refreshPlan();
      showToast(
        isHindi
          ? `${meal.title} पक गया! स्टॉक अपडेट किया गया और नियमित आहार इतिहास में सहेजा गया।`
          : `Cooked ${meal.title}! Used from stock: ${res.deductions} (+${res.proteinPerDiner}g protein added)`
      );
    } catch (err: any) {
      showToast(err.message || 'Could not mark meal done');
    }
  };

  const handleRemoveMeal = (meal: PlannedMeal) => {
    store.removeMeal(meal.id, weekStart);
    refreshPlan();
    showToast(`Removed "${meal.title}" from ${meal.meal_date} (${meal.slot})`);
  };

  const slotsConfig: { slot: MealSlot; labelEn: string; labelHi: string; time: string; icon: string }[] = [
    { slot: 'breakfast', labelEn: 'Breakfast', labelHi: 'नाश्ता', time: '8:30 AM', icon: 'wb_twilight' },
    { slot: 'lunch', labelEn: 'Lunch', labelHi: 'दोपहर का भोजन', time: '1:00 PM', icon: 'light_mode' },
    { slot: 'dinner', labelEn: 'Dinner', labelHi: 'रात का खाना', time: '8:30 PM', icon: 'dark_mode' },
  ];

  // Calculate filtered list for the Recipe Picker modal
  const stockMap = store.getStockMap();
  const pastDishTitlesLower = new Set(
    dietMemory.past_regular_dishes.map((d) => d.title.toLowerCase().trim())
  );

  const getFilteredPickerItems = () => {
    if (pickerFilter === 'regular') {
      const q = pickerSearch.toLowerCase().trim();
      return dietMemory.past_regular_dishes
        .filter((d) => !q || d.title.toLowerCase().includes(q) || d.cuisine.toLowerCase().includes(q))
        .map((d) => ({
          id: d.recipe_id,
          title: d.title,
          cuisine: d.cuisine,
          course: d.course,
          protein_g: 15,
          kcal: 330,
          variety_type: 'regular' as const,
          badge: `Eaten ${d.times_eaten}x • Habitual Favorite`,
          matchedStock: d.ingredients.length,
          totalIngs: d.ingredients.length,
        }));
    }

    return pickerRecipes
      .filter((r) => {
        const isHabit = pastDishTitlesLower.has(r.name.toLowerCase().trim());
        if (pickerFilter === 'new' && isHabit) return false;
        if (pickerFilter === 'stock') {
          let matched = 0;
          r.ingredients.forEach((ing) => {
            const slug = ing.canonicalId.replace('ing_', '');
            if (stockMap[ing.canonicalId] || stockMap[slug]) matched++;
          });
          return matched > 0;
        }
        return true;
      })
      .map((r) => {
        let matched = 0;
        r.ingredients.forEach((ing) => {
          const slug = ing.canonicalId.replace('ing_', '');
          if (stockMap[ing.canonicalId] || stockMap[slug]) matched++;
        });
        const isHabit = pastDishTitlesLower.has(r.name.toLowerCase().trim());
        return {
          id: r.id,
          title: r.name,
          cuisine: r.cuisine || 'Indian',
          course: r.course || 'Main Course',
          protein_g: r.nutrientsEstimated?.protein_g || 13,
          kcal: r.nutrientsEstimated?.kcal || 320,
          variety_type: (isHabit ? 'regular' : 'new') as 'regular' | 'new',
          badge: isHabit ? 'Regular Diet Match' : '✨ New Dish',
          matchedStock: matched,
          totalIngs: r.ingredients.length,
        };
      });
  };

  const pickerItems = getFilteredPickerItems();

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-4">
      {/* Toast Notice */}
      {notice && (
        <div className="bg-[#1A3826] text-white px-4 py-3 rounded-2xl text-[13px] font-medium flex items-center justify-between shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Top Title & AI Auto-Plan Action */}
      <div className="flex items-center justify-between pt-2 gap-2">
        <div>
          <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight leading-tight">
            {isHindi ? 'साप्ताहिक भोजन योजना' : 'Weekly Meal Plan'}
          </h1>
          <p className="text-[12px] text-[#424843]">
            {isHindi
              ? 'स्टॉक, प्रोटीन/मधुमेह प्रोफ़ाइल और नियमित/नए दिनों के अनुसार'
              : `Week of ${days[0].monthShort} ${days[0].dayNum} - ${days[6].monthShort} ${days[6].dayNum}`}
          </p>
        </div>
        <button
          disabled={isAiPlanning}
          className="px-3.5 py-2.5 rounded-xl bg-[#1A3826] text-white text-[12.5px] font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all hover:bg-[#142d1e] disabled:opacity-60 shrink-0"
          onClick={handleAiAutoPlanWeek}
        >
          {isAiPlanning ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{isHindi ? 'AI प्लान कर रहा है...' : 'Planning Week...'}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
              <span>{isHindi ? 'AI ऑटो-प्लान (7 दिन)' : 'AI Auto-Plan'}</span>
            </>
          )}
        </button>
      </div>

      {/* Active Diet Goals & Regular/New Summary Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white px-3.5 py-2.5 rounded-2xl border border-[#E6E4DD] text-[11.5px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-[#424843]">AI Profile:</span>
          {dietMemory.diet_goals.length > 0 ? (
            dietMemory.diet_goals.map((g) => (
              <span
                key={g}
                className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#1A3826] font-bold border border-[#c8ebd1] capitalize"
              >
                {g === 'protein_rich'
                  ? '💪 High Protein'
                  : g === 'diabetes'
                  ? '🩸 Diabetes Low-GI'
                  : g.replace('_', ' ')}
              </span>
            ))
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-[#f4f4f0] text-[#424843] font-medium">
              Balanced Home Diet
            </span>
          )}
          <span className="text-[#727972]">•</span>
          <span className="text-[#424843] font-medium">
            Regions: <strong>{dietMemory.preferred_regions.slice(0, 2).join(', ')}</strong>
          </span>
        </div>
      </div>

      {/* AI Plan Summary Banner (when generated) */}
      {aiSummary && (
        <div className="p-3.5 rounded-2xl bg-[#EDF2EE] border border-[#c8ebd1] text-[#1A3826] text-[12.5px] flex items-start justify-between gap-2 animate-fade-in">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] mt-0.5">psychology</span>
            <div>
              <span className="font-bold block">Your AI Weekly Plan is Ready</span>
              <span className="text-[12px] text-[#1E4620] leading-snug">{aiSummary}</span>
            </div>
          </div>
          <button onClick={() => setAiSummary(null)} className="text-[#1A3826]/70 hover:text-[#1A3826]">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Horizontal 7-Day Selector Strip with Regular vs. New Badges */}
      <div className="grid grid-cols-7 gap-1.5 py-1">
        {days.map((d) => {
          const isSelected = d.offset === selectedDayOffset;
          const hasMeals = plan.meals.some((m) => m.meal_date === d.dateStr);
          const isNewDay = d.varietyMode === 'new';
          return (
            <button
              key={d.dateStr}
              onClick={() => setSelectedDayOffset(d.offset)}
              className={`h-[80px] rounded-2xl flex flex-col items-center justify-between py-2 px-1 transition-all border ${
                isSelected
                  ? 'bg-[#1A3826] text-white border-[#1A3826] shadow-md scale-[1.03]'
                  : 'bg-white text-[#1a1c1a] border-[#E6E4DD] hover:bg-[#f4f4f0]'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isSelected ? 'text-[#c8ebd1]' : 'text-[#727972]'
                }`}
              >
                {d.dayName}
              </span>
              <span className="text-[17px] font-bold leading-none">{d.dayNum}</span>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    isNewDay
                      ? isSelected
                        ? 'bg-[#fbbf24] text-[#1a1c1a]'
                        : 'bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6]'
                      : isSelected
                      ? 'bg-[#c8ebd1] text-[#1A3826]'
                      : 'bg-[#EDF2EE] text-[#1A3826]'
                  }`}
                >
                  {isNewDay ? '✨NEW' : 'REG'}
                </span>
                {hasMeals && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-[#1A3826]'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Variety Mode Banner & Quick Toggle */}
      <div
        className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
          selectedDay.varietyMode === 'new'
            ? 'bg-[#FAF6F0] border-[#E9E1D6] text-[#92400e]'
            : 'bg-[#EDF2EE] border-[#c8ebd1] text-[#1A3826]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[20px]">
            {selectedDay.varietyMode === 'new' ? 'auto_awesome' : 'history'}
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-bold leading-tight">
              {selectedDay.dayName} ({selectedDay.monthShort} {selectedDay.dayNum}):{' '}
              {selectedDay.varietyMode === 'new'
                ? isHindi
                  ? '✨ नया व्यंजन दिवस (New Discovery Food)'
                  : '✨ New Food Discovery Day'
                : isHindi
                ? 'नियमित आहार दिवस (Regular Habitual Food)'
                : 'Regular Habitual Food Day'}
            </div>
            <div className="text-[11px] opacity-85 truncate">
              {selectedDay.varietyMode === 'new'
                ? 'AI picks new regional dishes you don’t usually eat'
                : 'AI plans familiar meals from what you usually eat & your stock'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleToggleDayVariety(selectedDay.dayKey)}
          className="px-2.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-[#1a1c1a] text-[11px] font-bold border border-black/10 shrink-0 shadow-2xs active:scale-95 transition-all"
        >
          Switch to {selectedDay.varietyMode === 'new' ? 'Regular' : '✨ New Food'}
        </button>
      </div>

      {/* Meal Slots for Selected Day */}
      <div className="flex flex-col gap-3">
        {slotsConfig.map((sc) => {
          const slotMeals = dayMeals.filter((m) => m.slot === sc.slot);
          const meal = slotMeals[0];
          const isCooked = slotMeals.length > 0 && slotMeals.every((m) => m.status === 'done');
          const missingCount = slotMeals.reduce(
            (acc, m) => acc + (m.status === 'done' ? 0 : m.missing?.length || 0),
            0
          );
          const isNewVariety =
            (meal?.variety_type || selectedDay.varietyMode) === 'new';

          return (
            <div
              key={sc.slot}
              className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3"
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between border-b border-[#E6E4DD]/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3b684a] text-[18px]">
                    {sc.icon}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#424843]">
                    {isHindi ? sc.labelHi : sc.labelEn}
                  </span>
                  <span className="text-[11px] text-[#727972]">• {sc.time}</span>
                </div>

                {meal ? (
                  <div className="flex items-center gap-1.5">
                    {isNewVariety ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[10px] font-bold border border-[#E9E1D6]">
                        ✨ New Discovery
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#1A3826] text-[10px] font-bold border border-[#c8ebd1]">
                        Regular Favorite
                      </span>
                    )}
                    {isCooked ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] text-[11px] font-bold">
                        ✓ Cooked
                      </span>
                    ) : missingCount === 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] text-[11px] font-semibold">
                        In Stock
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold border border-[#E9E1D6]">
                        Short {missingCount} item{missingCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={() => openSlotPicker(selectedDateStr, sc.slot, 2)}
                      className="px-2 py-0.5 rounded-full bg-[#1A3826] text-white text-[10.5px] font-bold flex items-center gap-0.5 active:scale-95 transition-all"
                      title="Add another item to this meal"
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      {isHindi ? 'और जोड़ें' : 'Add item'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openSlotPicker(selectedDateStr, sc.slot, 2)}
                    className="px-2.5 py-1 rounded-lg bg-[#EDF2EE] text-[#1A3826] text-[11.5px] font-bold hover:bg-[#d8e6db] flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    {isHindi ? '+ रेसिपी जोड़ें' : '+ Pick Recipe'}
                  </button>
                )}
              </div>

              {/* Meal Content */}
              {slotMeals.length > 0 ? (
                <div className="flex flex-col gap-3">
                {slotMeals.map((meal, mealIdx) => {
                  const isCooked = meal.status === 'done';
                  const missingCount = meal.missing?.length || 0;
                  return (
                <div
                  key={meal.id}
                  className={`flex flex-col gap-2.5 ${mealIdx > 0 ? 'pt-3 border-t border-[#E6E4DD]/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-bold text-[#1a1c1a] leading-snug">
                          {meal.title}
                        </h3>
                        {meal.cuisine && (
                          <span className="px-2 py-0.5 rounded-md bg-[#f4f4f0] text-[#424843] text-[10.5px] font-semibold border border-[#E6E4DD]">
                            {meal.cuisine}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#424843] mt-0.5">
                        {meal.servings} Servings •{' '}
                        <strong className="text-[#1A3826]">{meal.nutrition?.protein_g || 14}g Protein</strong>{' '}
                        • {meal.nutrition?.kcal || 340} kcal
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          onViewRecipe(meal.household_recipe_id, meal.servings, selectedDateStr, sc.slot)
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-[#f4f4f0] hover:bg-[#e5e5e0] text-[11.5px] font-semibold text-[#1a1c1a] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">tune</span>
                        {isHindi ? 'मात्रा' : 'Scale'}
                      </button>
                      <button
                        onClick={() => openSlotPicker(selectedDateStr, sc.slot, meal.servings, meal.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#EDF2EE] hover:bg-[#d8e6db] text-[11.5px] font-semibold text-[#1A3826] flex items-center gap-1"
                        title="Change recipe for this slot"
                      >
                        <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                        {isHindi ? 'बदलें' : 'Change'}
                      </button>
                      <button
                        onClick={() => handleRemoveMeal(meal)}
                        className="w-7 h-7 rounded-xl hover:bg-[#fee2e2] text-[#727972] hover:text-[#9E2A2B] flex items-center justify-center"
                        title="Remove from slot"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>

                  {/* Diet Tags & AI Reason */}
                  {(meal.ai_reason || (meal.diet_tags && meal.diet_tags.length > 0)) && (
                    <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-1.5">
                      {meal.diet_tags && meal.diet_tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {meal.diet_tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[10px] font-bold text-[#1A3826]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {meal.ai_reason && (
                        <p className="text-[11.5px] text-[#424843] leading-snug flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-[#3b684a] mt-0.5 shrink-0">
                            auto_awesome
                          </span>
                          <span>{meal.ai_reason}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Missing Ingredients Alert */}
                  {missingCount > 0 && !isCooked && (
                    <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E9E1D6] text-[11.5px] text-[#B45309] flex items-center justify-between">
                      <span>
                        Missing:{' '}
                        {meal.missing
                          .map((m) => `${m.name} (${m.short_base}${m.unit_base})`)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Mark Cooked Button */}
                  {!isCooked && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleMarkCooked(meal)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">soup_kitchen</span>
                        {isHindi
                          ? 'पकाया गया (स्टॉक घटाएं और प्रोटीन जोड़ें)'
                          : 'Mark Cooked (Use Stock & Track Protein)'}
                      </button>
                    </div>
                  )}
                </div>
                  );
                })}
                </div>
              ) : (
                <div className="py-4 text-center text-[#727972] text-[12.5px] flex flex-col items-center gap-2">
                  <span>
                    {isHindi
                      ? 'इस समय के लिए कोई भोजन निर्धारित नहीं है'
                      : `No meal scheduled for ${sc.labelEn} on ${selectedDay.dayName}, ${selectedDay.monthShort} ${selectedDay.dayNum}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openSlotPicker(selectedDateStr, sc.slot, 2)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                      {isHindi ? 'रेसिपी चुनें' : 'Add Recipe to this Date'}
                    </button>
                    <button
                      onClick={onOpenVoice}
                      className="px-3 py-1.5 rounded-xl bg-[#EDF2EE] text-[#1A3826] text-[12px] font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">mic</span>
                      {isHindi ? 'बोलकर जोड़ें' : 'Ask Omnirush'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Direct Add / Change Recipe Modal for Selected Date & Slot */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-5 shadow-2xl border border-[#E6E4DD] max-h-[90vh] flex flex-col gap-3.5 text-[#1a1c1a]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E6E4DD] pb-3">
              <div>
                <h3 className="text-[17px] font-bold text-[#1a1c1a]">
                  {isHindi ? 'तारीख और स्लॉट के लिए रेसिपी चुनें' : 'Schedule Recipe to Date & Slot'}
                </h3>
                <p className="text-[12px] text-[#424843]">
                  Pick from your Regular Diet History or 6,800+ Graph RAG Indian dishes
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f4f4f0] flex items-center justify-center text-[#424843]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Target Date, Slot & Servings Bar */}
            <div className="grid grid-cols-3 gap-2 bg-[#FAF9F6] p-2.5 rounded-2xl border border-[#E6E4DD]">
              <div>
                <label className="text-[10px] font-bold text-[#727972] uppercase block mb-0.5">
                  Date
                </label>
                <input
                  type="date"
                  value={pickerDate}
                  onChange={(e) => setPickerDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl bg-white border border-[#E6E4DD] text-[12px] font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#727972] uppercase block mb-0.5">
                  Meal Slot
                </label>
                <select
                  value={pickerSlot}
                  onChange={(e) => setPickerSlot(e.target.value as MealSlot)}
                  className="w-full px-2 py-1.5 rounded-xl bg-white border border-[#E6E4DD] text-[12px] font-semibold capitalize"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#727972] uppercase block mb-0.5">
                  Servings
                </label>
                <div className="flex items-center gap-1.5 bg-white border border-[#E6E4DD] rounded-xl px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setPickerServings((s) => Math.max(1, s - 1))}
                    className="w-6 h-6 rounded-lg bg-[#f4f4f0] font-bold text-[14px]"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-[13px] text-[#1A3826]">
                    {pickerServings}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerServings((s) => Math.min(12, s + 1))}
                    className="w-6 h-6 rounded-lg bg-[#f4f4f0] font-bold text-[14px]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#727972] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search by dish, region or ingredient (e.g. Paneer, Moong, Dosa, Palak)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12.5px] focus:outline-none focus:border-[#1A3826]"
              />
            </div>

            {/* Filter Pills: All, Regular History, New Discovery, Stock Match */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All New Dishes' },
                { id: 'regular', label: 'My Regular Diet' },
                { id: 'new', label: '✨ New Discoveries' },
                { id: 'stock', label: 'In Kitchen Stock' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPickerFilter(tab.id as any)}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-semibold shrink-0 border transition-all ${
                    pickerFilter === tab.id
                      ? 'bg-[#1A3826] text-white border-[#1A3826]'
                      : 'bg-[#FAF9F6] text-[#424843] border-[#E6E4DD]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recipe Results List */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[320px] pr-1">
              {pickerLoading ? (
                <div className="py-8 text-center text-[12.5px] text-[#727972] flex flex-col items-center gap-2">
                  <span className="w-5 h-5 border-2 border-[#1A3826] border-t-transparent rounded-full animate-spin" />
                  <span>Searching recipes...</span>
                </div>
              ) : pickerItems.length === 0 ? (
                <div className="py-6 text-center text-[12.5px] text-[#727972]">
                  No recipes found for this filter. Try searching another dish or ingredient.
                </div>
              ) : (
                pickerItems.map((item) => (
                  <div
                    key={item.id + item.title}
                    className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DD] hover:border-[#1A3826]/50 flex items-center justify-between gap-2 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13.5px] font-bold text-[#1a1c1a] truncate">
                          {item.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                            item.variety_type === 'new'
                              ? 'bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6]'
                              : 'bg-[#EDF2EE] text-[#1A3826]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#424843] mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{item.cuisine}</span>
                        <span>•</span>
                        <span className="font-semibold text-[#1A3826]">
                          {item.protein_g}g Protein
                        </span>
                        <span>•</span>
                        <span>
                          Stock: {item.matchedStock}/{item.totalIngs} ingredients
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectRecipeForSlot(item)}
                      className="px-3 py-2 rounded-xl bg-[#1A3826] text-white text-[11.5px] font-semibold shrink-0 active:scale-95 transition-all hover:bg-[#132a1d]"
                    >
                      + Add to {pickerSlot}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
