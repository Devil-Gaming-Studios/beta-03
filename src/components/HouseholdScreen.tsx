import React, { useState } from 'react';
import { store } from '../services/store';
import {
  AgeGroup,
  CookEquipment,
  DayOfWeekKey,
  DayVarietyMode,
  DietCaution,
  DietaryGoalTag,
  DietPreference,
  UserDietMemory,
} from '../types';

interface HouseholdScreenProps {
  isHindi: boolean;
}

const DAY_KEYS: { key: DayOfWeekKey; labelEn: string; labelHi: string }[] = [
  { key: 'Mon', labelEn: 'Mon', labelHi: 'सोम' },
  { key: 'Tue', labelEn: 'Tue', labelHi: 'मंगल' },
  { key: 'Wed', labelEn: 'Wed', labelHi: 'बुध' },
  { key: 'Thu', labelEn: 'Thu', labelHi: 'गुरु' },
  { key: 'Fri', labelEn: 'Fri', labelHi: 'शुक्र' },
  { key: 'Sat', labelEn: 'Sat', labelHi: 'शनि' },
  { key: 'Sun', labelEn: 'Sun', labelHi: 'रवि' },
];

const HEALTH_GOALS: {
  id: DietaryGoalTag;
  labelEn: string;
  labelHi: string;
  descEn: string;
  icon: string;
}[] = [
  {
    id: 'protein_rich',
    labelEn: 'Protein-Rich',
    labelHi: 'प्रोटीन युक्त',
    descEn: 'High-protein dal, paneer, soya, sprouts & legumes',
    icon: 'fitness_center',
  },
  {
    id: 'diabetes',
    labelEn: 'Diabetes-Friendly (Low GI)',
    labelHi: 'मधुमेह अनुकूल (Low GI)',
    descEn: 'Low glycemic index, complex carbs, zero refined sugar',
    icon: 'bloodtype',
  },
  {
    id: 'heart',
    labelEn: 'Heart Healthy',
    labelHi: 'हृदय स्वास्थ्य',
    descEn: 'Low cholesterol, high fiber & balanced sodium',
    icon: 'favorite',
  },
  {
    id: 'low_oil',
    labelEn: 'Low Oil / Light Tadka',
    labelHi: 'कम तेल / हल्का तड़का',
    descEn: 'Steamed, roasted or minimal ghee/oil recipes',
    icon: 'water_drop',
  },
];

const REGION_OPTIONS = [
  'North Indian',
  'South Indian',
  'Maharashtrian',
  'Gujarati',
  'Punjabi',
  'Bengali',
  'Rajasthani',
  'Andhra',
];

export const HouseholdScreen: React.FC<HouseholdScreenProps> = ({ isHindi }) => {
  const [me, setMe] = useState(() => store.getMe());
  const [dietMemory, setDietMemory] = useState<UserDietMemory>(() => store.getDietMemory());
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState<AgeGroup>('adult');
  const [newDiet, setNewDiet] = useState<DietPreference>('veg');
  const [newWeight, setNewWeight] = useState(65);
  const [newCautions, setNewCautions] = useState<DietCaution[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  // Add habitual regular dish form state
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCuisine, setHabitCuisine] = useState('North Indian');
  const [habitCourse, setHabitCourse] = useState('Dinner');
  const [habitIngredients, setHabitIngredients] = useState('');

  const refresh = () => {
    setMe({ ...store.getMe() });
    setDietMemory({ ...store.getDietMemory() });
  };

  const handleCopyInviteCode = () => {
    const code = store.getHouseholdInviteCode();
    navigator.clipboard?.writeText(code);
    setIsCopiedCode(true);
    showToast(`Invite code ${code} copied to clipboard!`);
    setTimeout(() => setIsCopiedCode(false), 2500);
  };

  const handleRegenerateCode = () => {
    const newCode = store.regenerateInviteCode();
    refresh();
    showToast(`Generated new invite code: ${newCode}`);
  };

  const handleJoinHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const res = store.joinHouseholdWithCode(joinCodeInput);
    refresh();
    showToast(res.message);
    setJoinCodeInput('');
  };

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleToggleVeg = (pref: DietPreference) => {
    store.setUserPreferences(pref, me.user.is_beginner_cook);
    refresh();
    showToast(`Dietary preference updated to ${pref === 'veg' ? '100% Vegetarian' : 'Non-Veg Allowed'}`);
  };

  const handleToggleBeginner = () => {
    const next = !me.user.is_beginner_cook;
    store.setUserPreferences(me.user.diet_pref, next);
    refresh();
    showToast(`Beginner Cook Mode ${next ? 'Enabled' : 'Disabled'}`);
  };

  const handleToggleGoal = (goal: DietaryGoalTag) => {
    const updated = store.toggleDietGoal(goal);
    setDietMemory({ ...updated });
    showToast(
      isHindi
        ? 'स्वास्थ्य और आहार लक्ष्य अपडेट किए गए!'
        : `Updated AI Dietary Profile (${updated.diet_goals.join(', ') || 'Balanced'})`
    );
  };

  const handleToggleRegion = (region: string) => {
    const updated = store.togglePreferredRegion(region);
    setDietMemory({ ...updated });
  };

  const handleToggleDayVariety = (dayKey: DayOfWeekKey) => {
    const current: DayVarietyMode = dietMemory.weekly_variety_schedule[dayKey] || 'regular';
    const next: DayVarietyMode = current === 'regular' ? 'new' : 'regular';
    const updated = store.setDayVarietyMode(dayKey, next);
    setDietMemory({ ...updated });
    showToast(
      `${dayKey} set to ${
        next === 'new'
          ? '✨ New Food (Graph RAG Discovery)'
          : 'Regular Food (From Past Diet History)'
      }`
    );
  };

  const applySchedulePreset = (preset: 'weekend_new' | 'alternate' | 'all_regular') => {
    if (preset === 'weekend_new') {
      const updated = store.setWeeklyVarietySchedule({
        Mon: 'regular',
        Tue: 'regular',
        Wed: 'new',
        Thu: 'regular',
        Fri: 'regular',
        Sat: 'new',
        Sun: 'new',
      });
      setDietMemory({ ...updated });
      showToast('Set Mon/Tue/Thu/Fri = Regular & Wed/Sat/Sun = ✨ New Food');
    } else if (preset === 'alternate') {
      const updated = store.setWeeklyVarietySchedule({
        Mon: 'regular',
        Tue: 'new',
        Wed: 'regular',
        Thu: 'new',
        Fri: 'regular',
        Sat: 'new',
        Sun: 'regular',
      });
      setDietMemory({ ...updated });
      showToast('Set Alternate Days for Regular vs. ✨ New Food');
    } else {
      const updated = store.setWeeklyVarietySchedule({
        Mon: 'regular',
        Tue: 'regular',
        Wed: 'regular',
        Thu: 'regular',
        Fri: 'regular',
        Sat: 'regular',
        Sun: 'regular',
      });
      setDietMemory({ ...updated });
      showToast('Set all 7 days to Regular Habitual Diet');
    }
  };

  const handleAddHabitualDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;
    const ingList = habitIngredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = store.addHabitualDishToMemory({
      title: habitTitle.trim(),
      cuisine: habitCuisine,
      course: habitCourse,
      ingredients: ingList.length > 0 ? ingList : ['dal', 'atta', 'jeera', 'pyaz'],
    });
    setDietMemory({ ...updated });
    setHabitTitle('');
    setHabitIngredients('');
    setShowAddHabitModal(false);
    showToast(`Added "${habitTitle.trim()}" to your Regular Diet History in localStorage!`);
  };

  const handleRemoveHabitualDish = (idOrTitle: string) => {
    const updated = store.removeHabitualDishFromMemory(idOrTitle);
    setDietMemory({ ...updated });
    showToast('Removed dish from Regular Diet History');
  };

  const handleToggleFridge = () => {
    store.updateHousehold({ has_fridge: !me.household.has_fridge });
    refresh();
  };

  const handleToggleEquipment = (eq: CookEquipment) => {
    const current = me.household.equipment || [];
    const updated = current.includes(eq)
      ? current.filter((item) => item !== eq)
      : [...current, eq];
    store.updateHousehold({ equipment: updated });
    refresh();
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    store.addMember(newName.trim(), newAge, newDiet, newWeight, newCautions);
    setNewName('');
    setNewCautions([]);
    setShowAddMember(false);
    refresh();
    showToast(`Added member ${newName.trim()}`);
  };

  const toggleCaution = (c: DietCaution) => {
    setNewCautions((prev) => (prev.includes(c) ? prev.filter((i) => i !== c) : [...prev, c]));
  };

  const allEquipment: { id: CookEquipment; label: string; icon: string }[] = [
    { id: 'stove', label: 'Gas Stove', icon: 'local_fire_department' },
    { id: 'induction', label: 'Induction', icon: 'bolt' },
    { id: 'pressure_cooker', label: 'Pressure Cooker', icon: 'soup_kitchen' },
    { id: 'kadhai_pan', label: 'Kadhai / Pan', icon: 'skillet' },
    { id: 'tawa', label: 'Roti Tawa', icon: 'circle' },
    { id: 'kettle', label: 'Electric Kettle', icon: 'coffee_maker' },
    { id: 'microwave', label: 'Microwave', icon: 'microwave' },
    { id: 'mixer', label: 'Mixer Grinder', icon: 'blender' },
  ];

  const regularDaysCount = Object.values(dietMemory.weekly_variety_schedule).filter(
    (m) => m === 'regular'
  ).length;
  const newDaysCount = 7 - regularDaysCount;

  return (
    <div className="flex flex-col w-full pb-8 max-w-xl mx-auto px-4 gap-y-5">
      {notice && (
        <div className="bg-[#1A3826] text-white px-4 py-2.5 rounded-2xl text-[13px] font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#c8ebd1]">check_circle</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Title */}
      <div className="pt-2">
        <h1 className="text-[24px] font-bold text-[#1a1c1a] tracking-tight">
          {isHindi ? 'प्रोफ़ाइल और साप्ताहिक आहार सेटिंग्स' : 'User Profile & AI Diet Planner Settings'}
        </h1>
        <p className="text-[12.5px] text-[#424843]">
          {isHindi
            ? 'प्रोटीन/मधुमेह लक्ष्य, नियमित बनाम नया भोजन अनुसूची और Graph RAG प्राथमिकताएं'
            : 'Configure Protein/Diabetes goals, Regular vs. New Food days & multi-week diet history'}
        </p>
      </div>

      {/* 1. Dietary Lock & Health/Medical Goals (Protein-Rich, Diabetes, etc.) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[19px] text-[#1A3826]">verified_user</span>
              {isHindi ? 'आहार और स्वास्थ्य लक्ष्य (AI Planner)' : 'Dietary Lock & Health Goals'}
            </h2>
            <p className="text-[11.5px] text-[#727972]">
              {isHindi
                ? 'Gemini AI और Graph RAG इन लक्ष्यों के अनुसार ही व्यंजन चुनेंगे'
                : 'Gemini LLM & Graph RAG strictly enforce these on both Regular and New Food days'}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#EDF2EE] text-[#137333] text-[10.5px] font-bold border border-[#c8ebd1]">
            Saved in LocalStorage
          </span>
        </div>

        {/* Strict Veg vs Non-Veg */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              me.user.diet_pref === 'veg'
                ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826]'
                : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
            }`}
            onClick={() => handleToggleVeg('veg')}
          >
            <span className="w-4 h-4 rounded-sm border-2 border-[#137333] flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
            </span>
            <div>
              <div className="text-[13px] font-bold">100% Pure Veg</div>
              <div className="text-[10.5px] opacity-75">Blocks meat, fish &amp; eggs</div>
            </div>
          </button>

          <button
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              me.user.diet_pref === 'nonveg'
                ? 'bg-[#fdf2f2] border-[#9E2A2B] text-[#9E2A2B]'
                : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
            }`}
            onClick={() => handleToggleVeg('nonveg')}
          >
            <span className="w-4 h-4 rounded-sm border-2 border-[#9E2A2B] flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#9E2A2B]"></span>
            </span>
            <div>
              <div className="text-[13px] font-bold">Veg + Non-Veg</div>
              <div className="text-[10.5px] opacity-75">Includes eggs &amp; meat</div>
            </div>
          </button>
        </div>

        {/* Health Goals: Protein-Rich, Diabetes, Heart, Low Oil */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[#E6E4DD]">
          <label className="text-[12px] font-bold text-[#424843] uppercase tracking-wider">
            {isHindi ? 'पोषण और स्वास्थ्य प्राथमिकताएं (चुनें):' : 'Active Nutrition & Medical Profile:'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {HEALTH_GOALS.map((g) => {
              const active = dietMemory.diet_goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleToggleGoal(g.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                    active
                      ? 'bg-[#1A3826] text-white border-[#1A3826] shadow-xs'
                      : 'bg-[#FAF9F6] text-[#1a1c1a] border-[#E6E4DD] hover:bg-[#f0efe9]'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 ${
                      active ? 'text-[#c8ebd1]' : 'text-[#1A3826]'
                    }`}
                  >
                    {g.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-bold flex items-center justify-between gap-1">
                      <span>{isHindi ? g.labelHi : g.labelEn}</span>
                      {active && (
                        <span className="material-symbols-outlined text-[15px] text-[#c8ebd1]">
                          check_circle
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[10.5px] leading-tight mt-0.5 ${
                        active ? 'text-[#d8e6db]' : 'text-[#727972]'
                      }`}
                    >
                      {g.descEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Regional Cuisine Preferences for Graph RAG */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#E6E4DD]">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-bold text-[#424843] uppercase tracking-wider">
              {isHindi ? 'पसंदीदा क्षेत्रीय व्यंजन (Graph RAG क्षेत्र):' : 'Preferred Regional Cuisines (Graph RAG):'}
            </label>
            <span className="text-[11px] text-[#727972]">
              {dietMemory.preferred_regions.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REGION_OPTIONS.map((region) => {
              const selected = dietMemory.preferred_regions.includes(region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => handleToggleRegion(region)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all flex items-center gap-1 ${
                    selected
                      ? 'bg-[#EDF2EE] text-[#1A3826] border-[#1A3826]'
                      : 'bg-[#FAF9F6] text-[#424843] border-[#E6E4DD] hover:bg-[#f0efe9]'
                  }`}
                >
                  {selected && (
                    <span className="material-symbols-outlined text-[14px] text-[#137333]">check</span>
                  )}
                  {region}
                </button>
              );
            })}
          </div>
        </div>

        {/* Beginner Cook Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DD]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#3b684a] text-[22px]">child_care</span>
            <div>
              <div className="text-[13.5px] font-bold text-[#1a1c1a]">
                {isHindi ? 'शुरुआती रसोइया मोड (Beginner Cook)' : 'Beginner Cook Mode'}
              </div>
              <div className="text-[11.5px] text-[#727972]">
                Prioritizes low-effort, &lt;30 min recipes with fewer steps
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleBeginner}
            className={`w-12 h-6 rounded-full transition-colors p-0.5 ${
              me.user.is_beginner_cook ? 'bg-[#1A3826]' : 'bg-[#d4d6d0]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                me.user.is_beginner_cook ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. Weekly Meal Variety Schedule: Regular Food vs. New Food Days */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[19px] text-[#B45309]">calendar_month</span>
              {isHindi
                ? 'साप्ताहिक भोजन विविधता (नियमित बनाम नया भोजन)'
                : 'Weekly Meal Schedule: Regular vs. New Food Days'}
            </h2>
            <p className="text-[11.5px] text-[#424843] mt-0.5 leading-relaxed">
              {isHindi
                ? 'चुनें कि सप्ताह के किन दिनों में आप अपना नियमित भोजन चाहते हैं और किन दिनों में Graph RAG से नया व्यंजन'
                : 'Tap any day below to set whether AI plans your Regular habitual meals or discovers ✨ New dishes unrelated to your routine diet (while still matching your dietary profile).'}
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="flex items-center gap-2 text-[11.5px]">
          <span className="px-2.5 py-1 rounded-lg bg-[#EDF2EE] text-[#1A3826] font-bold border border-[#c8ebd1]">
            {regularDaysCount} Days Regular Food (Past Diet)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] text-[#B45309] font-bold border border-[#E9E1D6]">
            ✨ {newDaysCount} Days New Discovery (Graph RAG)
          </span>
        </div>

        {/* 7-Day Interactive Selector Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_KEYS.map((d) => {
            const mode = dietMemory.weekly_variety_schedule[d.key] || 'regular';
            const isNew = mode === 'new';
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => handleToggleDayVariety(d.key)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-between gap-1.5 transition-all active:scale-95 ${
                  isNew
                    ? 'bg-[#FAF6F0] border-[#B45309] text-[#B45309] shadow-xs'
                    : 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826]'
                }`}
              >
                <span className="text-[11px] font-bold uppercase tracking-tight">
                  {isHindi ? d.labelHi : d.labelEn}
                </span>
                <span className="material-symbols-outlined text-[18px]">
                  {isNew ? 'auto_awesome' : 'history'}
                </span>
                <span
                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    isNew ? 'bg-[#B45309] text-white' : 'bg-[#1A3826] text-white'
                  }`}
                >
                  {isNew ? (isHindi ? 'नया' : 'NEW') : isHindi ? 'नियमित' : 'REG'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Schedule Presets */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-[#727972] mr-1">Quick Presets:</span>
          <button
            type="button"
            onClick={() => applySchedulePreset('weekend_new')}
            className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] hover:bg-[#e8e8e2] text-[11px] font-semibold text-[#1a1c1a] border border-[#E6E4DD]"
          >
            Wed + Weekend New
          </button>
          <button
            type="button"
            onClick={() => applySchedulePreset('alternate')}
            className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] hover:bg-[#e8e8e2] text-[11px] font-semibold text-[#1a1c1a] border border-[#E6E4DD]"
          >
            Alternate Days
          </button>
          <button
            type="button"
            onClick={() => applySchedulePreset('all_regular')}
            className="px-2.5 py-1 rounded-lg bg-[#f4f4f0] hover:bg-[#e8e8e2] text-[11px] font-semibold text-[#1a1c1a] border border-[#E6E4DD]"
          >
            All Regular
          </button>
        </div>
      </div>

      {/* 3. Multi-Week Habitual Diet Memory (Stored in LocalStorage) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1c1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[19px] text-[#1A3826]">psychology</span>
              {isHindi
                ? 'नियमित आहार इतिहास (Past Weeks Diet Memory)'
                : 'Past Weeks Common Diet (LocalStorage)'}
            </h2>
            <p className="text-[11.5px] text-[#727972]">
              Used on <strong>Regular</strong> days &amp; excluded on <strong>✨ New Food</strong> days ({dietMemory.weeks_tracked} weeks tracked)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddHabitModal((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {isHindi ? 'नियमित व्यंजन जोड़ें' : 'Add Regular Dish'}
          </button>
        </div>

        {/* Add Habitual Dish Inline Form */}
        {showAddHabitModal && (
          <form
            onSubmit={handleAddHabitualDish}
            className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2.5 animate-fade-in"
          >
            <div className="text-[12.5px] font-bold text-[#1a1c1a]">
              Add a Dish You Regularly Eat
            </div>
            <input
              type="text"
              value={habitTitle}
              onChange={(e) => setHabitTitle(e.target.value)}
              placeholder="Dish name (e.g. Methi Thepla, Moong Dal Khichdi, Besan Chilla)"
              className="px-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[13px]"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={habitCuisine}
                onChange={(e) => setHabitCuisine(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12.5px]"
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={habitCourse}
                onChange={(e) => setHabitCourse(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12.5px]"
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>
            <input
              type="text"
              value={habitIngredients}
              onChange={(e) => setHabitIngredients(e.target.value)}
              placeholder="Key ingredients comma-separated (e.g. moong dal, palak, jeera, atta)"
              className="px-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12.5px]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddHabitModal(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-[#424843]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#1A3826] text-white text-[12px] font-semibold"
              >
                Save to Diet Memory
              </button>
            </div>
          </form>
        )}

        {/* Staple Ingredients & Regions Summary */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E4DD] text-[11px]">
          <span className="font-bold text-[#424843]">Habitual Staple Ingredients:</span>
          {dietMemory.common_ingredients.map((ing) => (
            <span
              key={ing}
              className="px-2 py-0.5 rounded-md bg-white border border-[#E6E4DD] text-[#1a1c1a] font-medium capitalize"
            >
              {ing}
            </span>
          ))}
        </div>

        {/* List of Past Regular Dishes */}
        <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-0.5">
          {dietMemory.past_regular_dishes.map((dish) => (
            <div
              key={dish.recipe_id + dish.title}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD]"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-[#1a1c1a] truncate">
                    {dish.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#EDF2EE] text-[#1A3826] text-[10px] font-semibold">
                    {dish.cuisine}
                  </span>
                </div>
                <div className="text-[11px] text-[#727972] mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Eaten {dish.times_eaten}x over {dish.weeks_active} wks</span>
                  <span>•</span>
                  <span className="truncate">
                    Ingredients: {(dish.ingredients || []).slice(0, 4).join(', ')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveHabitualDish(dish.recipe_id || dish.title)}
                className="w-7 h-7 rounded-full hover:bg-[#fee2e2] text-[#727972] hover:text-[#9E2A2B] flex items-center justify-center shrink-0"
                title="Remove from habitual diet"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Kitchen Equipment & Fridge Configuration */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-4">
        <h2 className="text-[15px] font-bold text-[#1a1c1a]">
          {isHindi ? 'रसोई उपकरण और फ्रिज' : 'Kitchen Equipment & Storage'}
        </h2>

        <div className="flex items-center justify-between pb-3 border-b border-[#E6E4DD]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#1A3826] text-[22px]">kitchen</span>
            <div>
              <div className="text-[13.5px] font-bold text-[#1a1c1a]">
                {isHindi ? 'रेफ्रिजरेटर उपलब्ध है' : 'Refrigerator Available'}
              </div>
              <div className="text-[11.5px] text-[#727972]">
                {me.household.has_fridge
                  ? 'Perishables (milk, paneer, curd) have normal shelf-life'
                  : 'No Fridge Mode: Perishable items flagged for same-day use'}
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleFridge}
            className={`w-12 h-6 rounded-full transition-colors p-0.5 ${
              me.household.has_fridge ? 'bg-[#1A3826]' : 'bg-[#B45309]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                me.household.has_fridge ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div>
          <span className="text-[12px] font-bold text-[#727972] uppercase tracking-wider block mb-2.5">
            {isHindi ? 'उपलब्ध बर्तन और उपकरण' : 'Available Cooking Appliances'}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {allEquipment.map((eq) => {
              const active = (me.household.equipment || []).includes(eq.id);
              return (
                <button
                  key={eq.id}
                  onClick={() => handleToggleEquipment(eq.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    active
                      ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] font-semibold'
                      : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#727972]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{eq.icon}</span>
                  <span className="text-[12px] truncate">{eq.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Household Diners & Protein / Medical Profiles */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? 'परिवार / हॉस्टल सदस्य' : 'Household Members & Protein Targets'}
            </h2>
            <p className="text-[11.5px] text-[#727972]">
              {me.household.name} • {me.members.length} Diners
            </p>
          </div>
          <button
            onClick={() => setShowAddMember((s) => !s)}
            className="px-3 py-1.5 rounded-xl bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            {isHindi ? 'सदस्य जोड़ें' : 'Add Member'}
          </button>
        </div>

        {showAddMember && (
          <form
            onSubmit={handleAddMember}
            className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-3"
          >
            <input
              type="text"
              placeholder="Member Name (e.g. Rohan, Dadi)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[13px]"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newAge}
                onChange={(e: any) => setNewAge(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12px]"
              >
                <option value="adult">Adult</option>
                <option value="kid">Kid</option>
                <option value="elderly">Elderly</option>
              </select>
              <select
                value={newDiet}
                onChange={(e: any) => setNewDiet(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12px]"
              >
                <option value="veg">Pure Veg</option>
                <option value="nonveg">Non-Veg</option>
              </select>
              <input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                placeholder="Weight kg"
                className="px-2.5 py-2 rounded-xl bg-white border border-[#E6E4DD] text-[12px]"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-[#727972] uppercase block mb-1.5">
                Health Cautions:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {(['diabetes', 'bp', 'cholesterol', 'digestion'] as DietCaution[]).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleCaution(c)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize border ${
                      newCautions.includes(c)
                        ? 'bg-[#B45309] text-white border-[#B45309]'
                        : 'bg-white text-[#424843] border-[#E6E4DD]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] text-[#424843]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#1A3826] text-white text-[12px] font-semibold"
              >
                Save Member
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-2.5">
          {me.members.map((m) => {
            const pStats = store.getMemberProteinStats(m.id);
            return (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1A3826] text-white flex items-center justify-center font-bold text-[13px]">
                      {(m.name || m.label || 'M')[0]}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold text-[#1a1c1a] flex items-center gap-1.5">
                        {m.name || m.label}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#eeeeea] text-[#424843] uppercase">
                          {m.age_group}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#727972]">
                        {m.diet_pref === 'veg' ? 'Pure Veg' : 'Veg / Non-Veg'} • {m.weight_kg || 65} kg
                      </div>
                    </div>
                  </div>

                  {m.cautions && m.cautions.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {m.cautions.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#B45309] border border-[#E9E1D6] text-[10px] font-bold uppercase"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Daily Protein Bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#424843] font-medium">Today&apos;s Protein Intake</span>
                    <span className="font-bold text-[#1A3826]">
                      {pStats.todayTotal}g / {pStats.target}g ({pStats.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#e2e3df] overflow-hidden">
                    <div
                      className="h-full bg-[#1A3826] rounded-full transition-all"
                      style={{ width: `${pStats.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Household Invite Codes & Multi-User Sharing (Spec 2.1) */}
      <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1A3826] text-[20px]">share</span>
            <h2 className="text-[15px] font-bold text-[#1a1c1a]">
              {isHindi ? 'घर का इनवाइट कोड और शेयरिंग' : 'Household Invite Code & Join'}
            </h2>
          </div>
          <span className="text-[11px] text-[#727972]">Roommates &amp; Family</span>
        </div>

        <p className="text-[11.5px] text-[#424843]">
          Share this invite code with roommates or family members so they can join this household, view shared stock, and plan meals together.
        </p>

        <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD]">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#727972]">Your Invite Code</span>
            <span className="text-[18px] font-mono font-bold text-[#1A3826]">
              {store.getHouseholdInviteCode()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyInviteCode}
              className="px-3 py-1.5 rounded-lg bg-[#1A3826] text-white text-[12px] font-semibold flex items-center gap-1 hover:bg-[#132a1d] active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
              <span>{isCopiedCode ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              type="button"
              onClick={handleRegenerateCode}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E4DD] text-[#424843] hover:text-[#1a1c1a] text-[12px] font-medium"
              title="Generate fresh invite code"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
            </button>
          </div>
        </div>

        {/* Join another household */}
        <form onSubmit={handleJoinHousehold} className="pt-2 border-t border-[#E6E4DD] flex flex-col gap-2">
          <label className="text-[12px] font-bold text-[#424843]">
            {isHindi ? 'दूसरा घर जॉइन करें (Enter Code):' : 'Join Existing Household with Code:'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. BLR-402"
              className="flex-1 px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] font-mono uppercase text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#3b684a] text-white text-[12px] font-bold hover:bg-[#2d5239] active:scale-95"
            >
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
