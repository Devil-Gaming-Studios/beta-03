import React, { useState } from 'react';
import { NavTab } from './KitchenSyncNavbar';
import { store, getMonday, getTodayStr } from '../services/store';
import { MealSlot, PlannedMeal } from '../types';

interface HomeScreenProps {
  isHindi: boolean;
  onNavigate: (tab: NavTab) => void;
  onOpenVoice: () => void;
  onOpenScan?: (mode: 'receipt' | 'fridge') => void;
  onViewRecipe?: (recipeId: string, servings: number, planDate?: string, planSlot?: MealSlot) => void;
}

const SLOT_META: Record<
  MealSlot,
  {
    labelEn: string;
    labelHi: string;
    timeLabel: string;
    icon: string;
    bgImg: string;
  }
> = {
  breakfast: {
    labelEn: 'Breakfast',
    labelHi: 'नाश्ता',
    timeLabel: '8:30 AM',
    icon: 'free_breakfast',
    bgImg:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDnYDJhFkcs3SWuZ9Bx4PG0p8hhMjthagEBPP-RJJ0osXsH_kQ8-j05rcMJO15Glllf3HAlZDW4i2B7npFXquHF-bIoIHeRQEPJvqmvPcIqkr41oUnTG_shbg9e8PFqW_W769cEc4Yfa3eBkVnaozFFQCLi3X0vv4tJQDor5p32y9_ElCglrxikG6s6B73KRFbMSuyNOJQRmIrGyexVsv6r7e2nqsBxpLvElKZdMtg',
  },
  lunch: {
    labelEn: 'Lunch',
    labelHi: 'दोपहर का खाना',
    timeLabel: '1:30 PM',
    icon: 'lunch_dining',
    bgImg:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAMb5tQkBQn4GmN3kUcboZ-y_zhJjxAGEZPzCVJ8NQPyGKJ4xUf8CbujQiQ9aIbe9qgYb_LBjxh_6ESUdsjyCDMvfv4sqxn7WD3QbhMQj31E3blxOhhNzZTU_hZvhjEozSAMtarYaIGK74kXv7YAvktJCKw-WoYjOKMU9jBrdQVl78JSrug8Y4pNqa0AunpH6zXQoogjPF82v-EjXtJFT-rAySeOjUs1D0eEcvqaGw',
  },
  dinner: {
    labelEn: 'Dinner',
    labelHi: 'रात का खाना',
    timeLabel: '8:30 PM',
    icon: 'dinner_dining',
    bgImg:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDMd98cyEV-yWYvfqgo73Sovw0-2kuwXTJHhwES6mEUDRE_D9sv9x-Yk6OR773HDUUhy7xfHMPsQ7ZrMKTazJDIEyQP8wNNUPW5nMxqwWjDpXOTCN40djk5Z2Z0VR3otPp3JKOk3tzNTw1Za9TQPRh6-gIgxK9iiEU0SGl7pswMtYmOilxub99XN8EMfthFerpzQ2z90qZATqfg1my-fi-kLKtuiLaS6lwi-_wMLhM',
  },
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  isHindi,
  onNavigate,
  onOpenVoice,
  onOpenScan,
  onViewRecipe,
}) => {
  const [showExpiryAlert, setShowExpiryAlert] = useState(true);
  const [expiryAdded, setExpiryAdded] = useState(false);
  const [didiNote, setDidiNote] = useState('Kam namak aur bina pyaaz wali daal');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [quickAddNotice, setQuickAddNotice] = useState<string | null>(null);
  const [, setRefreshTick] = useState(0);

  const refresh = () => setRefreshTick((t) => t + 1);

  const todayStr = getTodayStr();
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getTodayStr());
  const weekMonday = getMonday();
  const plan = store.getPlan(weekMonday);
  const dietMemory = store.getDietMemory();

  const weekDays =
    typeof (store as any).getWeekDays === 'function'
      ? store.getWeekDays(weekMonday, isHindi)
      : (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((dayKey, idx) => {
          const parts = weekMonday.split('-').map(Number);
          const d = new Date(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + idx);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayNum = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${dayNum}`;
          return {
            offset: idx,
            dayKey,
            dateStr,
            dayName: d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { weekday: 'short' }),
            dayNum: d.getDate(),
            monthShort: d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', { month: 'short' }),
            isToday: dateStr === todayStr,
            varietyMode: dietMemory?.weekly_variety_schedule?.[dayKey] || 'regular',
          };
        });

  const activeDateStr = weekDays.some((d) => d.dateStr === selectedDateStr)
    ? selectedDateStr
    : todayStr;
  const selectedDayInfo = weekDays.find((d) => d.dateStr === activeDateStr);
  const dayMeals =
    typeof (store as any).getMealsForDate === 'function'
      ? store.getMealsForDate(activeDateStr)
      : (plan?.meals || []).filter((m) => m.meal_date === activeDateStr);
  const me = store.getMe();
  const recipesCount = store.getRecipes().length;
  const planCheck = store.planCheck(weekMonday);
  const expiringStock =
    typeof (store as any).getExpiringStock === 'function'
      ? store.getExpiringStock(3)
      : store
          .getStock('all')
          .filter(
            (i) =>
              i.qty_base > 0 &&
              ((i.shelf_life_days !== undefined && i.shelf_life_days <= 3) || Boolean(i.expiry))
          );

  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
  const todayMealsBySlot: Record<MealSlot, PlannedMeal | undefined> = {
    breakfast: dayMeals.find((m) => m.slot === 'breakfast'),
    lunch: dayMeals.find((m) => m.slot === 'lunch'),
    dinner: dayMeals.find((m) => m.slot === 'dinner'),
  };

  const handleMarkMealDone = (e: React.MouseEvent, meal: PlannedMeal) => {
    e.stopPropagation();
    try {
      const res = store.markMealDone(meal.id);
      if (res.alreadyDone) {
        setQuickAddNotice(`"${meal.title}" is already marked as cooked!`);
      } else {
        setQuickAddNotice(
          `Marked "${meal.title}" as Cooked! Deducted: ${res.deductions || 'kitchen stock'}`
        );
      }
      refresh();
    } catch (err: any) {
      setQuickAddNotice(err.message || 'Could not mark meal done');
    }
    setTimeout(() => setQuickAddNotice(null), 4000);
  };

  const handleRestockMissing = (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = store.restockAllMissingItems(weekMonday);
    setQuickAddNotice(
      `Added ${res.appliedItems.length} missing item(s) to Kitchen Stock! All meals ready.`
    );
    refresh();
    setTimeout(() => setQuickAddNotice(null), 3500);
  };

  const handleAddPalak = () => {
    store.setMealSlot(activeDateStr, 'dinner', 'Dal Palak (Spinach Lentils)', 2);
    setExpiryAdded(true);
    refresh();
    setQuickAddNotice('Added Dal Palak to dinner menu! Expiry optimized.');
    setTimeout(() => {
      setQuickAddNotice(null);
      setShowExpiryAlert(false);
    }, 3000);
  };

  const handleMealClick = (meal: PlannedMeal) => {
    if (onViewRecipe) {
      onViewRecipe(meal.household_recipe_id, meal.servings, meal.meal_date, meal.slot);
    }
  };

  // Compute real daily protein goal from today's planned & cooked meals
  const todayMealsList = slots.map((s) => todayMealsBySlot[s]).filter(Boolean) as PlannedMeal[];
  const cookedProteinG = todayMealsList
    .filter((m) => m.status === 'done')
    .reduce((acc, m) => acc + (m.nutrition?.protein_g || 14), 0);
  const totalPlannedProteinG = todayMealsList.reduce(
    (acc, m) => acc + (m.nutrition?.protein_g || 14),
    0
  );
  const targetProteinG = Math.max(me.members[0]?.protein_target_g || 70, totalPlannedProteinG, 60);
  const proteinPct = Math.min(100, Math.round((cookedProteinG / targetProteinG) * 100));
  const strokeDashoffset = Math.round(238.7 * (1 - proteinPct / 100));

  return (
    <div className="flex flex-col w-full px-4 pb-8 max-w-xl mx-auto gap-y-4">
      {/* Quick notice toast */}
      {quickAddNotice && (
        <div className="sticky top-20 z-40 bg-[#1A3826] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 border border-[#81a28a]/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{quickAddNotice}</span>
          </div>
          <button className="text-white/70 hover:text-white" onClick={() => setQuickAddNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Household & Offline Status Ribbon */}
      <section className="flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] border border-[#E6E4DD] shrink-0">
            <span className="material-symbols-outlined text-[#3b684a] text-[18px]">location_on</span>
            <span className="text-[13px] font-semibold truncate max-w-[200px]">
              {me.household.name}
            </span>
            <span className="text-[#424843] text-[12px]">
              ({me.members.map((m) => m.name).join(' & ')})
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#E8F0EC] text-[#1E4620] border border-[#D1E2D7] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#1A3826] animate-pulse"></span>
            <span className="text-[12px] font-semibold">Live DB Synced</span>
          </div>
        </div>

        {/* Offline Readiness Notification Chip */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f4f4f0] border border-[#E6E4DD] text-[#1a1c1a]">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[#3b684a] text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              cloud_done
            </span>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-[#032212]">
                Offline ready • {recipesCount} recipes cached
              </span>
              <span className="text-[11px] text-[#424843]">
                {isHindi ? 'बिना इंटरनेट के भी चलेगा' : 'Functions completely offline'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#727972] text-[18px]">verified_user</span>
        </div>

        {/* Voice Assistant Hero Card */}
        <div
          onClick={onOpenVoice}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1A3826] to-[#254d35] text-white flex items-center justify-between gap-3 shadow-md cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-[24px] text-white">mic</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold">Omnirush Voice Assistant</span>
                <span className="text-[10px] bg-white/20 text-[#c8ebd1] font-semibold px-2 py-0.2 rounded-full">
                  Offline STT
                </span>
              </div>
              <span className="text-[11px] text-white/80">
                {isHindi
                  ? 'बोलें: "सारा जरूरी सामान खरीद लिया" या "2 किलो आलू जोड़ दो"'
                  : 'Say: "I bought everything required" or "add 2 kg potatoes"'}
              </span>
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-full bg-white text-[#1A3826] flex items-center justify-center shrink-0 shadow-xs"
            title="Start Voice Assistant"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </div>
        </div>
      </section>

      {/* Smart Pantry Alert Ribbon: Warm Cream Card */}
      {showExpiryAlert && expiringStock.length > 0 && (
        <section className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E9E1D6] text-[#1a1c1a] flex items-start gap-3 shadow-xs">
          <div className="p-2 rounded-full bg-[#F2ECE1] text-[#B45309] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">notifications_active</span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#1a1c1a]">
                Expiry Alert • {isHindi ? 'तुरंत इस्तेमाल करें' : 'Expiring Soon'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#B45309] text-[11px] font-semibold">
                {expiringStock.length} Items
              </span>
            </div>
            <p className="text-[13px] text-[#424843] mt-1 leading-snug">
              {expiringStock.slice(0, 2).map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 && ' & '}
                  <strong className="font-semibold text-[#1a1c1a]">{item.name}</strong>
                </React.Fragment>
              ))}{' '}
              expiring soon. Plan Dal Palak tonight?
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                className="px-3 py-1.5 rounded-full bg-[#1A3826] text-white text-[12px] font-semibold active:scale-95 transition-all flex items-center gap-1.5 shadow-xs hover:bg-[#132a1d]"
                type="button"
                onClick={handleAddPalak}
              >
                <span className="material-symbols-outlined text-[16px]">soup_kitchen</span>
                <span>{expiryAdded ? 'Added to Dinner' : 'Add Palak to Dinner'}</span>
              </button>
              <button
                className="px-3 py-1.5 rounded-full bg-white border border-[#E9E1D6] text-[#1a1c1a] text-[12px] font-medium active:scale-95 transition-transform hover:bg-[#F2ECE1]"
                type="button"
                onClick={() => setShowExpiryAlert(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Today's Meal Calendar Section (Pulled live from Unified Store Database Table) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <h2 className="text-[18px] text-[#1a1c1a] flex items-center gap-2 font-bold flex-wrap">
              <span>
                {activeDateStr === todayStr
                  ? isHindi
                    ? 'आज का खाना'
                    : "Today's Planned Meals"
                  : `${selectedDayInfo?.dayName || ''} Planned Meals`}
              </span>
              <span className="text-[#424843] font-normal text-[15px]">•</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[12px] font-medium">
                {selectedDayInfo ? `${selectedDayInfo.dayName}, ${selectedDayInfo.monthShort} ${selectedDayInfo.dayNum}` : activeDateStr}
              </span>
              {selectedDayInfo && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedDayInfo.varietyMode === 'new'
                      ? 'bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6]'
                      : 'bg-[#EDF2EE] text-[#1A3826] border border-[#c8ebd1]'
                  }`}
                >
                  {selectedDayInfo.varietyMode === 'new' ? '✨ New Food Day' : 'Regular Day'}
                </span>
              )}
            </h2>
            <span className="text-[11px] text-[#424843]">
              Synced live with Calendar Plan • Tap meal card for complete recipe • Tap ✓ button to mark cooked
            </span>
          </div>
          <button
            className="text-[12px] text-[#3b684a] font-semibold flex items-center gap-0.5 shrink-0"
            type="button"
            onClick={() => onNavigate('planner')}
          >
            <span>{isHindi ? 'प्लानर' : 'Open Calendar'}</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* Synced 7-Day Week Selector Strip (Directly backed by the same Week Meal Plan table) */}
        <div className="grid grid-cols-7 gap-1.5 bg-[#f4f4f0] p-1.5 rounded-2xl border border-[#E6E4DD]">
          {weekDays.map((wd) => {
            const isSelected = wd.dateStr === activeDateStr;
            const isToday = wd.dateStr === todayStr;
            const countForDay = plan.meals.filter((m) => m.meal_date === wd.dateStr).length;
            return (
              <button
                key={wd.dateStr}
                type="button"
                onClick={() => setSelectedDateStr(wd.dateStr)}
                className={`py-1.5 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all relative ${
                  isSelected
                    ? 'bg-[#1A3826] text-white shadow-xs'
                    : 'bg-white text-[#1a1c1a] hover:bg-[#EDF2EE]'
                }`}
              >
                <span className={`text-[9.5px] font-bold uppercase ${isSelected ? 'text-[#c8ebd1]' : 'text-[#727972]'}`}>
                  {wd.dayName}
                </span>
                <span className="text-[13px] font-extrabold leading-none">{wd.dayNum}</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {isToday && (
                    <span
                      className={`text-[8px] font-extrabold px-1 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#E8F0EC] text-[#1A3826]'
                      }`}
                    >
                      TODAY
                    </span>
                  )}
                  {!isToday && (
                    <span className={`text-[8.5px] font-semibold ${isSelected ? 'text-white/80' : 'text-[#727972]'}`}>
                      {countForDay}/3
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {slots.map((slot) => {
          const meal = todayMealsBySlot[slot];
          const meta = SLOT_META[slot];

          if (!meal) {
            return (
              <article
                key={slot}
                className="p-3.5 rounded-xl bg-white border border-dashed border-[#D1E2D7] flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#f4f4f0] border border-[#E6E4DD] flex items-center justify-center text-[#727972]">
                    <span className="material-symbols-outlined text-[24px]">{meta.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wider text-[#727972] font-semibold">
                      {isHindi ? meta.labelHi : meta.labelEn} • {meta.timeLabel}
                    </span>
                    <span className="text-[14px] font-bold text-[#424843]">
                      {isHindi ? 'कोई डिश प्लान नहीं है' : `No ${meta.labelEn} Planned Yet`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="px-3 py-1.5 rounded-xl bg-[#EDF2EE] text-[#1A3826] text-[12px] font-bold hover:bg-[#d8e6db] active:scale-95 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Plan Meal</span>
                </button>
              </article>
            );
          }

          const isDone = meal.status === 'done';
          const missingList = meal.missing || [];
          const hasMissing = !isDone && missingList.length > 0;
          const proteinVal = meal.nutrition?.protein_g || 16;
          const kcalVal = meal.nutrition?.kcal || 360;

          return (
            <article
              key={meal.id}
              onClick={() => handleMealClick(meal)}
              className={`p-3.5 rounded-xl bg-white border transition-all flex flex-col gap-3 shadow-xs cursor-pointer hover:border-[#3b684a] ${
                isDone ? 'border-[#c8ebd1] bg-[#fafdfa]' : 'border-[#E6E4DD]'
              }`}
            >
              <div className="flex gap-3">
                {/* Meal Icon / Thumbnail with Mark as Done overlay button */}
                <div className="relative w-22 h-22 rounded-xl overflow-hidden shrink-0 bg-[#eeeeea] border border-[#E6E4DD] flex flex-col justify-between">
                  <img
                    alt={meal.title}
                    className={`w-full h-full object-cover transition-opacity ${
                      isDone ? 'opacity-80' : 'opacity-95'
                    }`}
                    src={meta.bgImg}
                  />
                  {/* Top status badge on icon */}
                  <span
                    className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold backdrop-blur-xs ${
                      isDone
                        ? 'bg-[#137333] text-white'
                        : 'bg-white/90 text-[#1a1c1a]'
                    }`}
                  >
                    {isDone ? '✓ Cooked' : meta.timeLabel}
                  </span>

                  {/* Mark as Done Button directly on the meal icon */}
                  {!isDone ? (
                    <button
                      type="button"
                      onClick={(e) => handleMarkMealDone(e, meal)}
                      title="Mark this meal as cooked"
                      className="absolute bottom-1 inset-x-1 py-1 px-1.5 rounded-lg bg-[#1A3826]/95 hover:bg-[#0f2618] text-white text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      <span>Mark Done</span>
                    </button>
                  ) : (
                    <div className="absolute bottom-1 inset-x-1 py-0.5 px-1.5 rounded-lg bg-[#EDF2EE]/95 text-[#137333] text-[10px] font-bold flex items-center justify-center gap-0.5 border border-[#c8ebd1]">
                      <span className="material-symbols-outlined text-[12px]">task_alt</span>
                      <span>Done</span>
                    </div>
                  )}
                </div>

                {/* Meal Title & Metadata */}
                <div className="flex flex-col flex-1 min-w-0 justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-[#727972] font-semibold">
                        {isHindi ? meta.labelHi : meta.labelEn} • {meta.timeLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {meal.variety_type === 'new' ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6] text-[9.5px] font-bold">
                            ✨ New Dish
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-[#EDF2EE] text-[#1A3826] text-[9.5px] font-bold">
                            Regular
                          </span>
                        )}
                        <span
                          className="w-4 h-4 rounded-xs border border-[#137333] p-[2px] flex items-center justify-center bg-white"
                          title="Vegetarian"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                        </span>
                      </div>
                    </div>

                    <h3 className="text-[15px] text-[#1a1c1a] font-bold truncate mt-0.5">
                      {meal.title}
                    </h3>
                    <span className="text-[11.5px] text-[#3b684a] font-medium flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">menu_book</span>
                      <span>Tap card for complete recipe &amp; steps</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11.5px] text-[#424843]">
                      <span className="material-symbols-outlined text-[14px]">group</span>{' '}
                      {meal.servings} Servings
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#eeeeea] text-[#1a1c1a] text-[11px] font-medium">
                      {kcalVal} kcal
                    </span>
                    {!hasMissing ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[11px] font-semibold flex items-center gap-1 border border-[#D1E2D7]">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>{' '}
                        {isDone ? 'Stock Deducted' : 'Stock OK'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] text-[11px] font-semibold flex items-center gap-1 border border-[#E9E1D6]">
                        <span className="material-symbols-outlined text-[13px]">warning</span> Short{' '}
                        {missingList.length} item{missingList.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Real Ingredient Shortage Banner from Database */}
              {hasMissing && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E9E1D6] text-[#1a1c1a] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="material-symbols-outlined text-[#B45309] text-[18px] shrink-0">
                        warning
                      </span>
                      <span className="text-[12px] font-semibold text-[#1a1c1a] truncate">
                        Missing: {missingList.map((m) => `${m.name} (${m.short_base}${m.unit_base})`).join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-[#424843]">
                      Bought these items? Update kitchen stock immediately:
                    </span>
                    <button
                      className="px-3 py-1 rounded-full bg-[#1A3826] text-white text-[11.5px] font-semibold flex items-center gap-1 active:scale-95 transition-all hover:bg-[#132a1d]"
                      type="button"
                      onClick={handleRestockMissing}
                    >
                      <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                      <span>+ Bought Required Items</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Card Footer: Protein, Recipe View button, and Mark as Done button */}
              <div className="flex items-center justify-between pt-2 bg-[#f4f4f0] px-3 py-2 rounded-lg gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#3b684a] text-[18px]">
                    fitness_center
                  </span>
                  <span className="text-[12px] text-[#1a1c1a] font-semibold">
                    Protein: {proteinVal}g
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMealClick(meal);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#E6E4DD] text-[#1a1c1a] text-[11.5px] font-semibold flex items-center gap-1 hover:bg-[#eeeeea] active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#3b684a]">
                      receipt_long
                    </span>
                    <span>View Recipe</span>
                  </button>

                  {!isDone ? (
                    <button
                      type="button"
                      onClick={(e) => handleMarkMealDone(e, meal)}
                      className="px-3 py-1 rounded-full bg-[#1A3826] text-white text-[11.5px] font-semibold flex items-center gap-1 hover:bg-[#132a1d] active:scale-95 transition-all shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>Mark as Done</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-[#E8F0EC] text-[#137333] text-[11.5px] font-bold flex items-center gap-1 border border-[#D1E2D7]">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Cooked</span>
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Daily Protein Goal Tracker Widget (Connected to Today's Planned & Cooked Meals) */}
      <section className="p-4 rounded-xl bg-white border border-[#E6E4DD] flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[15px] text-[#1a1c1a] font-bold">
              {isHindi ? 'दैनिक प्रोटीन लक्ष्य' : 'Daily Protein Goal'}
            </span>
            <span className="text-[12px] text-[#424843]">
              Live tracking from today&apos;s cooked meals
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#E8F0EC] text-[#1E4620] text-[12px] font-semibold border border-[#D1E2D7]">
            {proteinPct}% Complete
          </span>
        </div>
        <div className="flex items-center gap-4 py-1">
          {/* Circular Progress Ring */}
          <div className="relative w-22 h-22 shrink-0 flex items-center justify-center">
            <svg className="w-22 h-22 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" fill="none" r="38" stroke="#eeeeea" strokeWidth="8"></circle>
              <circle
                cx="48"
                cy="48"
                fill="none"
                r="38"
                stroke="#1a3826"
                strokeDasharray="238.7"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[16px] font-bold text-[#032212] leading-none">
                {cookedProteinG}g
              </span>
              <span className="text-[10px] text-[#424843] mt-0.5">/ {targetProteinG}g</span>
            </div>
          </div>

          {/* Breakdown items from today's planned meals */}
          <div className="flex flex-col flex-1 gap-1.5">
            {slots.map((slot) => {
              const m = todayMealsBySlot[slot];
              const meta = SLOT_META[slot];
              return (
                <div key={slot} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 text-[#1a1c1a] font-medium truncate max-w-[180px]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        m?.status === 'done' ? 'bg-[#137333]' : 'bg-[#727972]'
                      }`}
                    ></span>
                    <span className="truncate">
                      {meta.labelEn}: {m ? m.title : 'Not Planned'}
                    </span>
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      m?.status === 'done' ? 'text-[#137333]' : 'text-[#727972]'
                    }`}
                  >
                    {m ? `${m.nutrition?.protein_g || 14}g ${m.status === 'done' ? '✓' : ''}` : '0g'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Actions Bento Grid */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-[#1a1c1a]">
            {isHindi ? 'रसोई के तुरंत काम' : 'Kitchen Actions • तुरंत करें'}
          </span>
          <span className="text-[12px] text-[#424843]">Hostel Mode</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Action 1: Scan Bill */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs cursor-pointer"
            type="button"
            onClick={() => (onOpenScan ? onOpenScan('receipt') : onNavigate('stock'))}
          >
            <div className="w-9 h-9 rounded-full bg-[#eeeeea] text-[#424843] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Scan Receipt</span>
              <span className="text-[11px] text-[#424843]">Blinkit / Zepto Bill OCR</span>
            </div>
          </button>

          {/* Action 2: Scan Fridge */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs cursor-pointer"
            type="button"
            onClick={() => (onOpenScan ? onOpenScan('fridge') : onNavigate('stock'))}
          >
            <div className="w-9 h-9 rounded-full bg-[#E8F0EC] text-[#1E4620] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">kitchen</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Scan Fridge</span>
              <span className="text-[11px] text-[#424843]">Pantry Camera AI</span>
            </div>
          </button>

          {/* Action 3: Smart Grocery */}
          <button
            className="p-3.5 rounded-xl bg-white border border-[#E6E4DD] text-left flex flex-col justify-between gap-3 hover:bg-[#f4f4f0] active:scale-95 transition-all min-h-[92px] shadow-xs"
            type="button"
            onClick={() => onNavigate('shop')}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-full bg-[#eeeeea] text-[#424843] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  planCheck.missing.length === 0
                    ? 'bg-[#EDF2EE] text-[#137333] border-[#D1E2D7]'
                    : 'bg-[#FAF6F0] text-[#B45309] border-[#E9E1D6]'
                }`}
              >
                {planCheck.missing.length === 0
                  ? 'All Stocked ✓'
                  : `${planCheck.missing.length} Missing`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-[#1a1c1a]">Smart Grocery</span>
              <span className="text-[11px] text-[#424843]">सामान की लिस्ट</span>
            </div>
          </button>

          {/* Action 4: AI Leftovers */}
          <button
            className="p-3.5 rounded-xl bg-[#1A3826] text-left flex flex-col justify-between gap-3 border border-[#1A3826] hover:bg-[#132a1d] active:scale-95 transition-all min-h-[92px] shadow-xs text-white"
            type="button"
            onClick={onOpenVoice}
          >
            <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white">AI Leftovers</span>
              <span className="text-[11px] text-white/80">बचे खाने से नई डिश</span>
            </div>
          </button>
        </div>
      </section>

      {/* Domestic Assistant / Cook Notes Sheet */}
      <section className="p-3 rounded-xl bg-[#eeeeea] border border-[#E6E4DD] flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white border border-[#E6E4DD] flex items-center justify-center text-[#3b684a] shrink-0">
            <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-[#1a1c1a]">Didi / Cook Instructions</span>
            {isEditingNote ? (
              <input
                className="text-[12px] bg-white border border-[#E6E4DD] rounded px-1.5 py-0.5 text-[#1a1c1a] focus:outline-none"
                value={didiNote}
                onChange={(e) => setDidiNote(e.target.value)}
                onBlur={() => setIsEditingNote(false)}
                autoFocus
              />
            ) : (
              <span className="text-[12px] text-[#424843] truncate italic">“{didiNote}”</span>
            )}
          </div>
        </div>
        <button
          className="px-2.5 py-1.5 rounded-full bg-white border border-[#E6E4DD] text-[#032212] text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-transform shrink-0 hover:bg-[#f4f4f0]"
          type="button"
          onClick={() => setIsEditingNote(!isEditingNote)}
        >
          <span className="material-symbols-outlined text-[15px]">
            {isEditingNote ? 'check' : 'edit_note'}
          </span>
          <span>{isEditingNote ? 'Save' : 'Edit'}</span>
        </button>
      </section>
    </div>
  );
};
