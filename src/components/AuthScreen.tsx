import React, { useState } from 'react';
import { store } from '../services/store';
import { syncClient } from '../services/syncClient';
import {
  AgeGroup,
  CookEquipment,
  DietCaution,
  DietaryGoalTag,
  DietPreference,
  HouseholdType,
  RegistrationProfileData,
  WeeklyVarietySchedule,
} from '../types';

interface AuthScreenProps {
  isHindi: boolean;
  onToggleLang: () => void;
  onLoginSuccess: () => void;
}

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

const EQUIPMENT_OPTIONS: { id: CookEquipment; label: string; icon: string }[] = [
  { id: 'stove', label: 'Gas Stove', icon: 'local_fire_department' },
  { id: 'induction', label: 'Induction', icon: 'bolt' },
  { id: 'pressure_cooker', label: 'Pressure Cooker', icon: 'soup_kitchen' },
  { id: 'kadhai_pan', label: 'Kadhai / Pan', icon: 'skillet' },
  { id: 'tawa', label: 'Roti Tawa', icon: 'circle' },
  { id: 'kettle', label: 'Electric Kettle', icon: 'coffee_maker' },
  { id: 'microwave', label: 'Microwave', icon: 'microwave' },
  { id: 'mixer', label: 'Mixer Grinder', icon: 'blender' },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isHindi,
  onToggleLang,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // --- Login State ---
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Registration State: Covers every detail from profile page ---
  const [regName, setRegName] = useState('');
  const [regEmailOrPhone, setRegEmailOrPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regHouseholdName, setRegHouseholdName] = useState('');
  const [regHouseholdType, setRegHouseholdType] = useState<HouseholdType>('family');

  const [regDietPref, setRegDietPref] = useState<DietPreference>('veg');
  const [regIsBeginner, setRegIsBeginner] = useState(false);

  const [regDietGoals, setRegDietGoals] = useState<DietaryGoalTag[]>(['protein_rich']);
  const [regRegions, setRegRegions] = useState<string[]>(['North Indian', 'South Indian']);

  const [regHasFridge, setRegHasFridge] = useState(true);
  const [regEquipment, setRegEquipment] = useState<CookEquipment[]>([
    'stove',
    'pressure_cooker',
    'kadhai_pan',
    'tawa',
  ]);

  const [regAgeGroup, setRegAgeGroup] = useState<AgeGroup>('adult');
  const [regWeight, setRegWeight] = useState(65);
  const [regProteinTarget, setRegProteinTarget] = useState<number>(70);
  const [regCautions, setRegCautions] = useState<DietCaution[]>([]);

  const [regSchedulePreset, setRegSchedulePreset] = useState<'weekend_new' | 'alternate' | 'all_regular'>('weekend_new');
  const [regFavoriteDishes, setRegFavoriteDishes] = useState('Dal Tadka, Roti, Aloo Jeera, Paneer Bhurji');

  const [regError, setRegError] = useState<string | null>(null);

  // Quick Demo Logins
  const registeredUsers = store.getAllRegisteredUsers();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginIdentifier.trim()) {
      setLoginError(isHindi ? 'कृपया ईमेल, मोबाइल या यूज़रनेम दर्ज करें' : 'Please enter email, mobile or username');
      return;
    }
    let res = store.login(loginIdentifier, loginPassword || undefined);
    const syncEmail = syncClient.accountEmailFor(loginIdentifier);
    if (!res.success && syncEmail && loginPassword) {
      // New device: the account lives on the server. Sign in there, pull the data, then log in locally.
      const linked = await syncClient.connect(syncEmail, loginPassword, false);
      if (linked.ok) res = store.login(loginIdentifier, loginPassword);
      else if (linked.error && !/no sync account/i.test(linked.error)) {
        setLoginError(linked.error);
        return;
      }
    } else if (res.success && res.user && loginPassword && !syncClient.isLinked()) {
      // Existing local account: link (or create) its sync account in the background.
      void syncClient.connect(res.user.email, loginPassword, true);
    }
    if (res.success) {
      onLoginSuccess();
    } else {
      setLoginError(res.error || (isHindi ? 'लॉग इन विफल रहा' : 'Login failed'));
    }
  };

  const handleQuickDemoLogin = (userId: string) => {
    const res = store.loginWithDemoUser(userId);
    if (res.success) {
      onLoginSuccess();
    }
  };

  const handleToggleGoal = (goal: DietaryGoalTag) => {
    setRegDietGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleToggleRegion = (region: string) => {
    setRegRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const handleToggleEquipment = (eq: CookEquipment) => {
    setRegEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleToggleCaution = (caution: DietCaution) => {
    setRegCautions((prev) =>
      prev.includes(caution) ? prev.filter((c) => c !== caution) : [...prev, caution]
    );
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError(isHindi ? 'कृपया अपना नाम दर्ज करें' : 'Please enter your name');
      return;
    }
    if (!regEmailOrPhone.trim()) {
      setRegError(isHindi ? 'कृपया ईमेल या मोबाइल नंबर दर्ज करें' : 'Please enter email or mobile number');
      return;
    }

    // Build weekly variety schedule
    let weeklySchedule: WeeklyVarietySchedule;
    if (regSchedulePreset === 'all_regular') {
      weeklySchedule = {
        Mon: 'regular',
        Tue: 'regular',
        Wed: 'regular',
        Thu: 'regular',
        Fri: 'regular',
        Sat: 'regular',
        Sun: 'regular',
      };
    } else if (regSchedulePreset === 'alternate') {
      weeklySchedule = {
        Mon: 'regular',
        Tue: 'new',
        Wed: 'regular',
        Thu: 'new',
        Fri: 'regular',
        Sat: 'new',
        Sun: 'regular',
      };
    } else {
      weeklySchedule = {
        Mon: 'regular',
        Tue: 'regular',
        Wed: 'new',
        Thu: 'regular',
        Fri: 'regular',
        Sat: 'new',
        Sun: 'new',
      };
    }

    // Parse habitual dishes
    const parsedDishes = regFavoriteDishes
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((title) => ({
        title,
        cuisine: regRegions[0] || 'North Indian',
        course: 'Dinner',
        ingredients: ['dal', 'chawal', 'atta', 'tamatar'],
      }));

    const regData: RegistrationProfileData = {
      name: regName.trim(),
      emailOrPhone: regEmailOrPhone.trim(),
      password: regPassword || 'password123',
      householdName: regHouseholdName.trim() || `${regName.trim()}'s Kitchen`,
      householdType: regHouseholdType,
      diet_pref: regDietPref,
      is_beginner_cook: regIsBeginner,
      diet_goals: regDietGoals,
      preferred_regions: regRegions,
      has_fridge: regHasFridge,
      equipment: regEquipment,
      member_name: regName.trim(),
      age_group: regAgeGroup,
      weight_kg: Number(regWeight) || 65,
      protein_target_g: Number(regProteinTarget) || 70,
      cautions: regCautions,
      weekly_variety_schedule: weeklySchedule,
      regular_dishes: parsedDishes.length > 0 ? parsedDishes : undefined,
    };

    const res = store.registerWithFullProfile(regData);
    if (res.success) {
      void syncClient.connect(res.user.email, regData.password || 'password123', true);
      onLoginSuccess();
    } else {
      setRegError(isHindi ? 'पंजीकरण विफल रहा' : 'Registration failed');
    }
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-[#1a1c1a] flex flex-col selection:bg-[#EDF2EE] selection:text-[#032212]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E6E4DD] px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              alt="KitchenSync Logo"
              className="h-7 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDJTSmI7D5flyHg8j7_KcMP3FhgR0Q6dtlH0V_4_0nMT3ky-qpyB_8czpFrBER4bRsAsttvOONILRI_iwuxgbL3j1wJuoGX0NsgLqg2qQfJ1DTVZzHB40KeJn8Jms-GB2QRWpv_GLeDnZJnf1k_jb_JD0BfPBlHDO81tdtDwUD-0oI1Gyy2ybT_vB1x6Ni_kH10RP_y6rhgfVby0HVcnNROWJgNDYLX1gNpFDzwA-8"
            />
            <div>
              <span className="text-[16px] font-bold tracking-tight text-[#1a1c1a]">KitchenSync</span>
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1A3826]/10 text-[#1A3826] font-semibold">
                Mast Meals
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            className="px-2.5 py-1 rounded-full border border-[#E6E4DD] bg-white text-[11px] font-semibold text-[#1A3826] hover:bg-[#F4F3EE] transition-colors cursor-pointer"
          >
            {isHindi ? 'English' : 'हिन्दी'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 flex flex-col">
        {/* Navigation Switch Tabs */}
        <div className="grid grid-cols-2 p-1 bg-[#eeece5] rounded-2xl mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setLoginError(null);
            }}
            className={`py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-[#1A3826] shadow-xs'
                : 'text-[#5c615c] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">login</span>
            <span>{isHindi ? 'लॉग इन करें' : 'Sign In'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setRegError(null);
            }}
            className={`py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-white text-[#1A3826] shadow-xs'
                : 'text-[#5c615c] hover:text-[#1a1c1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">person_add</span>
            <span>{isHindi ? 'नया प्रोफ़ाइल बनाएँ' : 'Register Profile'}</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* LOGIN SCREEN VIEW */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'login' && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#1a1c1a]">
                {isHindi ? 'किचनसिंक में वापस स्वागत है' : 'Welcome to KitchenSync'}
              </h1>
              <p className="text-[12.5px] text-[#424843] mt-1">
                {isHindi
                  ? 'अपने घर, हॉस्टल या क्लाउड किचन के स्टॉक और मील प्लान तक पहुँचने के लिए लॉग इन करें।'
                  : 'Sign in to access your kitchen inventory, meal planner, and household recipes.'}
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-[#fee2e2] text-[#991b1b] text-[12px] flex items-center gap-2 border border-[#fecaca]">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#424843] mb-1">
                  {isHindi ? 'ईमेल, मोबाइल नंबर या यूज़रनेम' : 'Email, Mobile Number or Username'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-[18px] text-[#727972] absolute left-3 top-2.5">
                    account_circle
                  </span>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. rohan@hostel.local or Divyansh"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#424843] mb-1">
                  {isHindi ? 'पासवर्ड' : 'Password'}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-[18px] text-[#727972] absolute left-3 top-2.5">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="material-symbols-outlined text-[18px] text-[#727972] absolute right-3 top-2.5 cursor-pointer hover:text-[#1a1c1a]"
                  >
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-[#1A3826] hover:bg-[#132a1d] active:scale-[0.99] text-white text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>{isHindi ? 'लॉग इन करें' : 'Sign In'}</span>
              </button>
            </form>

            {/* Quick 1-Tap Demo Logins */}
            <div className="bg-[#FAF9F6] rounded-2xl p-4 border border-[#E6E4DD] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#727972]">
                  {isHindi ? 'त्वरित 1-टैप टेस्ट लॉग इन' : 'Quick 1-Tap Test Accounts'}
                </span>
                <span className="text-[10px] text-[#1A3826] font-semibold bg-[#EDF2EE] px-2 py-0.5 rounded-full">
                  Instant Access
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('usr_alpha')}
                  className="p-2.5 rounded-xl bg-white border border-[#E6E4DD] hover:border-[#1A3826] text-left flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#EDF2EE] text-[#1A3826] flex items-center justify-center font-bold text-xs">
                      D
                    </div>
                    <div>
                      <div className="text-[12.5px] font-bold text-[#1a1c1a] group-hover:text-[#1A3826]">
                        Divyansh
                      </div>
                      <div className="text-[10.5px] text-[#727972]">
                        100% Pure Veg • Room 304 Hostel Flat
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1A3826] bg-[#EDF2EE] px-2 py-1 rounded-lg">
                    Sign In →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('usr_beta')}
                  className="p-2.5 rounded-xl bg-white border border-[#E6E4DD] hover:border-[#9E2A2B] text-left flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#fdf2f2] text-[#9E2A2B] flex items-center justify-center font-bold text-xs">
                      R
                    </div>
                    <div>
                      <div className="text-[12.5px] font-bold text-[#1a1c1a] group-hover:text-[#9E2A2B]">
                        Rohan
                      </div>
                      <div className="text-[10.5px] text-[#727972]">
                        Non-Veg • Room 304 Hostel Flat
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#9E2A2B] bg-[#fdf2f2] px-2 py-1 rounded-lg">
                    Sign In →
                  </span>
                </button>

                {registeredUsers.length > 2 && (
                  <div className="pt-2 border-t border-[#E6E4DD] flex flex-col gap-1.5">
                    <span className="text-[10.5px] font-bold text-[#727972]">
                      Other registered profiles:
                    </span>
                    {registeredUsers.slice(2).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickDemoLogin(u.id)}
                        className="p-2 rounded-xl bg-white border border-[#E6E4DD] hover:border-[#1A3826] text-left flex items-center justify-between transition-all cursor-pointer text-xs"
                      >
                        <span className="font-semibold text-[#1a1c1a]">{u.name} ({u.householdName})</span>
                        <span className="text-[#1A3826] font-bold">Sign In →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Switch Link */}
            <div className="text-center pt-2">
              <p className="text-[12.5px] text-[#424843]">
                {isHindi ? 'क्या आप नए हैं? ' : "Don't have an account yet? "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setRegError(null);
                  }}
                  className="font-bold text-[#1A3826] underline cursor-pointer hover:text-[#132a1d]"
                >
                  {isHindi ? 'पूरा प्रोफ़ाइल सेटअप करें' : 'Set up full profile'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* REGISTRATION WITH FULL PROFILE (All Profile Details) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 animate-fade-in">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#1a1c1a]">
                {isHindi ? 'नया प्रोफ़ाइल व किचन सेटअप' : 'Create Account & Kitchen Profile'}
              </h1>
              <p className="text-[12px] text-[#424843] mt-1">
                {isHindi
                  ? 'अपनी आहार शैली, उपकरण, स्वास्थ्य लक्ष्य और साप्ताहिक शेड्यूल को एक ही बार में सेट करें।'
                  : 'Configure every detail of your household, dietary limits, appliances, and schedule.'}
              </p>
            </div>

            {regError && (
              <div className="p-3 rounded-xl bg-[#fee2e2] text-[#991b1b] text-[12px] flex items-center gap-2 border border-[#fecaca]">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{regError}</span>
              </div>
            )}

            {/* 1. Account & Credentials */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">badge</span>
                1. {isHindi ? 'खाता विवरण' : 'Account Details'}
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1">
                  {isHindi ? 'आपका पूरा नाम *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1">
                  {isHindi ? 'ईमेल या मोबाइल नंबर *' : 'Email or Mobile Number *'}
                </label>
                <input
                  type="text"
                  required
                  value={regEmailOrPhone}
                  onChange={(e) => setRegEmailOrPhone(e.target.value)}
                  placeholder="e.g. vikram@gmail.com or 9876543210"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1">
                  {isHindi ? 'पासवर्ड' : 'Set Password'}
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="•••••••• (Default: password123)"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>
            </div>

            {/* 2. Kitchen Setup & Mode */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">kitchen</span>
                2. {isHindi ? 'किचन प्रकार और सेटअप' : 'Kitchen Type & Setup'}
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1">
                  {isHindi ? 'किचन या घर का नाम' : 'Kitchen or Household Name'}
                </label>
                <input
                  type="text"
                  value={regHouseholdName}
                  onChange={(e) => setRegHouseholdName(e.target.value)}
                  placeholder="e.g. Sharma Family Home or Annapurna Cloud Kitchen"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[13px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1.5">
                  {isHindi ? 'किचन मोड चुनें (Kitchen Mode):' : 'Select Kitchen Mode:'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegHouseholdType('family')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      regHouseholdType === 'family'
                        ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] ring-1 ring-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#1A3826] mt-0.5">home</span>
                    <div>
                      <div className="text-[13px] font-bold">Family Home Kitchen</div>
                      <div className="text-[11px] opacity-75">3 fixed meals/day, shared pantry & fridge, family variety</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegHouseholdType('hostel_room')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      regHouseholdType === 'hostel_room' || regHouseholdType === 'bachelor_flat'
                        ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] ring-1 ring-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#1A3826] mt-0.5">apartment</span>
                    <div>
                      <div className="text-[13px] font-bold">Hostel / Bachelor Shared Flat</div>
                      <div className="text-[11px] opacity-75">Personal vs shared items, roommate split, quick cook recipes</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegHouseholdType('cloud_kitchen')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      regHouseholdType === 'cloud_kitchen'
                        ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] ring-1 ring-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#1A3826] mt-0.5">restaurant</span>
                    <div>
                      <div className="text-[13px] font-bold">Cloud Kitchen Mode 🍳</div>
                      <div className="text-[11px] opacity-75">Cook to order & announced batches, portion yield, stock reservations & KDS</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Fridge Toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] cursor-pointer">
                <span className="text-[12.5px] font-semibold text-[#1a1c1a] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#1A3826]">kitchen</span>
                  {isHindi ? 'रेफ्रिजरेटर / फ्रिज उपलब्ध है' : 'Refrigerator / Fridge Available'}
                </span>
                <input
                  type="checkbox"
                  checked={regHasFridge}
                  onChange={(e) => setRegHasFridge(e.target.checked)}
                  className="w-4 h-4 accent-[#1A3826]"
                />
              </label>

              {/* Equipment Checkboxes */}
              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1.5">
                  {isHindi ? 'उपलब्ध खाना पकाने के उपकरण:' : 'Available Cook Equipment:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((eq) => {
                    const checked = regEquipment.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => handleToggleEquipment(eq.id)}
                        className={`p-2 rounded-xl border text-left text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          checked
                            ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] font-bold'
                            : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{eq.icon}</span>
                        <span className="truncate">{eq.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Diet Preference & Cooking Experience */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">eco</span>
                3. {isHindi ? 'आहार शैली व खाना बनाने का अनुभव' : 'Diet Preference & Cooking Level'}
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRegDietPref('veg')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    regDietPref === 'veg'
                      ? 'bg-[#EDF2EE] border-[#1A3826] text-[#1A3826] ring-1 ring-[#1A3826]'
                      : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                  }`}
                >
                  <span className="w-4 h-4 rounded-sm border-2 border-[#137333] flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#137333]"></span>
                  </span>
                  <div>
                    <div className="text-[13px] font-bold">100% Pure Veg</div>
                    <div className="text-[10px] opacity-75">No egg, fish or meat</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegDietPref('nonveg')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    regDietPref === 'nonveg'
                      ? 'bg-[#fdf2f2] border-[#9E2A2B] text-[#9E2A2B] ring-1 ring-[#9E2A2B]'
                      : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                  }`}
                >
                  <span className="w-4 h-4 rounded-sm border-2 border-[#9E2A2B] flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#9E2A2B]"></span>
                  </span>
                  <div>
                    <div className="text-[13px] font-bold">Non-Veg</div>
                    <div className="text-[10px] opacity-75">Eggs, poultry, fish</div>
                  </div>
                </button>
              </div>

              {/* Beginner toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] cursor-pointer">
                <div>
                  <div className="text-[12.5px] font-semibold text-[#1a1c1a]">
                    {isHindi ? 'मैं खाना बनाना सीख रहा/रही हूँ (Beginner Cook)' : "I'm a beginner cook"}
                  </div>
                  <div className="text-[10.5px] text-[#727972]">
                    {isHindi ? 'कम सामग्री व सरल विधि वाले व्यंजन सुझाएँ' : 'Suggest simple, low-effort step recipes'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={regIsBeginner}
                  onChange={(e) => setRegIsBeginner(e.target.checked)}
                  className="w-4 h-4 accent-[#1A3826]"
                />
              </label>
            </div>

            {/* 4. Health & Nutrition Goals */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">health_and_safety</span>
                4. {isHindi ? 'स्वास्थ्य एवं पोषण लक्ष्य' : 'Health & Nutrition Goals'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HEALTH_GOALS.map((g) => {
                  const active = regDietGoals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleToggleGoal(g.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-start gap-2 cursor-pointer ${
                        active
                          ? 'bg-[#1A3826] text-white border-[#1A3826]'
                          : 'bg-[#FAF9F6] text-[#1a1c1a] border-[#E6E4DD]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px] mt-0.5">{g.icon}</span>
                      <div>
                        <div className="font-bold">{isHindi ? g.labelHi : g.labelEn}</div>
                        <div className={`text-[10px] mt-0.5 ${active ? 'text-[#d8e6db]' : 'text-[#727972]'}`}>
                          {g.descEn}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Regional Cuisines */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">public</span>
                5. {isHindi ? 'पसंदीदा क्षेत्रीय व्यंजन' : 'Preferred Regional Cuisines'}
              </h2>

              <div className="flex flex-wrap gap-1.5">
                {REGION_OPTIONS.map((region) => {
                  const selected = regRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      onClick={() => handleToggleRegion(region)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#1A3826] text-white shadow-xs'
                          : 'bg-[#FAF9F6] border border-[#E6E4DD] text-[#424843] hover:bg-[#F4F3EE]'
                      }`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Primary Member Profile (Weight, Protein Target, Age) */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">monitor_weight</span>
                6. {isHindi ? 'शारीरिक प्रोफ़ाइल व प्रोटीन लक्ष्य' : 'Body Profile & Protein Goal'}
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#424843] mb-1">Age Group</label>
                  <select
                    value={regAgeGroup}
                    onChange={(e) => setRegAgeGroup(e.target.value as AgeGroup)}
                    className="w-full px-2 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-xs font-semibold text-[#1a1c1a]"
                  >
                    <option value="adult">Adult</option>
                    <option value="kid">Kid</option>
                    <option value="elderly">Elderly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#424843] mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    min="30"
                    max="180"
                    value={regWeight}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      setRegWeight(w);
                      setRegProteinTarget(Math.round(w * 1.0));
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-xs font-semibold text-[#1a1c1a]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#424843] mb-1">Protein Target</label>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    value={regProteinTarget}
                    onChange={(e) => setRegProteinTarget(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-xs font-bold text-[#1A3826]"
                  />
                </div>
              </div>

              {/* Health Cautions */}
              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1.5">
                  {isHindi ? 'स्वास्थ्य संबंधी सावधानियां (Health Cautions):' : 'Health Cautions:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['diabetes', 'bp', 'cholesterol', 'digestion', 'heart'] as DietCaution[]).map((c) => {
                    const active = regCautions.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleToggleCaution(c)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                          active
                            ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                            : 'bg-[#FAF9F6] border border-[#E6E4DD] text-[#727972]'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 7. Weekly Variety Schedule & Habitual Dishes */}
            <div className="bg-white rounded-2xl p-4 border border-[#E6E4DD] shadow-xs flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-[#1a1c1a] flex items-center gap-1.5 uppercase tracking-wider text-[#1A3826]">
                <span className="material-symbols-outlined text-[17px]">calendar_today</span>
                7. {isHindi ? 'साप्ताहिक अनुसूची व नियमित पसंदीदा व्यंजन' : 'Weekly Variety & Favorite Dishes'}
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1.5">
                  {isHindi ? 'साप्ताहिक विविधता शैली:' : 'Weekly Schedule Preset:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => setRegSchedulePreset('weekend_new')}
                    className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      regSchedulePreset === 'weekend_new'
                        ? 'bg-[#1A3826] text-white border-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    Weekend New
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegSchedulePreset('alternate')}
                    className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      regSchedulePreset === 'alternate'
                        ? 'bg-[#1A3826] text-white border-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    Alternate Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegSchedulePreset('all_regular')}
                    className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      regSchedulePreset === 'all_regular'
                        ? 'bg-[#1A3826] text-white border-[#1A3826]'
                        : 'bg-[#FAF9F6] border-[#E6E4DD] text-[#424843]'
                    }`}
                  >
                    All Regular
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#424843] mb-1">
                  {isHindi ? 'नियमित पसंदीदा व्यंजन (अल्पविराम से अलग करें)' : 'Regular Habitual Dishes (comma separated)'}
                </label>
                <input
                  type="text"
                  value={regFavoriteDishes}
                  onChange={(e) => setRegFavoriteDishes(e.target.value)}
                  placeholder="e.g. Dal Chawal, Roti Sabzi, Rajma Chawal, Poha"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E4DD] text-[12.5px] text-[#1a1c1a] focus:outline-none focus:border-[#1A3826]"
                />
              </div>
            </div>

            {/* Submit Registration Button */}
            <div className="pt-2 pb-6">
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#1A3826] hover:bg-[#132a1d] active:scale-[0.99] text-white text-[15px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>{isHindi ? 'प्रोफ़ाइल सहेजें और किचन शुरू करें' : 'Complete Setup & Launch Kitchen'}</span>
              </button>

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setLoginError(null);
                  }}
                  className="text-[12px] text-[#424843] hover:text-[#1A3826] underline cursor-pointer"
                >
                  {isHindi ? 'पहले से खाता है? यहाँ लॉग इन करें' : 'Already have an account? Sign in here'}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

export default AuthScreen;
