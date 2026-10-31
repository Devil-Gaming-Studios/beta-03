import {
  User,
  Household,
  HouseholdMember,
  Ingredient,
  Recipe,
  StockItem,
  PlannedMeal,
  MealPlan,
  ShoppingListItem,
  ProposalPayload,
  PendingAction,
  StockOp,
  MealSlot,
  BaseUnit,
  DietCaution,
  AgeGroup,
  DietPreference,
  CookEquipment,
  GraphRecipe,
  DayOfWeekKey,
  DayVarietyMode,
  WeeklyVarietySchedule,
  DietaryGoalTag,
  PastDietEntry,
  UserDietMemory,
} from '../types';
import seedData from '../data/graph_rag_seed.json';

const DIET_MEMORY_KEY = 'mastmeals_diet_memory_v1';

function createDefaultDietMemory(userId = 'usr_alpha'): UserDietMemory {
  return {
    user_id: userId,
    diet_goals: ['protein_rich', 'diabetes'],
    preferred_regions: ['North Indian', 'Maharashtrian', 'South Indian'],
    weekly_variety_schedule: {
      Mon: 'regular',
      Tue: 'regular',
      Wed: 'new',
      Thu: 'regular',
      Fri: 'regular',
      Sat: 'new',
      Sun: 'new',
    },
    past_regular_dishes: [
      {
        recipe_id: 'rec_poha_01',
        title: 'Kanda Poha (कांदा पोहा)',
        cuisine: 'Maharashtrian',
        course: 'Breakfast',
        ingredients: ['poha', 'pyaz', 'peanuts', 'haldi', 'hari mirchi'],
        times_eaten: 14,
        weeks_active: 6,
        last_eaten_date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        is_regular_favorite: true,
      },
      {
        recipe_id: 'rec_dal_01',
        title: 'Yellow Dal Tadka & Jeera Rice (दाल तड़का)',
        cuisine: 'North Indian',
        course: 'Lunch',
        ingredients: ['dal', 'chawal', 'tamatar', 'jeera', 'haldi', 'ghee'],
        times_eaten: 19,
        weeks_active: 8,
        last_eaten_date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
        is_regular_favorite: true,
      },
      {
        recipe_id: 'rec_paneer_01',
        title: 'High-Protein Paneer Bhurji & Roti (पनीर भुर्जी)',
        cuisine: 'North Indian',
        course: 'Dinner',
        ingredients: ['paneer', 'pyaz', 'tamatar', 'atta', 'hari mirchi'],
        times_eaten: 11,
        weeks_active: 5,
        last_eaten_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
        is_regular_favorite: true,
      },
      {
        recipe_id: 'rec_aloo_01',
        title: 'Chatpata Jeera Aloo & Curd (जीरा आलू और दही)',
        cuisine: 'North Indian',
        course: 'Lunch',
        ingredients: ['aloo', 'jeera', 'dahi', 'haldi', 'atta'],
        times_eaten: 9,
        weeks_active: 4,
        last_eaten_date: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10),
        is_regular_favorite: true,
      },
      {
        recipe_id: 'rec_palak_dal_01',
        title: 'Lasooni Palak Moong Dal (लसूनी पालक दाल)',
        cuisine: 'North Indian',
        course: 'Dinner',
        ingredients: ['palak', 'dal', 'tamatar', 'jeera', 'haldi'],
        times_eaten: 8,
        weeks_active: 4,
        last_eaten_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
        is_regular_favorite: true,
      },
    ],
    common_ingredients: ['dal', 'paneer', 'aloo', 'atta', 'pyaz', 'tamatar', 'dahi', 'palak', 'jeera'],
    common_regions: ['North Indian', 'Maharashtrian'],
    weeks_tracked: 6,
    updated_at: new Date().toISOString(),
  };
}

export const CANONICAL_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing_aloo',
    name_en: 'aloo',
    name_hi: 'आलू',
    aliases: ['aloo', 'potato', 'potatoes', 'alu'],
    category: 'vegetable',
    base_unit: 'g',
    grams_per_pc: 120,
    storage_place: 'pantry',
    shelf_life_days: 30,
    nutrients_per_100: { kcal: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, sodium_mg: 6 },
  },
  {
    id: 'ing_atta',
    name_en: 'atta',
    name_hi: 'आटा',
    aliases: ['atta', 'wheat flour', 'flour', 'gehun'],
    category: 'grain',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 90,
    nutrients_per_100: { kcal: 364, protein_g: 10, carbs_g: 76, fat_g: 1, sodium_mg: 2 },
  },
  {
    id: 'ing_dahi',
    name_en: 'dahi',
    name_hi: 'दही',
    aliases: ['dahi', 'curd', 'yogurt'],
    category: 'dairy',
    base_unit: 'ml',
    grams_per_pc: null,
    storage_place: 'fridge',
    shelf_life_days: 4,
    nutrients_per_100: { kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3, sodium_mg: 46 },
  },
  {
    id: 'ing_chawal',
    name_en: 'chawal',
    name_hi: 'चावल',
    aliases: ['chawal', 'rice', 'basmati'],
    category: 'grain',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 180,
    nutrients_per_100: { kcal: 365, protein_g: 7, carbs_g: 80, fat_g: 0.7, sodium_mg: 5 },
  },
  {
    id: 'ing_dal',
    name_en: 'dal',
    name_hi: 'दाल',
    aliases: ['dal', 'daal', 'toor dal', 'lentils', 'arhar'],
    category: 'pulse',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 120,
    nutrients_per_100: { kcal: 343, protein_g: 22, carbs_g: 63, fat_g: 1.6, sodium_mg: 6 },
  },
  {
    id: 'ing_oil',
    name_en: 'oil',
    name_hi: 'तेल',
    aliases: ['oil', 'tel', 'mustard oil', 'sunflower oil', 'ghee'],
    category: 'fat',
    base_unit: 'ml',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 180,
    nutrients_per_100: { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100, sodium_mg: 0 },
  },
  {
    id: 'ing_namak',
    name_en: 'namak',
    name_hi: 'नमक',
    aliases: ['namak', 'salt', 'sendha namak'],
    category: 'spice',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 365,
    nutrients_per_100: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 38758 },
  },
  {
    id: 'ing_pyaz',
    name_en: 'pyaz',
    name_hi: 'प्याज़',
    aliases: ['pyaz', 'onion', 'onions', 'kanda'],
    category: 'vegetable',
    base_unit: 'g',
    grams_per_pc: 110,
    storage_place: 'pantry',
    shelf_life_days: 21,
    nutrients_per_100: { kcal: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, sodium_mg: 4 },
  },
  {
    id: 'ing_tamatar',
    name_en: 'tamatar',
    name_hi: 'टमाटर',
    aliases: ['tamatar', 'tomato', 'tomatoes'],
    category: 'vegetable',
    base_unit: 'g',
    grams_per_pc: 90,
    storage_place: 'fridge',
    shelf_life_days: 7,
    nutrients_per_100: { kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, sodium_mg: 5 },
  },
  {
    id: 'ing_paneer',
    name_en: 'paneer',
    name_hi: 'पनीर',
    aliases: ['paneer', 'cottage cheese'],
    category: 'dairy',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'fridge',
    shelf_life_days: 4,
    nutrients_per_100: { kcal: 265, protein_g: 18, carbs_g: 3.4, fat_g: 20, sodium_mg: 22 },
  },
  {
    id: 'ing_doodh',
    name_en: 'doodh',
    name_hi: 'दूध',
    aliases: ['doodh', 'milk'],
    category: 'dairy',
    base_unit: 'ml',
    grams_per_pc: null,
    storage_place: 'fridge',
    shelf_life_days: 3,
    nutrients_per_100: { kcal: 62, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.6, sodium_mg: 44 },
  },
  {
    id: 'ing_jeera',
    name_en: 'jeera',
    name_hi: 'जीरा',
    aliases: ['jeera', 'cumin', 'cumin seeds'],
    category: 'spice',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 365,
    nutrients_per_100: { kcal: 375, protein_g: 18, carbs_g: 44, fat_g: 22, sodium_mg: 168 },
  },
  {
    id: 'ing_palak',
    name_en: 'palak',
    name_hi: 'पालक',
    aliases: ['palak', 'spinach'],
    category: 'vegetable',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'fridge',
    shelf_life_days: 3,
    nutrients_per_100: { kcal: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, sodium_mg: 79 },
  },
  {
    id: 'ing_mirchi',
    name_en: 'hari mirchi',
    name_hi: 'हरी मिर्च',
    aliases: ['mirchi', 'green chillies', 'green chilli'],
    category: 'vegetable',
    base_unit: 'g',
    grams_per_pc: 10,
    storage_place: 'fridge',
    shelf_life_days: 10,
    nutrients_per_100: { kcal: 40, protein_g: 1.9, carbs_g: 8.8, fat_g: 0.2, sodium_mg: 7 },
  },
  {
    id: 'ing_haldi',
    name_en: 'haldi',
    name_hi: 'हल्दी',
    aliases: ['haldi', 'turmeric', 'turmeric powder'],
    category: 'spice',
    base_unit: 'g',
    grams_per_pc: null,
    storage_place: 'pantry',
    shelf_life_days: 365,
    nutrients_per_100: { kcal: 354, protein_g: 7.8, carbs_g: 65, fat_g: 9.9, sodium_mg: 38 },
  },
];

export function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const parts = (dateStr || '').slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    // Use 12:00:00 noon local time so date math never crosses midnight or shifts in UTC
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

export function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function addDays(dateStr: string, offset: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + offset);
  return formatLocalDate(d);
}

export function getMonday(d: Date | string = new Date()): string {
  const date =
    typeof d === 'string'
      ? parseLocalDate(d)
      : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return formatLocalDate(date);
}

const STORAGE_KEY = 'mastmeals_db_state_v2';

export interface IntakeLog {
  id: string;
  member_id: string;
  meal_id?: string;
  date: string;
  protein_g: number;
  source: 'meal_done' | 'manual';
}

interface DBState {
  currentHouseholdId: string;
  currentUserId: string;
  users: Record<string, User>;
  households: Record<string, Household>;
  members: Record<string, HouseholdMember[]>;
  stock: Record<string, Record<string, StockItem>>; // householdId -> stockId -> StockItem
  recipes: Record<string, Recipe[]>; // householdId -> Recipe[]
  plans: Record<string, Record<string, MealPlan>>; // householdId -> weekStart -> MealPlan
  shoppingLists: Record<string, Record<string, ShoppingListItem[]>>; // householdId -> weekStart -> items
  pendingActions: Record<string, PendingAction>;
  intakeLogs: IntakeLog[];
  auditLog: { id: string; householdId: string; action: string; meta: any; time: string }[];
  syncLog: { seq: number; table: string; id: string; op: string; time: string }[];
  syncSeq: number;
}

function initializeState(): DBState {
  const user1: User = {
    id: 'usr_alpha',
    email: 'divyansh@local',
    name: 'Divyansh (Head Chef)',
    diet_pref: 'veg',
    is_beginner_cook: true,
    google_sub: 'dev:divyansh@local',
    created_at: new Date().toISOString(),
  };

  const user2: User = {
    id: 'usr_beta',
    email: 'rohan@local',
    name: 'Rohan',
    diet_pref: 'nonveg',
    is_beginner_cook: false,
    google_sub: 'dev:rohan@local',
    created_at: new Date().toISOString(),
  };

  const hh1: Household = {
    id: 'hh_alpha',
    name: 'Room 304 Hostel Flat',
    household_type: 'hostel_room',
    has_fridge: true,
    equipment: ['stove', 'kettle', 'kadhai_pan', 'tawa'] as any,
    language: 'hi',
    version: 1,
    invite_code: 'BLR-402',
    updated_at: new Date().toISOString(),
  };

  const members1: HouseholdMember[] = [
    { id: 'mem_1', household_id: 'hh_alpha', name: 'Divyansh', age_group: 'adult', diet_pref: 'veg', weight_kg: 68, protein_target_g: 60, cautions: [] },
    { id: 'mem_2', household_id: 'hh_alpha', name: 'Rohan', age_group: 'adult', diet_pref: 'nonveg', weight_kg: 74, protein_target_g: 75, cautions: [] },
  ];

  // Seed inventory with Personal vs Shared scopes!
  const seedStock1: Record<string, StockItem> = {
    stk_atta: {
      id: 'stk_atta',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_atta',
      name: 'Chakki Fresh Atta',
      name_hi: 'आशीर्वाद गेहूं आटा • 100% Whole Wheat',
      qty_base: 4500,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null, // SHARED
      contributed_by: 'Rohan (Shared 304)',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 45,
      is_non_veg: false,
    },
    stk_dal: {
      id: 'stk_dal',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_dal',
      name: 'Toor Dal (Unpolished)',
      name_hi: 'अरहर दाल • Organic Toor',
      qty_base: 1200,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null, // SHARED
      contributed_by: 'Divyansh (Shared 304)',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 60,
      is_non_veg: false,
    },
    stk_dahi: {
      id: 'stk_dahi',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_dahi',
      name: 'Fresh Dahi / Curd',
      name_hi: 'अमूल ताज़ा दही • Set Curd',
      qty_base: 400,
      unit_base: 'ml',
      location: 'fridge',
      owner_user_id: 'usr_alpha', // PERSONAL to Divyansh
      contributed_by: 'Divyansh (Personal)',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 2,
      is_non_veg: false,
      expiry: 'Tomorrow',
    },
    stk_paneer: {
      id: 'stk_paneer',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_paneer',
      name: 'Fresh Paneer Block',
      name_hi: 'ताज़ा मलाई पनीर',
      qty_base: 200,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: 'usr_alpha', // PERSONAL
      contributed_by: 'Divyansh (Personal)',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 2,
      is_non_veg: false,
      expiry: 'In 2 days',
    },
    stk_aloo: {
      id: 'stk_aloo',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_aloo',
      name: 'Pahari Aloo / Potatoes',
      name_hi: 'आलू • Medium Size',
      qty_base: 2500,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null, // SHARED
      contributed_by: 'Shared 304',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 20,
      is_non_veg: false,
    },
    stk_chawal: {
      id: 'stk_chawal',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_chawal',
      name: 'Basmati Rice',
      name_hi: 'दावत बासमती चावल',
      qty_base: 2000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null, // SHARED
      contributed_by: 'Shared 304',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 90,
      is_non_veg: false,
    },
    stk_oil: {
      id: 'stk_oil',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_oil',
      name: 'Fortune Sunflower Oil',
      name_hi: 'रिफाइंड तेल',
      qty_base: 1000,
      unit_base: 'ml',
      location: 'pantry',
      owner_user_id: null, // SHARED
      contributed_by: 'Shared 304',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 120,
      is_non_veg: false,
    },
    stk_tamatar: {
      id: 'stk_tamatar',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_tamatar',
      name: 'Desi Tamatar',
      name_hi: 'टमाटर',
      qty_base: 600,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null, // SHARED
      contributed_by: 'Shared 304',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 5,
      is_non_veg: false,
    },
  };

  // Convert seed graph recipes into canonical recipes
  const initialRecipes: Recipe[] = ((seedData as any).recipes || []).slice(0, 150).map((r: any) => ({
    id: r.id,
    title: r.name,
    category: r.course || 'regular',
    slots: r.course?.toLowerCase().includes('breakfast')
      ? ['breakfast']
      : r.course?.toLowerCase().includes('lunch')
      ? ['lunch', 'dinner']
      : ['dinner', 'lunch'],
    base_servings: r.servings || 2,
    times_cooked: Math.floor(Math.random() * 5),
    ingredients: r.ingredients.map((ing: any) => ({
      ingredient_id: ing.canonicalId,
      name: ing.name,
      qty_base: ing.qty_base,
      unit_base: ing.unit_base,
      isNonVeg: ing.isNonVeg,
    })),
  }));

  const weekStart = getMonday();
  const todayStr = getTodayStr();

  const planAlpha: MealPlan = {
    id: 'plan_alpha_1',
    household_id: 'hh_alpha',
    week_start: weekStart,
    version: 1,
    meals: [
      {
        id: 'meal_1',
        plan_id: 'plan_alpha_1',
        meal_date: todayStr,
        slot: 'breakfast',
        household_recipe_id: 'rec_3',
        title: 'Ragi Semiya Upma',
        servings: 2,
        status: 'done',
        diner_member_ids: ['mem_1', 'mem_2'],
        missing: [],
        nutrition: { kcal: 420, protein_g: 18, carbs_g: 46, fat_g: 9, sodium_mg: 365 },
      },
      {
        id: 'meal_2',
        plan_id: 'plan_alpha_1',
        meal_date: todayStr,
        slot: 'lunch',
        household_recipe_id: 'rec_2',
        title: 'Spicy Tomato Rice (Recipe)',
        servings: 2,
        status: 'planned',
        diner_member_ids: ['mem_1', 'mem_2'],
        missing: [],
        nutrition: { kcal: 420, protein_g: 18, carbs_g: 46, fat_g: 9, sodium_mg: 362 },
      },
      {
        id: 'meal_3',
        plan_id: 'plan_alpha_1',
        meal_date: todayStr,
        slot: 'dinner',
        household_recipe_id: 'rec_1',
        title: 'Masala Karela with Dal & Roti',
        servings: 2,
        status: 'planned',
        diner_member_ids: ['mem_1'],
        missing: [
          {
            ingredient_id: 'ing_karela',
            name: 'Karela (Bitter Gourd)',
            unit_base: 'pcs',
            qty_base: 4,
            have_base: 0,
            short_base: 4,
          },
        ],
        nutrition: { kcal: 320, protein_g: 14, carbs_g: 38, fat_g: 8, sodium_mg: 450 },
      },
    ],
  };

  return {
    currentHouseholdId: 'hh_alpha',
    currentUserId: 'usr_alpha',
    users: { usr_alpha: user1, usr_beta: user2 },
    households: { hh_alpha: hh1 },
    members: { hh_alpha: members1 },
    stock: { hh_alpha: seedStock1 },
    recipes: {
      hh_alpha: initialRecipes,
    },
    plans: {
      hh_alpha: { [weekStart]: planAlpha },
    },
    shoppingLists: {
      hh_alpha: {},
    },
    pendingActions: {},
    intakeLogs: [
      {
        id: 'intake_1',
        member_id: 'mem_1',
        meal_id: 'meal_1',
        date: todayStr,
        protein_g: 18,
        source: 'meal_done',
      },
      {
        id: 'intake_2',
        member_id: 'mem_2',
        meal_id: 'meal_1',
        date: todayStr,
        protein_g: 18,
        source: 'meal_done',
      },
    ],
    auditLog: [],
    syncLog: [],
    syncSeq: 0,
  };
}

class StoreService {
  private state: DBState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DBState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    const init = initializeState();
    this.persist(init);
    return init;
  }

  private persist(state = this.state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore
    }
  }

  public resetToDefaults() {
    this.state = initializeState();
    this.persist();
  }

  // --- Auth & User Profile ---
  public getMe() {
    const hh = this.state.households[this.state.currentHouseholdId] || {
      id: this.state.currentHouseholdId,
      name: 'Room 304 Hostel',
      household_type: 'hostel_room',
      has_fridge: true,
      equipment: ['stove', 'kettle', 'kadhai_pan', 'tawa'],
      language: 'hi',
      version: 1,
    };
    const user = this.state.users[this.state.currentUserId] || {
      id: this.state.currentUserId,
      name: 'Divyansh (Head Chef)',
      email: 'divyansh@local',
      diet_pref: 'veg',
      is_beginner_cook: true,
      created_at: new Date().toISOString(),
    };
    const members = this.state.members[this.state.currentHouseholdId] || [];

    return {
      user,
      household: hh,
      role: 'owner',
      client_id: 'client_' + this.state.currentUserId,
      members,
    };
  }

  public setUserPreferences(diet_pref: DietPreference, is_beginner_cook: boolean) {
    const user = this.state.users[this.state.currentUserId];
    if (user) {
      user.diet_pref = diet_pref;
      user.is_beginner_cook = is_beginner_cook;
      this.persist();
    }
    return this.getMe();
  }

  // --- Multi-Week Diet Memory & Regular vs. New Schedule (localStorage) ---
  public getDietMemory(): UserDietMemory {
    try {
      const raw = localStorage.getItem(DIET_MEMORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.weekly_variety_schedule && Array.isArray(parsed.past_regular_dishes)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to default
    }
    const def = createDefaultDietMemory(this.state.currentUserId);
    this.saveDietMemory(def);
    return def;
  }

  public saveDietMemory(memory: UserDietMemory): UserDietMemory {
    const updated = {
      ...memory,
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DIET_MEMORY_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    return updated;
  }

  public setDayVarietyMode(dayKey: DayOfWeekKey, mode: DayVarietyMode): UserDietMemory {
    const mem = this.getDietMemory();
    mem.weekly_variety_schedule = {
      ...mem.weekly_variety_schedule,
      [dayKey]: mode,
    };
    return this.saveDietMemory(mem);
  }

  public setWeeklyVarietySchedule(schedule: WeeklyVarietySchedule): UserDietMemory {
    const mem = this.getDietMemory();
    mem.weekly_variety_schedule = { ...schedule };
    return this.saveDietMemory(mem);
  }

  public toggleDietGoal(goal: DietaryGoalTag): UserDietMemory {
    const mem = this.getDietMemory();
    const exists = mem.diet_goals.includes(goal);
    mem.diet_goals = exists
      ? mem.diet_goals.filter((g) => g !== goal)
      : [...mem.diet_goals, goal];
    return this.saveDietMemory(mem);
  }

  public togglePreferredRegion(region: string): UserDietMemory {
    const mem = this.getDietMemory();
    const exists = mem.preferred_regions.includes(region);
    mem.preferred_regions = exists
      ? mem.preferred_regions.filter((r) => r !== region)
      : [...mem.preferred_regions, region];
    if (mem.preferred_regions.length === 0) {
      mem.preferred_regions = ['North Indian'];
    }
    return this.saveDietMemory(mem);
  }

  public addHabitualDishToMemory(dish: {
    recipe_id?: string;
    title: string;
    cuisine?: string;
    course?: string;
    ingredients?: string[];
  }): UserDietMemory {
    const mem = this.getDietMemory();
    const cleanTitle = dish.title.trim();
    if (!cleanTitle) return mem;

    const existing = mem.past_regular_dishes.find(
      (d) =>
        (dish.recipe_id && d.recipe_id === dish.recipe_id) ||
        d.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    if (existing) {
      existing.times_eaten += 1;
      existing.last_eaten_date = new Date().toISOString().slice(0, 10);
      if (dish.cuisine) existing.cuisine = dish.cuisine;
    } else {
      mem.past_regular_dishes.unshift({
        recipe_id: dish.recipe_id || 'rec_habit_' + Date.now(),
        title: cleanTitle,
        cuisine: dish.cuisine || mem.preferred_regions[0] || 'North Indian',
        course: dish.course || 'Main Course',
        ingredients: dish.ingredients && dish.ingredients.length > 0 ? dish.ingredients : ['dal', 'atta', 'jeera'],
        times_eaten: 4,
        weeks_active: 2,
        last_eaten_date: new Date().toISOString().slice(0, 10),
        is_regular_favorite: true,
      });
    }

    // Recompute common_regions & common_ingredients
    const regionSet = new Set<string>(mem.common_regions);
    const ingSet = new Set<string>(mem.common_ingredients);
    for (const d of mem.past_regular_dishes) {
      if (d.cuisine) regionSet.add(d.cuisine);
      for (const ing of d.ingredients || []) {
        ingSet.add(ing.toLowerCase().replace(/^ing_/, ''));
      }
    }
    mem.common_regions = Array.from(regionSet);
    mem.common_ingredients = Array.from(ingSet).slice(0, 16);

    return this.saveDietMemory(mem);
  }

  public removeHabitualDishFromMemory(recipeIdOrTitle: string): UserDietMemory {
    const mem = this.getDietMemory();
    const q = recipeIdOrTitle.toLowerCase().trim();
    mem.past_regular_dishes = mem.past_regular_dishes.filter(
      (d) => d.recipe_id.toLowerCase() !== q && d.title.toLowerCase() !== q
    );
    return this.saveDietMemory(mem);
  }

  public updateHousehold(data: Partial<Household>) {
    const hh = this.state.households[this.state.currentHouseholdId];
    if (hh) {
      Object.assign(hh, data, {
        version: hh.version + 1,
        updated_at: new Date().toISOString(),
      });
      this.persist();
    }
    return this.getMe();
  }

  public switchHousehold(hhId: string, userId?: string) {
    if (this.state.households[hhId]) {
      this.state.currentHouseholdId = hhId;
      if (userId && this.state.users[userId]) {
        this.state.currentUserId = userId;
      }
      this.persist();
    }
  }

  public addMember(
    nameOrAge: string,
    ageOrLabel?: any,
    dietOrCautions?: any,
    weight_kg = 65,
    cautions: DietCaution[] = []
  ): HouseholdMember {
    const list = this.state.members[this.state.currentHouseholdId] || [];
    let name = 'Member';
    let label = 'Member';
    let age_group: AgeGroup = 'adult';
    let diet_pref: DietPreference = 'veg';
    let actualCautions: DietCaution[] = [];

    if (['kid', 'adult', 'elderly'].includes(nameOrAge)) {
      age_group = nameOrAge as AgeGroup;
      label = typeof ageOrLabel === 'string' ? ageOrLabel : 'Member';
      name = label;
      actualCautions = Array.isArray(dietOrCautions) ? dietOrCautions : [];
    } else {
      name = nameOrAge;
      label = nameOrAge;
      age_group = ageOrLabel || 'adult';
      diet_pref = dietOrCautions || 'veg';
      actualCautions = cautions;
    }

    const newMember: HouseholdMember = {
      id: 'mem_' + Date.now(),
      household_id: this.state.currentHouseholdId,
      name,
      label,
      age_group,
      diet_pref,
      weight_kg,
      protein_target_g: Math.round(weight_kg * 0.9),
      cautions: actualCautions,
    };
    list.push(newMember);
    this.state.members[this.state.currentHouseholdId] = list;
    this.persist();
    return newMember;
  }

  public planCheck(weekStart = getMonday()) {
    const plan = this.getPlan(weekStart);
    const missingMap: Record<
      string,
      {
        ingredient_id: string;
        name: string;
        unit_base: string;
        qty_base: number;
        have_base: number;
        short_base: number;
      }
    > = {};

    for (const m of plan.meals) {
      if (m.status === 'planned' && m.missing) {
        for (const mi of m.missing) {
          const key = mi.ingredient_id || mi.name.toLowerCase();
          if (!missingMap[key]) {
            missingMap[key] = { ...mi };
          } else {
            missingMap[key].qty_base = Math.round((missingMap[key].qty_base + mi.qty_base) * 10) / 10;
            missingMap[key].short_base = Math.round((missingMap[key].short_base + mi.short_base) * 10) / 10;
          }
        }
      }
    }

    // Also include any items currently in shoppingLists for this week that are still short in stock
    const shopList = this.getShoppingList(weekStart);
    for (const sh of shopList) {
      const key = sh.ingredient_id || sh.name.toLowerCase();
      const have = this.getAvailableStockQty(sh.ingredient_id, sh.name);
      if (!missingMap[key] && have < sh.qty_base) {
        missingMap[key] = {
          ingredient_id: sh.ingredient_id,
          name: sh.name,
          unit_base: sh.base_unit || 'g',
          qty_base: sh.qty_base,
          have_base: have,
          short_base: Math.max(1, Math.round((sh.qty_base - have) * 10) / 10),
        };
      }
    }

    const missing = Object.values(missingMap);
    return {
      week_start: weekStart,
      meals_count: plan.meals.length,
      enough: missing.length === 0,
      missing,
    };
  }

  public restockAllMissingItems(weekStart = getMonday()) {
    const hhId = this.state.currentHouseholdId;
    const canonicalWeekStart = getMonday(weekStart);

    // 1. Gather all items currently in the Shop Tab AND all missing items from planned meals
    const currentShopList = [...this.getShoppingList(canonicalWeekStart)];
    const check = this.planCheck(canonicalWeekStart);

    const itemsToRestock: {
      ingredient_id: string;
      name: string;
      unit_base: string;
      qty_base: number;
      have_base: number;
      short_base: number;
    }[] = [];

    // First include every item listed in the Shop Tab
    for (const sh of currentShopList) {
      const have = this.getAvailableStockQty(sh.ingredient_id, sh.name);
      itemsToRestock.push({
        ingredient_id: sh.ingredient_id,
        name: sh.name,
        unit_base: sh.base_unit || 'g',
        qty_base: sh.qty_base,
        have_base: have,
        short_base: sh.qty_base,
      });
    }

    // Also include any missing items from the meal plan not already in itemsToRestock
    for (const mi of check.missing) {
      const existing = itemsToRestock.find((r) =>
        this.doesItemMatch(r.ingredient_id, r.name, mi.ingredient_id, mi.name)
      );
      if (existing) {
        existing.short_base = Math.max(existing.short_base, mi.short_base || 0);
        existing.qty_base = Math.max(existing.qty_base, mi.qty_base || 0);
      } else {
        itemsToRestock.push({ ...mi });
      }
    }

    // If both Shop Tab and planCheck were empty, check if any stock items are at 0 qty
    if (itemsToRestock.length === 0) {
      const zeroStock = this.getStock('all').filter((s) => s.qty_base <= 0);
      for (const zs of zeroStock) {
        itemsToRestock.push({
          ingredient_id: zs.ingredient_id,
          name: zs.name,
          unit_base: zs.unit_base,
          qty_base: zs.unit_base === 'pcs' ? 6 : 500,
          have_base: 0,
          short_base: zs.unit_base === 'pcs' ? 6 : 500,
        });
      }
    }

    const appliedItems: any[] = [];
    for (const req of itemsToRestock) {
      const addQty = Math.max(req.short_base || 0, req.qty_base || 100);
      const isFridge = ['doodh', 'milk', 'dahi', 'curd', 'paneer', 'tamatar', 'tomato', 'mirch', 'palak', 'spinach', 'butter'].some(
        (k) => req.ingredient_id.toLowerCase().includes(k) || req.name.toLowerCase().includes(k)
      );
      const validUnit: BaseUnit =
        req.unit_base === 'ml' ? 'ml' : req.unit_base === 'pcs' ? 'pcs' : 'g';

      const res = this.adjustStock(
        req.ingredient_id,
        'add',
        addQty,
        'shared',
        'bought_all_required',
        {
          name: req.name,
          unit: validUnit,
          location: isFridge ? 'fridge' : 'pantry',
          targetScope: 'shared',
        }
      );

      appliedItems.push({
        ingredient_id: req.ingredient_id,
        name: res.name || req.name,
        qty_base: addQty,
        unit_base: validUnit,
        op: 'add' as const,
        before: res.before,
        after: res.after,
        stock_id: res.stockId,
        is_existing: res.before > 0,
        location: (isFridge ? 'fridge' : 'pantry') as 'fridge' | 'pantry',
        target_scope: 'shared' as const,
        target_section: `Kitchen Stock → ${isFridge ? 'Fridge' : 'Pantry'} (Shared)`,
        classification: 'Restocked from Shop Tab to Kitchen Stock',
      });
    }

    // Ensure every planned meal has 0 missing items and top up any remaining recipe shortfall
    const allPlans = this.state.plans[hhId] || {};
    for (const wk of Object.keys(allPlans)) {
      const p = allPlans[wk];
      if (!p) continue;
      for (const m of p.meals) {
        if (m.status === 'planned') {
          try {
            const detail = this.getRecipeDetail(m.household_recipe_id, m.servings);
            for (const rem of detail.missing || []) {
              if (rem.short_base > 0) {
                const validUnit: BaseUnit =
                  rem.unit_base === 'ml' ? 'ml' : rem.unit_base === 'pcs' ? 'pcs' : 'g';
                this.adjustStock(rem.ingredient_id, 'add', rem.short_base, 'shared', 'bought_all_required', {
                  name: rem.name,
                  unit: validUnit,
                  targetScope: 'shared',
                });
              }
            }
          } catch {
            // ignore
          }
          m.missing = [];
        }
      }
    }

    // Explicitly empty the Shop Tab across all weeks for this household
    if (!this.state.shoppingLists[hhId]) {
      this.state.shoppingLists[hhId] = {};
    }
    for (const wk of Object.keys(this.state.shoppingLists[hhId])) {
      this.state.shoppingLists[hhId][wk] = [];
    }
    this.state.shoppingLists[hhId][canonicalWeekStart] = [];
    this.persist();

    return {
      appliedItems,
      stock: this.getStock('all'),
      plan: this.getPlan(canonicalWeekStart),
      shoppingList: [],
    };
  }

  public markDone(mealId: string) {
    const res = this.markMealDone(mealId);
    return {
      success: true,
      meal: res.meal,
      deducted: [{ name: res.deductions || 'Ingredients', qty: '', unit: '' }],
    };
  }

  public markSkip(mealId: string) {
    this.skipMeal(mealId);
  }

  public getIngredientById(id: string): Ingredient | undefined {
    return CANONICAL_INGREDIENTS.find((i) => i.id === id);
  }

  public findIngredientByName(query: string): Ingredient | undefined {
    const q = query.trim().toLowerCase();
    return CANONICAL_INGREDIENTS.find(
      (i) =>
        i.name_en.toLowerCase() === q ||
        i.name_hi === q ||
        i.aliases.some((a) => a.toLowerCase() === q)
    );
  }

  public deleteMember(memberId: string) {
    let list = this.state.members[this.state.currentHouseholdId] || [];
    list = list.filter((m) => m.id !== memberId);
    this.state.members[this.state.currentHouseholdId] = list;
    this.persist();
  }

  // --- 2-Scope Stock: Personal vs Shared ---
  public getStock(scope: 'all' | 'mine' | 'shared' = 'all'): StockItem[] {
    const hhId = this.state.currentHouseholdId;
    const currentUserId = this.state.currentUserId;
    const stockMap = this.state.stock[hhId] || {};
    const allItems = Object.values(stockMap);

    if (scope === 'mine') {
      return allItems.filter((i) => i.owner_user_id === currentUserId);
    }
    if (scope === 'shared') {
      return allItems.filter((i) => i.owner_user_id === null);
    }
    // 'all' visible to this user: shared + user's own personal stock
    return allItems.filter((i) => i.owner_user_id === null || i.owner_user_id === currentUserId);
  }

  public getStockMap(): Record<string, number> {
    const items = this.getStock('all');
    const map: Record<string, number> = {};
    for (const item of items) {
      const slug = item.ingredient_id.replace(/^ing_/, '').toLowerCase();
      const nameSlug = item.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      map[item.ingredient_id] = (map[item.ingredient_id] || 0) + item.qty_base;
      map[slug] = (map[slug] || 0) + item.qty_base;
      map[`ing_${slug}`] = (map[`ing_${slug}`] || 0) + item.qty_base;
      if (nameSlug) {
        map[nameSlug] = (map[nameSlug] || 0) + item.qty_base;
        map[`ing_${nameSlug}`] = (map[`ing_${nameSlug}`] || 0) + item.qty_base;
      }
    }
    return map;
  }

  public doesItemMatch(idA: string, nameA: string, idB: string, nameB: string): boolean {
    const cleanIdA = (idA || '').toLowerCase().replace(/^ing_/, '').replace(/^stk_/, '').replace(/^shop_/, '').trim();
    const cleanIdB = (idB || '').toLowerCase().replace(/^ing_/, '').replace(/^stk_/, '').replace(/^shop_/, '').trim();
    const cleanNameA = (nameA || '').toLowerCase().trim();
    const cleanNameB = (nameB || '').toLowerCase().trim();

    if (cleanIdA && cleanIdB && cleanIdA === cleanIdB) return true;
    if (cleanNameA && cleanNameB && cleanNameA === cleanNameB) return true;
    if (cleanNameA && cleanNameB && (cleanNameA.includes(cleanNameB) || cleanNameB.includes(cleanNameA))) {
      return true;
    }

    const synonymGroups: string[][] = [
      ['aloo', 'potato', 'potatoes', 'pahari aloo', 'आलू'],
      ['atta', 'wheat', 'whole wheat', 'chakki atta', 'flour', 'gehu', 'आटा'],
      ['doodh', 'milk', 'fresh milk', 'amul milk', 'दूध'],
      ['dahi', 'curd', 'yogurt', 'masti dahi', 'दही'],
      ['paneer', 'cottage cheese', 'malai paneer', 'पनीर'],
      ['tamatar', 'tomato', 'tomatoes', 'टमाटर'],
      ['chawal', 'rice', 'basmati', 'चावल'],
      ['pyaz', 'onion', 'onions', 'pyaj', 'kanda', 'प्याज', 'प्याज़'],
      ['tel', 'oil', 'mustard oil', 'sunflower oil', 'तेल'],
      ['ghee', 'clarified butter', 'घी'],
      ['chini', 'sugar', 'cheeni', 'चीनी'],
      ['namak', 'salt', 'sendha namak', 'नमक'],
      ['mirchi', 'mirch', 'chilli', 'chili', 'chillies', 'green chillies', 'hari mirch', 'मिर्च'],
      ['haldi', 'turmeric', 'हल्दी'],
      ['jeera', 'cumin', 'जीरा'],
      ['dal', 'daal', 'lentils', 'toor', 'arhar', 'moong', 'masoor', 'urad', 'chana dal', 'दाल'],
      ['karela', 'bitter gourd', 'करेला'],
      ['bhindi', 'okra', 'lady finger', 'भिंडी'],
      ['palak', 'spinach', 'पालक'],
      ['dhaniya', 'coriander', 'cilantro', 'धनिया'],
      ['ragi', 'finger millet', 'nachni', 'रागी'],
      ['semiya', 'vermicelli', 'sevai', 'सेवई'],
      ['poha', 'flattened rice', 'beaten rice', 'पोहा'],
      ['mungfali', 'peanut', 'peanuts', 'groundnut', 'मूंगफली'],
      ['besan', 'gram flour', 'बेसन'],
      ['rai', 'sarson', 'mustard seeds', 'mustard', 'राई', 'सरसों'],
      ['kadi patta', 'curry leaves', 'curry leaf', 'कड़ी पत्ता'],
      ['adrak', 'ginger', 'अदरक'],
      ['lahsun', 'garlic', 'लहसुन'],
      ['gobhi', 'cauliflower', 'गोभी'],
      ['matar', 'peas', 'green peas', 'मटर'],
      ['gajar', 'carrot', 'carrots', 'गाजर'],
      ['shimla', 'capsicum', 'bell pepper', 'शिमला मिर्च'],
      ['baingan', 'brinjal', 'eggplant', 'बैंगन'],
      ['lauki', 'bottle gourd', 'ghiya', 'लौकी'],
      ['rajma', 'kidney beans', 'राजमा'],
      ['chole', 'chickpea', 'chickpeas', 'kabuli chana', 'छोले'],
    ];

    const strA = `${cleanIdA.replace(/_/g, ' ')} ${cleanNameA}`;
    const strB = `${cleanIdB.replace(/_/g, ' ')} ${cleanNameB}`;

    for (const group of synonymGroups) {
      const aMatches = group.some((term) => strA.includes(term));
      const bMatches = group.some((term) => strB.includes(term));
      if (aMatches && bMatches) return true;
    }

    const stopWords = new Set([
      'ing',
      'stk',
      'shop',
      'fresh',
      'chopped',
      'sliced',
      'diced',
      'powder',
      'seeds',
      'leaves',
      'leaf',
      'raw',
      'boiled',
      'roasted',
      'dry',
      'dried',
      'whole',
      'split',
      'organic',
      'desi',
      'red',
      'green',
      'black',
      'white',
      'yellow',
      'water',
      'for',
      'and',
      'with',
    ]);

    const tokensA = strA
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !stopWords.has(t));
    const tokensB = new Set(
      strB
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !stopWords.has(t))
    );

    for (const tok of tokensA) {
      if (tokensB.has(tok)) return true;
    }

    return false;
  }

  public getAvailableStockQty(ingredientId: string, name?: string): number {
    const stock = this.getStockMap();
    const slug = (ingredientId || '').replace(/^ing_/, '').toLowerCase();
    if (stock[ingredientId] !== undefined && stock[ingredientId] > 0) {
      return stock[ingredientId];
    }
    if (slug && stock[slug] !== undefined && stock[slug] > 0) {
      return stock[slug];
    }
    // Check all stock items using doesItemMatch and sum matching quantities
    const allItems = this.getStock('all');
    let matchedSum = 0;
    for (const st of allItems) {
      if (this.doesItemMatch(ingredientId, name || '', st.ingredient_id, st.name)) {
        matchedSum += st.qty_base;
      }
    }
    if (matchedSum > 0) {
      return matchedSum;
    }
    const matched = this.findMatchingStockItem(name || ingredientId);
    if (matched) {
      return matched.qty_base;
    }
    return stock[ingredientId] || stock[slug] || 0;
  }

  public findMatchingStockItem(queryOrName: string): StockItem | null {
    const hhId = this.state.currentHouseholdId;
    const stockMap = this.state.stock[hhId] || {};
    const items = Object.values(stockMap);
    if (!queryOrName || items.length === 0) return null;

    const q = queryOrName.toLowerCase().trim();

    // 1. Exact ID or ingredient_id match
    const exact = items.find(
      (i) => i.id === queryOrName || i.ingredient_id === queryOrName || i.ingredient_id.replace(/^ing_/, '') === q
    );
    if (exact) return exact;

    // 2. Exact English or Hindi name match
    const exactName = items.find(
      (i) =>
        i.name.toLowerCase().trim() === q ||
        (i.name_hi && i.name_hi.trim() === queryOrName.trim())
    );
    if (exactName) return exactName;

    // 3. Synonym & Token match via doesItemMatch
    const synMatch = items.find((i) => this.doesItemMatch(queryOrName, queryOrName, i.ingredient_id, i.name));
    if (synMatch) return synMatch;

    return null;
  }

  public adjustStock(
    ingredientId: string,
    op: StockOp,
    qty: number,
    targetScope: 'personal' | 'shared' = 'shared',
    reason = 'manual',
    options?: {
      stockId?: string;
      name?: string;
      name_hi?: string;
      location?: 'pantry' | 'fridge';
      unit?: BaseUnit;
      targetScope?: 'personal' | 'shared';
    }
  ) {
    const hhId = this.state.currentHouseholdId;
    const currentUserId = this.state.currentUserId;
    if (!this.state.stock[hhId]) {
      this.state.stock[hhId] = {};
    }

    // Ensure current week's shopping list is initialized so we can check & update it
    const currentWeek = getMonday();
    if (!this.state.shoppingLists[hhId] || !this.state.shoppingLists[hhId][currentWeek]) {
      this.generateShoppingList(currentWeek);
    }

    const items = Object.values(this.state.stock[hhId]);
    const scope = options?.targetScope || targetScope;
    const targetOwner = scope === 'personal' ? currentUserId : null;

    // 1. Locate item: first by options.stockId, then findMatchingStockItem, then direct ID
    let item: StockItem | undefined = undefined;

    if (options?.stockId) {
      item = items.find((i) => i.id === options.stockId);
    }

    if (!item) {
      item = this.findMatchingStockItem(options?.name || ingredientId) || undefined;
    }

    if (!item) {
      item = items.find(
        (i) =>
          (i.ingredient_id === ingredientId || i.id === ingredientId) &&
          (i.owner_user_id === targetOwner || items.length === 1)
      );
    }

    const before = item ? item.qty_base : 0;
    let after = before;

    if (op === 'add') {
      after = before + qty;
    } else if (op === 'remove') {
      after = Math.max(before - qty, 0);
    } else if (op === 'set') {
      after = qty;
    }

    if (item) {
      item.qty_base = Math.round(after * 10) / 10;
      if (options?.location) {
        item.location = options.location;
        item.storage_place = options.location;
      }
      if (options?.unit) item.unit_base = options.unit;
      if (options?.name_hi && !item.name_hi) item.name_hi = options.name_hi;
      item.version += 1;
    } else {
      const id = 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const loc = options?.location || 'pantry';
      item = {
        id,
        household_id: hhId,
        ingredient_id: ingredientId,
        name: options?.name || ingredientId.replace('ing_', '').replace(/_/g, ' '),
        name_hi: options?.name_hi,
        qty_base: Math.round(after * 10) / 10,
        unit_base: options?.unit || 'g',
        location: loc,
        owner_user_id: targetOwner,
        contributed_by: targetOwner ? 'Personal (Scanned)' : 'Shared (Scanned)',
        version: 1,
        storage_place: loc,
        shelf_life_days: loc === 'fridge' ? 7 : 45,
      };
      this.state.stock[hhId][id] = item;
    }

    // Check Shop Tab listings for the item being added and deduct/remove if enough was added
    const addedDelta = Math.max(0, after - before);
    const removedFromShop: string[] = [];
    const updatedInShop: { name: string; qty_base: number; base_unit: string }[] = [];

    if (addedDelta > 0 && this.state.shoppingLists[hhId]) {
      for (const wk of Object.keys(this.state.shoppingLists[hhId])) {
        const currentList = this.state.shoppingLists[hhId][wk] || [];
        const nextList: ShoppingListItem[] = [];
        for (const sh of currentList) {
          if (this.doesItemMatch(item.ingredient_id, item.name, sh.ingredient_id, sh.name)) {
            const remaining = Math.round((sh.qty_base - addedDelta) * 10) / 10;
            if (remaining <= 1e-9) {
              removedFromShop.push(sh.name);
            } else {
              sh.qty_base = remaining;
              updatedInShop.push({ name: sh.name, qty_base: remaining, base_unit: sh.base_unit });
              nextList.push(sh);
            }
          } else {
            nextList.push(sh);
          }
        }
        this.state.shoppingLists[hhId][wk] = nextList;
      }
    }

    this.logAudit('stock_adjust', {
      stockId: item.id,
      ingredientId,
      name: item.name,
      op,
      qty,
      before,
      after,
      targetScope: scope,
      reason,
      removedFromShop,
    });

    // Sync planned meals' missing items and shopping list whenever stock changes
    this.syncPlansAndShoppingWithStock(removedFromShop);
    this.persist();

    return {
      stockId: item.id,
      name: item.name,
      unit_base: item.unit_base,
      before,
      after,
      removedFromShop,
      updatedInShop,
      stock: this.getStock('all'),
    };
  }

  private syncPlansAndShoppingWithStock(explicitlyRemovedNames: string[] = []) {
    const hhId = this.state.currentHouseholdId;
    const allPlans = this.state.plans[hhId] || {};
    for (const wk of Object.keys(allPlans)) {
      const p = allPlans[wk];
      if (!p) continue;
      for (const m of p.meals) {
        if (m.status === 'planned') {
          try {
            const detail = this.getRecipeDetail(m.household_recipe_id, m.servings);
            m.missing = detail.missing;
          } catch {
            if (Array.isArray(m.missing) && m.missing.length > 0) {
              m.missing = m.missing
                .map((mi) => {
                  const have = this.getAvailableStockQty(mi.ingredient_id, mi.name);
                  return {
                    ...mi,
                    have_base: have,
                    short_base: Math.max(0, Math.round((mi.qty_base - have) * 10) / 10),
                  };
                })
                .filter((mi) => mi.short_base > 1e-9);
            }
          }
        }
      }

      // Reconcile existing shopping list with updated meal shortfalls & stock
      if (this.state.shoppingLists[hhId] && this.state.shoppingLists[hhId][wk]) {
        const shortfalls: Record<string, { name: string; qty: number; unit: string }> = {};
        for (const meal of p.meals) {
          if (meal.status === 'planned' && meal.missing) {
            for (const mi of meal.missing) {
              if (!shortfalls[mi.ingredient_id]) {
                shortfalls[mi.ingredient_id] = { name: mi.name, qty: 0, unit: mi.unit_base };
              }
              shortfalls[mi.ingredient_id].qty += mi.short_base;
            }
          }
        }

        const existingShop = this.state.shoppingLists[hhId][wk] || [];
        const updatedShop: ShoppingListItem[] = [];

        // 1. Update or remove existing shop items based on stock & shortfalls
        for (const sh of existingShop) {
          const matchingShortfallEntry = Object.entries(shortfalls).find(([sId, sInfo]) =>
            this.doesItemMatch(sh.ingredient_id, sh.name, sId, sInfo.name)
          );

          if (matchingShortfallEntry) {
            const [sId, sInfo] = matchingShortfallEntry;
            delete shortfalls[sId];
            sh.qty_base = Math.round(sInfo.qty * 10) / 10;
            if (sh.qty_base > 0) {
              updatedShop.push(sh);
            } else {
              explicitlyRemovedNames.push(sh.name);
            }
          } else {
            // If it was a meal shortfall item that is no longer missing in any meal, remove it!
            // Only keep it if it was manually added to the shopping list AND not enough stock was added.
            const isManualShopItem = sh.id.startsWith('shop_manual_');
            if (isManualShopItem && sh.qty_base > 0) {
              updatedShop.push(sh);
            } else {
              explicitlyRemovedNames.push(sh.name);
            }
          }
        }

        // 2. Add any newly discovered meal shortfalls
        let idx = updatedShop.length;
        for (const [id, info] of Object.entries(shortfalls)) {
          if (info.qty <= 0) continue;
          const basePrice = Math.round(35 + (idx++ * 17) % 65);
          updatedShop.push({
            id: 'shop_' + id + '_' + Date.now(),
            ingredient_id: id,
            name: info.name,
            qty_base: Math.round(info.qty * 10) / 10,
            base_unit: info.unit,
            owner_user_id: null,
            in_swiggy_cart: false,
            estimated_price: basePrice,
            swiggy_price: basePrice + 4,
            blinkit_price: basePrice,
            zepto_price: basePrice + 2,
            best_store: 'Blinkit',
            as_of: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }

        this.state.shoppingLists[hhId][wk] = updatedShop;
      }
    }
  }

  public moveToScope(stockId: string, targetScope: 'personal' | 'shared') {
    const hhId = this.state.currentHouseholdId;
    const currentUserId = this.state.currentUserId;
    const stockMap = this.state.stock[hhId] || {};
    const item = stockMap[stockId];
    if (item) {
      item.owner_user_id = targetScope === 'personal' ? currentUserId : null;
      item.contributed_by = targetScope === 'personal' ? 'Personal' : 'Shared';
      item.version += 1;
      this.logAudit('stock_scope_move', { stockId, targetScope });
      this.persist();
    }
  }

  // --- Ingest Scanned Receipt or Fridge Items ---
  public ingestScannedItems(items: {
    name: string;
    name_hi?: string;
    qty_base: number;
    unit_base: string;
    location?: string;
    targetScope: 'personal' | 'shared';
    is_estimate?: boolean;
  }[]) {
    const results = [];
    for (const it of items) {
      const slug = it.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 30);
      const ingId = `ing_${slug || 'item'}`;
      const validUnit: BaseUnit =
        it.unit_base === 'ml' ? 'ml' : it.unit_base === 'pcs' ? 'pcs' : 'g';
      const validLoc: 'fridge' | 'pantry' =
        it.location === 'fridge' ? 'fridge' : 'pantry';

      const res = this.adjustStock(
        ingId,
        'add',
        it.qty_base,
        it.targetScope,
        it.is_estimate ? 'fridge_scan' : 'receipt_ocr',
        {
          name: it.name,
          name_hi: it.name_hi,
          location: validLoc,
          unit: validUnit,
          targetScope: it.targetScope,
        }
      );
      results.push(res);
    }
    return results;
  }

  // --- Recipes & Graph RAG Integration ---
  public getRecipes(): Recipe[] {
    const hhId = this.state.currentHouseholdId;
    const user = this.state.users[this.state.currentUserId];
    let list = this.state.recipes[hhId] || [];

    // Strict dietary filter: if user is veg, remove all non-veg recipes
    if (user && user.diet_pref === 'veg') {
      list = list.filter((r) => {
        return !r.ingredients.some((i: any) => i.isNonVeg);
      });
    }

    return list;
  }

  public modifyRecipeIngredient(
    recipeIdOrTitle: string,
    ingredientNameOrId: string,
    newQty: number,
    unit = 'g',
    op: 'set' | 'add' | 'remove' = 'set'
  ) {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.recipes[hhId]) {
      this.state.recipes[hhId] = [];
    }

    const q = recipeIdOrTitle.toLowerCase().trim();
    let recipe = this.state.recipes[hhId].find(
      (r) => r.id.toLowerCase() === q || r.title.toLowerCase().includes(q)
    );

    // If not in household recipes list, find in seedData and copy over
    if (!recipe) {
      const seedRec = (seedData as any).recipes?.find(
        (r: any) => r.id.toLowerCase() === q || r.name.toLowerCase().includes(q)
      );
      if (seedRec) {
        recipe = {
          id: seedRec.id,
          household_id: hhId,
          title: seedRec.name,
          category: seedRec.course || 'regular',
          slots: ['lunch', 'dinner'],
          base_servings: seedRec.servings || 2,
          times_cooked: 0,
          ingredients: seedRec.ingredients.map((ing: any) => ({
            ingredient_id: ing.canonicalId || `ing_${ing.name.toLowerCase().replace(/\s+/g, '_')}`,
            name: ing.name,
            qty_base: ing.qty_base,
            unit_base: ing.unit_base || 'g',
            isNonVeg: ing.isNonVeg,
          })),
        };
        this.state.recipes[hhId].push(recipe);
      }
    }

    if (!recipe) {
      // Create custom recipe if none matched
      const customId = 'rec_custom_' + Date.now();
      recipe = {
        id: customId,
        household_id: hhId,
        title: recipeIdOrTitle,
        category: 'Custom',
        slots: ['lunch', 'dinner'],
        base_servings: 2,
        times_cooked: 0,
        ingredients: [
          {
            ingredient_id: `ing_${ingredientNameOrId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name: ingredientNameOrId,
            qty_base: Math.round(newQty * 10) / 10,
            unit_base: (unit || 'g') as any,
          },
        ],
      };
      this.state.recipes[hhId].push(recipe);
    }

    const ingQ = ingredientNameOrId.toLowerCase().trim();
    let ing = recipe.ingredients.find(
      (i) => i.ingredient_id.toLowerCase().includes(ingQ) || (i.name && i.name.toLowerCase().includes(ingQ))
    );

    let oldQty = 0;
    if (ing) {
      oldQty = ing.qty_base;
      if (op === 'add') {
        ing.qty_base = Math.round((ing.qty_base + newQty) * 10) / 10;
      } else if (op === 'remove') {
        ing.qty_base = Math.max(0, Math.round((ing.qty_base - newQty) * 10) / 10);
      } else {
        ing.qty_base = Math.round(newQty * 10) / 10;
      }
      if (unit) ing.unit_base = unit as any;
    } else {
      // Add as new ingredient to the existing recipe
      const newIng = {
        ingredient_id: `ing_${ingQ.replace(/[^a-z0-9]/g, '_')}`,
        name: ingredientNameOrId,
        qty_base: Math.round(newQty * 10) / 10,
        unit_base: (unit || 'g') as any,
      };
      recipe.ingredients.push(newIng);
    }

    this.logAudit('recipe_modified', {
      recipeId: recipe.id,
      title: recipe.title,
      ingredient: ingredientNameOrId,
      oldQty,
      newQty: ing ? ing.qty_base : newQty,
      op,
    });
    this.persist();

    return {
      recipe,
      ingredientName: ing ? ing.name : ingredientNameOrId,
      oldQty,
      newQty: ing ? ing.qty_base : newQty,
      unit: ing ? ing.unit_base : unit,
    };
  }

  public getRecipeDetail(recipeId: string, servings = 2) {
    const hhId = this.state.currentHouseholdId;
    const recipes = this.state.recipes[hhId] || [];
    let recipe = recipes.find((r) => r.id === recipeId || r.title.toLowerCase() === recipeId.toLowerCase());
    let seedRec = (seedData as any).recipes?.find(
      (r: any) => r.id === recipeId || r.name?.toLowerCase() === recipeId.toLowerCase()
    );

    // If not in local household cache, look up in seed Graph
    if (!recipe && seedRec) {
      recipe = {
        id: seedRec.id,
        title: seedRec.name,
        category: seedRec.course || 'regular',
        slots: ['lunch', 'dinner'],
        base_servings: seedRec.servings || 2,
        times_cooked: 0,
        ingredients: (seedRec.ingredients || []).map((ing: any) => ({
          ingredient_id: ing.canonicalId,
          name: ing.name,
          qty_base: ing.qty_base,
          unit_base: ing.unit_base,
          isNonVeg: ing.isNonVeg,
        })),
      };
    }

    // Fallback 1: Check multi-week diet memory (habitual regular dishes)
    if (!recipe) {
      const memDish = this.getDietMemory().past_regular_dishes.find(
        (d) => d.recipe_id === recipeId || d.title.toLowerCase() === recipeId.toLowerCase()
      );
      if (memDish) {
        const memSlot: MealSlot =
          memDish.course === 'breakfast' || memDish.course === 'lunch' || memDish.course === 'dinner'
            ? memDish.course
            : 'lunch';
        recipe = {
          id: memDish.recipe_id,
          title: memDish.title,
          category: memDish.course || 'Main Course',
          slots: [memSlot],
          base_servings: 2,
          times_cooked: memDish.times_eaten || 3,
          ingredients: (memDish.ingredients || ['Onion', 'Tomato', 'Oil', 'Salt', 'Turmeric']).map((name) => ({
            ingredient_id: `ing_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
            name,
            qty_base: name.toLowerCase().includes('oil') || name.toLowerCase().includes('salt') ? 15 : 120,
            unit_base: name.toLowerCase().includes('oil') ? 'ml' : 'g',
          })),
        };
      }
    }

    // Fallback 2: Check planned meals across all weeks in database
    let matchedPlannedMeal: PlannedMeal | undefined;
    if (!recipe) {
      const allPlans = this.state.plans[hhId] || {};
      for (const wk of Object.keys(allPlans)) {
        const found = allPlans[wk]?.meals.find(
          (m) => m.household_recipe_id === recipeId || m.id === recipeId || (m.title || '').toLowerCase() === recipeId.toLowerCase()
        );
        if (found) {
          matchedPlannedMeal = found;
          break;
        }
      }
      if (matchedPlannedMeal) {
        recipe = {
          id: matchedPlannedMeal.household_recipe_id,
          title: matchedPlannedMeal.title || recipeId,
          category: matchedPlannedMeal.slot,
          slots: [matchedPlannedMeal.slot],
          base_servings: matchedPlannedMeal.servings || 2,
          times_cooked: matchedPlannedMeal.status === 'done' ? 1 : 0,
          ingredients: [
            { ingredient_id: 'ing_pyaz', name: 'Onion (Pyaz)', qty_base: 100, unit_base: 'g' },
            { ingredient_id: 'ing_tamatar', name: 'Tomato (Tamatar)', qty_base: 100, unit_base: 'g' },
            { ingredient_id: 'ing_oil', name: 'Cooking Oil / Ghee', qty_base: 15, unit_base: 'ml' },
            { ingredient_id: 'ing_haldi', name: 'Turmeric & Spices', qty_base: 10, unit_base: 'g' },
          ],
        };
      }
    }

    if (!recipe) throw new Error('Recipe not found');

    // If recipe came from local cache, also check seedData by id or title for rich instructions & metadata
    if (!seedRec) {
      seedRec = (seedData as any).recipes?.find(
        (r: any) => r.id === recipe!.id || r.name?.toLowerCase() === recipe!.title.toLowerCase()
      );
    }

    const factor = servings / Math.max(recipe.base_servings || 2, 1);

    const scaledIngredients = recipe.ingredients.map((ri: any) => {
      const qty_base = Math.round(ri.qty_base * factor * 10) / 10;
      const itemName = ri.name || ri.ingredient_id.replace('ing_', '').replace(/_/g, ' ');
      const have_base = this.getAvailableStockQty(ri.ingredient_id, itemName);
      return {
        ...ri,
        name: itemName,
        unit_base: ri.unit_base || 'g',
        qty_base,
        have_base,
        enough: have_base >= qty_base - 1e-9,
      };
    });

    const missing = scaledIngredients
      .filter((i: any) => i.have_base < i.qty_base - 1e-9)
      .map((i: any) => ({
        ingredient_id: i.ingredient_id,
        name: i.name,
        unit_base: i.unit_base,
        qty_base: i.qty_base,
        have_base: i.have_base,
        short_base: Math.round((i.qty_base - i.have_base) * 10) / 10,
      }));

    const baseKcal = seedRec?.nutrientsEstimated?.kcal || 180;
    const baseProtein = seedRec?.nutrientsEstimated?.protein_g || 10;
    const baseCarbs = seedRec?.nutrientsEstimated?.carbs_g || 30;
    const baseFat = seedRec?.nutrientsEstimated?.fat_g || 5;

    const nutrition = {
      kcal: Math.round(baseKcal * (servings / Math.max(seedRec?.servings || 1, 1))),
      protein_g: Math.round(baseProtein * (servings / Math.max(seedRec?.servings || 1, 1))),
      carbs_g: Math.round(baseCarbs * (servings / Math.max(seedRec?.servings || 1, 1))),
      fat_g: Math.round(baseFat * (servings / Math.max(seedRec?.servings || 1, 1))),
      sodium_mg: Math.round(380 * servings),
    };

    const ingListText = scaledIngredients
      .map((i: any) => `${i.name} (${i.qty_base} ${i.unit_base})`)
      .join(', ');

    const defaultSteps = [
      `1. Prep Ingredients: Measure and prepare ${ingListText} for ${servings} servings of ${recipe.title}.`,
      `2. Tempering (Tadka): Heat oil or ghee in a kadhai/pan over medium flame. Add cumin seeds (jeera), aromatics, and chopped onions/tomatoes until golden and fragrant.`,
      `3. Main Cooking: Add the primary ingredients along with turmeric, salt, and house spices. Toss well and simmer until tender and cooked through.`,
      `4. Garnish & Serve: Taste and adjust seasoning. Garnish with fresh coriander leaves and serve hot.`,
    ].join('\n\n');

    return {
      ...recipe,
      servings,
      cuisine: seedRec?.cuisine || matchedPlannedMeal?.cuisine || 'Indian',
      course: seedRec?.course || recipe.category || 'Main Course',
      totalTime: seedRec?.totalTime || 25,
      equipment: seedRec?.equipment || ['stove', 'kadhai_pan'],
      instructions: seedRec?.translatedInstructions || defaultSteps,
      ingredients: scaledIngredients,
      missing,
      nutrition,
    };
  }

  public getExpiringStock(withinDays = 7): StockItem[] {
    return this.getStock('all').filter(
      (i) =>
        i.qty_base > 0 &&
        ((i.shelf_life_days !== undefined && i.shelf_life_days <= withinDays) || Boolean(i.expiry))
    );
  }

  // --- Meal Planner (Unified Single-Table Source of Truth) ---
  public getWeekDays(weekStart = getMonday(), isHindi = false) {
    const canonicalWeekStart = getMonday(weekStart);
    const dietMem = this.getDietMemory();
    const dayKeys: DayOfWeekKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayNamesHi = ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];

    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = addDays(canonicalWeekStart, i);
      const d = parseLocalDate(dateStr);
      const dayKey = dayKeys[i] || 'Mon';
      const varietyMode = dietMem.weekly_variety_schedule[dayKey] || 'regular';
      return {
        offset: i,
        dateStr,
        dayKey,
        dayNum: d.getDate(),
        dayName: isHindi ? dayNamesHi[i] : dayNamesEn[i],
        monthShort: d.toLocaleString('default', { month: 'short' }),
        varietyMode,
      };
    });
  }

  public getMealsForDate(dateStr = getTodayStr()): PlannedMeal[] {
    const canonicalWeekStart = getMonday(dateStr);
    const plan = this.getPlan(canonicalWeekStart);
    const slotOrder: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };
    return plan.meals
      .filter((m) => m.meal_date === dateStr)
      .sort((a, b) => (slotOrder[a.slot] ?? 9) - (slotOrder[b.slot] ?? 9));
  }

  public getPlan(weekStart = getMonday()): MealPlan {
    const hhId = this.state.currentHouseholdId;
    const todayStr = getTodayStr();
    const canonicalWeekStart = getMonday(weekStart);

    if (!this.state.plans[hhId]) {
      this.state.plans[hhId] = {};
    }

    const hhPlans = this.state.plans[hhId];
    const shiftedSundayKey = addDays(canonicalWeekStart, -1);
    const weekEndStr = addDays(canonicalWeekStart, 6);

    // Consolidate any split keys (e.g., Sunday-shifted UTC keys or legacy keys) into canonicalWeekStart
    const allKeys = Object.keys(hhPlans);
    let migrated = false;

    if (!hhPlans[canonicalWeekStart]) {
      hhPlans[canonicalWeekStart] = {
        id: 'plan_' + Date.now(),
        household_id: hhId,
        week_start: canonicalWeekStart,
        version: 1,
        meals: [],
      };
      migrated = true;
    }

    const canonicalPlan = hhPlans[canonicalWeekStart];
    canonicalPlan.week_start = canonicalWeekStart;

    for (const key of allKeys) {
      if (key === canonicalWeekStart) continue;
      const otherPlan = hhPlans[key];
      if (!otherPlan || !Array.isArray(otherPlan.meals)) continue;

      const isSundayShiftedKey = key === shiftedSundayKey;
      for (const m of otherPlan.meals) {
        // If this plan was stored under the UTC-shifted Sunday key or has a Sunday date from the old T00:00:00+toISOString bug, shift +1 day
        let fixedDate = m.meal_date;
        if (
          isSundayShiftedKey &&
          (m.meal_date === shiftedSundayKey || otherPlan.meals.some((om) => om.meal_date === shiftedSundayKey))
        ) {
          fixedDate = addDays(m.meal_date, 1);
        }

        if (fixedDate >= canonicalWeekStart && fixedDate <= weekEndStr) {
          const updatedMeal: PlannedMeal = { ...m, meal_date: fixedDate, plan_id: canonicalPlan.id };
          const existingIdx = canonicalPlan.meals.findIndex(
            (cm) => cm.meal_date === fixedDate && cm.slot === updatedMeal.slot
          );
          if (existingIdx < 0) {
            canonicalPlan.meals.push(updatedMeal);
          } else {
            const existingMeal = canonicalPlan.meals[existingIdx];
            const existingIsSeed = ['meal_1', 'meal_2', 'meal_3'].includes(existingMeal.id);
            const incomingIsSeed = ['meal_1', 'meal_2', 'meal_3'].includes(updatedMeal.id);
            if (existingIsSeed && !incomingIsSeed) {
              canonicalPlan.meals[existingIdx] = updatedMeal;
            }
          }
        }
      }

      delete hhPlans[key];
      migrated = true;
    }

    // Deduplicate meals in canonicalPlan by (meal_date, slot), preferring non-seed / newer meals
    if (canonicalPlan.meals.length > 0) {
      const slotMap = new Map<string, PlannedMeal>();
      for (const m of canonicalPlan.meals) {
        // Also repair any meal Inside canonicalPlan that has meal_date === shiftedSundayKey
        if (m.meal_date === shiftedSundayKey) {
          m.meal_date = addDays(m.meal_date, 1);
          migrated = true;
        }
        const mapKey = `${m.meal_date}_${m.slot}`;
        const prev = slotMap.get(mapKey);
        if (!prev) {
          slotMap.set(mapKey, m);
        } else {
          const prevIsSeed = ['meal_1', 'meal_2', 'meal_3'].includes(prev.id);
          const curIsSeed = ['meal_1', 'meal_2', 'meal_3'].includes(m.id);
          if (prevIsSeed && !curIsSeed) {
            slotMap.set(mapKey, m);
          } else if (!curIsSeed) {
            slotMap.set(mapKey, m);
          }
        }
      }
      if (slotMap.size !== canonicalPlan.meals.length) {
        canonicalPlan.meals = Array.from(slotMap.values());
        migrated = true;
      }
    }

    // Seed initial default meals ONLY if canonicalPlan has 0 meals and it's the current week
    if (canonicalPlan.meals.length === 0 && canonicalWeekStart === getMonday()) {
      canonicalPlan.meals = [
        {
          id: 'meal_1',
          plan_id: canonicalPlan.id,
          meal_date: todayStr,
          slot: 'breakfast',
          household_recipe_id: 'rec_3',
          title: 'Ragi Semiya Upma',
          servings: 2,
          status: 'done',
          diner_member_ids: ['mem_1', 'mem_2'],
          missing: [],
          nutrition: { kcal: 420, protein_g: 18, carbs_g: 46, fat_g: 9, sodium_mg: 365 },
        },
        {
          id: 'meal_2',
          plan_id: canonicalPlan.id,
          meal_date: todayStr,
          slot: 'lunch',
          household_recipe_id: 'rec_2',
          title: 'Spicy Tomato Rice (Recipe)',
          servings: 2,
          status: 'planned',
          diner_member_ids: ['mem_1', 'mem_2'],
          missing: [],
          nutrition: { kcal: 420, protein_g: 18, carbs_g: 46, fat_g: 9, sodium_mg: 362 },
        },
        {
          id: 'meal_3',
          plan_id: canonicalPlan.id,
          meal_date: todayStr,
          slot: 'dinner',
          household_recipe_id: 'rec_1',
          title: 'Masala Karela with Dal & Roti',
          servings: 2,
          status: 'planned',
          diner_member_ids: ['mem_1'],
          missing: [],
          nutrition: { kcal: 320, protein_g: 14, carbs_g: 38, fat_g: 8, sodium_mg: 450 },
        },
      ];
      migrated = true;
    }

    // If this is still the untouched seed plan (only meal_1, meal_2, meal_3) and the date drifted from todayStr, align it to todayStr
    if (
      canonicalWeekStart === getMonday() &&
      canonicalPlan.meals.length > 0 &&
      !canonicalPlan.meals.some((m) => m.meal_date === todayStr) &&
      canonicalPlan.meals.every((m) => ['meal_1', 'meal_2', 'meal_3'].includes(m.id))
    ) {
      for (const m of canonicalPlan.meals) {
        m.meal_date = todayStr;
      }
      migrated = true;
    }

    if (migrated) {
      this.persist();
    }

    // Re-check missing ingredients for planned meals against live kitchen stock
    for (const m of canonicalPlan.meals) {
      if (m.status === 'planned') {
        try {
          const detail = this.getRecipeDetail(m.household_recipe_id, m.servings);
          m.missing = detail.missing;
        } catch {
          // Keep existing
        }
      }
    }

    return canonicalPlan;
  }

  public addMeal(
    mealDate: string,
    slot: MealSlot,
    recipeId: string,
    servings = 2,
    diners: string[] = ['mem_1', 'mem_2'],
    extraMeta?: {
      title?: string;
      variety_type?: 'regular' | 'new';
      cuisine?: string;
      ai_reason?: string;
      diet_tags?: string[];
      protein_g?: number;
      kcal?: number;
    }
  ) {
    const weekStart = getMonday(mealDate);
    const plan = this.getPlan(weekStart);

    let detail: any;
    try {
      detail = this.getRecipeDetail(recipeId, servings);
    } catch {
      detail = {
        title: extraMeta?.title || recipeId,
        missing: [],
        nutrition: {
          kcal: (extraMeta?.kcal || 340) * Math.max(1, Math.round(servings / 2)),
          protein_g: (extraMeta?.protein_g || 14) * Math.max(1, Math.round(servings / 2)),
          carbs_g: 40,
          fat_g: 8,
          sodium_mg: 380,
        },
      };
    }

    // Determine day of week key for variety_type default using timezone-safe local date
    const dayNames: DayOfWeekKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayObj = parseLocalDate(mealDate);
    const dayKey = dayNames[dayObj.getDay()] || 'Mon';
    const dietMem = this.getDietMemory();
    const resolvedVariety =
      extraMeta?.variety_type || dietMem.weekly_variety_schedule[dayKey] || 'regular';

    const existingIdx = plan.meals.findIndex(
      (m) => m.meal_date === mealDate && m.slot === slot
    );

    const newMeal: PlannedMeal = {
      id: existingIdx >= 0 ? plan.meals[existingIdx].id : 'meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      plan_id: plan.id,
      meal_date: mealDate,
      slot,
      household_recipe_id: recipeId,
      title: extraMeta?.title || detail.title || 'Planned Meal',
      servings,
      status: 'planned',
      diner_member_ids: diners,
      missing: detail.missing || [],
      nutrition: {
        kcal: extraMeta?.kcal ? extraMeta.kcal * servings : detail.nutrition?.kcal || 350,
        protein_g: extraMeta?.protein_g ? extraMeta.protein_g * servings : detail.nutrition?.protein_g || 14,
        carbs_g: detail.nutrition?.carbs_g || 42,
        fat_g: detail.nutrition?.fat_g || 8,
        sodium_mg: detail.nutrition?.sodium_mg || 400,
      },
      variety_type: resolvedVariety,
      cuisine: extraMeta?.cuisine,
      ai_reason: extraMeta?.ai_reason,
      diet_tags: extraMeta?.diet_tags,
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      plan.meals[existingIdx] = newMeal;
    } else {
      plan.meals.push(newMeal);
    }

    plan.version += 1;
    this.persist();
    return newMeal;
  }

  public removeMeal(mealId: string, weekStart?: string) {
    const hhId = this.state.currentHouseholdId;
    const plansForHh = this.state.plans[hhId] || {};
    const targetWeeks = weekStart ? [weekStart] : Object.keys(plansForHh);

    for (const wk of targetWeeks) {
      const p = plansForHh[wk];
      if (!p) continue;
      const beforeLen = p.meals.length;
      p.meals = p.meals.filter((m) => m.id !== mealId);
      if (p.meals.length !== beforeLen) {
        p.version += 1;
        this.persist();
        return true;
      }
    }
    return false;
  }

  public applyAIWeekPlan(
    weekStart: string,
    aiMeals: {
      meal_date: string;
      slot: MealSlot;
      recipe_id: string;
      title: string;
      cuisine?: string;
      variety_type?: 'regular' | 'new';
      servings?: number;
      protein_g?: number;
      kcal?: number;
      diet_tags?: string[];
      ai_reason?: string;
    }[]
  ): MealPlan {
    const plan = this.getPlan(weekStart);

    // Keep any meals that were already cooked ('done') so we don't erase completed meals
    const doneMeals = plan.meals.filter((m) => m.status === 'done');
    plan.meals = [...doneMeals];

    for (const item of aiMeals) {
      const slot = (['breakfast', 'lunch', 'dinner'].includes(item.slot) ? item.slot : 'lunch') as MealSlot;
      const alreadyDone = plan.meals.some(
        (m) => m.meal_date === item.meal_date && m.slot === slot && m.status === 'done'
      );
      if (alreadyDone) continue;

      this.addMeal(
        item.meal_date,
        slot,
        item.recipe_id || 'rec_dal_01',
        item.servings || 2,
        ['mem_1', 'mem_2'],
        {
          title: item.title,
          variety_type: item.variety_type === 'new' ? 'new' : 'regular',
          cuisine: item.cuisine,
          ai_reason: item.ai_reason,
          diet_tags: item.diet_tags,
          protein_g: item.protein_g,
          kcal: item.kcal,
        }
      );
    }

    this.logAudit('ai_week_plan_generated', {
      weekStart,
      mealsCount: aiMeals.length,
    });
    this.persist();
    return this.getPlan(weekStart);
  }

  public setMealSlot(
    mealDate: string,
    slot: MealSlot,
    recipeIdOrTitle: string,
    servings = 2,
    diners: string[] = ['mem_1', 'mem_2']
  ) {
    const weekStart = getMonday(mealDate);
    const plan = this.getPlan(weekStart);

    // Find recipe by ID or title
    const recipes = this.getRecipes();
    const seedRecipes = (seedData as any).recipes || [];
    const q = recipeIdOrTitle.toLowerCase().trim();

    let recipe = recipes.find(
      (r) => r.id.toLowerCase() === q || r.title.toLowerCase().includes(q)
    );
    if (!recipe) {
      const s = seedRecipes.find(
        (r: any) => r.id.toLowerCase() === q || r.name.toLowerCase().includes(q)
      );
      if (s) {
        recipe = {
          id: s.id,
          title: s.name,
          category: s.course || 'regular',
          slots: ['lunch', 'dinner'],
          base_servings: s.servings || 2,
          times_cooked: 0,
          ingredients: s.ingredients.map((ing: any) => ({
            ingredient_id: ing.canonicalId,
            name: ing.name,
            qty_base: ing.qty_base,
            unit_base: ing.unit_base,
          })),
        };
      }
    }

    const recipeId = recipe?.id || recipeIdOrTitle;
    const title = recipe?.title || recipeIdOrTitle;

    const updatedMeal = this.addMeal(mealDate, slot, recipeId, servings, diners, { title });
    this.logAudit('meal_slot_set', { mealDate, slot, title: updatedMeal.title });
    return updatedMeal;
  }

  public markMealDone(mealId: string) {
    const hhId = this.state.currentHouseholdId;
    const plansForHh = this.state.plans[hhId] || {};
    let meal: PlannedMeal | undefined;
    let plan: MealPlan | undefined;

    for (const wk of Object.keys(plansForHh)) {
      const found = plansForHh[wk]?.meals.find((m) => m.id === mealId);
      if (found) {
        meal = found;
        plan = plansForHh[wk];
        break;
      }
    }

    if (!meal || !plan) throw new Error('Meal not found');
    if (meal.status === 'done') {
      return { alreadyDone: true, meal };
    }

    let detail: any;
    try {
      detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);
    } catch {
      detail = {
        title: meal.title || 'Cooked Meal',
        ingredients: [],
        nutrition: meal.nutrition || { protein_g: 15, kcal: 340 },
      };
    }

    // Automatic stock deduction: shared first, then personal
    const deductions: string[] = [];
    for (const req of detail.ingredients) {
      let needed = req.qty_base;

      // Try shared stock first
      const sharedItems = this.getStock('shared').filter(
        (i) => i.ingredient_id === req.ingredient_id || i.name.toLowerCase() === req.name.toLowerCase()
      );
      for (const st of sharedItems) {
        if (needed <= 0) break;
        const take = Math.min(st.qty_base, needed);
        st.qty_base = Math.max(0, st.qty_base - take);
        needed -= take;
        deductions.push(`${take} ${st.unit_base} ${st.name} (Shared)`);
      }

      // If still needed, deduct from personal stock
      if (needed > 0) {
        const personalItems = this.getStock('mine').filter(
          (i) => i.ingredient_id === req.ingredient_id || i.name.toLowerCase() === req.name.toLowerCase()
        );
        for (const pt of personalItems) {
          if (needed <= 0) break;
          const take = Math.min(pt.qty_base, needed);
          pt.qty_base = Math.max(0, pt.qty_base - take);
          needed -= take;
          deductions.push(`${take} ${pt.unit_base} ${pt.name} (Personal)`);
        }
      }
    }

    // Auto-log protein for diners
    const diners = meal.diner_member_ids || ['mem_1'];
    const proteinPerDiner = Math.round((detail.nutrition?.protein_g || 15) / Math.max(diners.length, 1));

    for (const dinerId of diners) {
      this.state.intakeLogs.push({
        id: 'intake_' + Date.now() + '_' + dinerId,
        member_id: dinerId,
        meal_id: meal.id,
        date: meal.meal_date,
        protein_g: proteinPerDiner,
        source: 'meal_done',
      });
    }

    meal.status = 'done';
    plan.version += 1;

    // Also update localStorage multi-week diet history when a meal is cooked!
    this.addHabitualDishToMemory({
      recipe_id: meal.household_recipe_id,
      title: meal.title || detail.title || 'Home Cooked Meal',
      cuisine: meal.cuisine || 'North Indian',
      course: meal.slot,
      ingredients: (detail.ingredients || []).map((i: any) => i.name || i.ingredient_id),
    });

    this.logAudit('meal_cooked_done', { mealId, title: meal.title, deductions, diners });
    this.persist();

    return {
      success: true,
      meal,
      deductions: deductions.join(', ') || 'Stock deducted',
      proteinPerDiner,
    };
  }

  public skipMeal(mealId: string) {
    const hhId = this.state.currentHouseholdId;
    const plansForHh = this.state.plans[hhId] || {};
    for (const wk of Object.keys(plansForHh)) {
      const meal = plansForHh[wk]?.meals.find((m) => m.id === mealId);
      if (meal) {
        meal.status = 'skipped';
        this.persist();
        return;
      }
    }
  }

  // Fallback local auto-fill respecting weekly variety schedule & diet history
  public autoFillWeekPlan(weekStart = getMonday()) {
    const plan = this.getPlan(weekStart);
    const recipes = this.getRecipes();
    const dietMem = this.getDietMemory();
    const seedRecipes: any[] = (seedData as any).recipes || [];
    const user = this.state.users[this.state.currentUserId];

    const pastTitles = new Set(
      dietMem.past_regular_dishes.map((d) => d.title.toLowerCase().trim())
    );

    const regularPool =
      dietMem.past_regular_dishes.length > 0
        ? dietMem.past_regular_dishes.map((d) => ({
            id: d.recipe_id,
            title: d.title,
            cuisine: d.cuisine,
          }))
        : recipes.map((r) => ({ id: r.id, title: r.title, cuisine: 'North Indian' }));

    const newPool = seedRecipes
      .filter((r) => (user.diet_pref === 'veg' ? !r.isNonVeg : true))
      .filter((r) => !pastTitles.has(String(r.name || '').toLowerCase().trim()))
      .map((r) => ({ id: r.id, title: r.name, cuisine: r.cuisine || 'South Indian' }));

    const canonicalWeekStart = getMonday(weekStart);
    const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
    const dayKeys: DayOfWeekKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let regIdx = 0;
    let newIdx = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = addDays(canonicalWeekStart, dayOffset);
      const dayKey = dayKeys[dayOffset] || 'Mon';
      const varietyMode = dietMem.weekly_variety_schedule[dayKey] || 'regular';

      for (const slot of slots) {
        const existing = plan.meals.find((m) => m.meal_date === dateStr && m.slot === slot && m.status === 'done');
        if (existing) continue;

        const chosen =
          varietyMode === 'new' && newPool.length > 0
            ? newPool[newIdx++ % newPool.length]
            : regularPool[regIdx++ % Math.max(regularPool.length, 1)];

        if (chosen) {
          this.addMeal(dateStr, slot, chosen.id, 2, ['mem_1', 'mem_2'], {
            title: chosen.title,
            variety_type: varietyMode,
            cuisine: chosen.cuisine,
            ai_reason:
              varietyMode === 'new'
                ? `New discovery dish from ${chosen.cuisine} cuisine via Graph RAG.`
                : `Selected from your regular multi-week diet history (${chosen.cuisine}).`,
          });
        }
      }
    }

    return this.getPlan(weekStart);
  }

  // --- Shopping List & Price Comparison ---
  public generateShoppingList(weekStart = getMonday()): ShoppingListItem[] {
    const hhId = this.state.currentHouseholdId;
    const plan = this.getPlan(weekStart);
    const stock = this.getStockMap();

    const shortfalls: Record<string, { name: string; qty: number; unit: string }> = {};

    for (const meal of plan.meals) {
      if (meal.status === 'planned') {
        try {
          const detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);
          for (const m of detail.missing) {
            if (!shortfalls[m.ingredient_id]) {
              shortfalls[m.ingredient_id] = { name: m.name, qty: 0, unit: m.unit_base };
            }
            shortfalls[m.ingredient_id].qty += m.short_base;
          }
        } catch {
          // ignore
        }
      }
    }

    const stores: ('Swiggy Instamart' | 'Blinkit' | 'Zepto')[] = ['Swiggy Instamart', 'Blinkit', 'Zepto'];

    const items: ShoppingListItem[] = Object.entries(shortfalls).map(([id, info], idx) => {
      const basePrice = Math.round(35 + (idx * 17) % 65);
      const swiggy_price = basePrice + 4;
      const blinkit_price = basePrice;
      const zepto_price = basePrice + 2;
      const best_store = blinkit_price <= swiggy_price && blinkit_price <= zepto_price
        ? 'Blinkit'
        : zepto_price <= swiggy_price ? 'Zepto' : 'Swiggy Instamart';

      return {
        id: 'shop_' + id + '_' + Date.now(),
        ingredient_id: id,
        name: info.name,
        qty_base: info.qty,
        base_unit: info.unit,
        owner_user_id: null, // Shared by default
        in_swiggy_cart: false,
        estimated_price: basePrice,
        swiggy_price,
        blinkit_price,
        zepto_price,
        best_store,
        as_of: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    if (!this.state.shoppingLists[hhId]) {
      this.state.shoppingLists[hhId] = {};
    }
    this.state.shoppingLists[hhId][weekStart] = items;
    this.persist();
    return items;
  }

  public getShoppingList(weekStart = getMonday()): ShoppingListItem[] {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.shoppingLists[hhId]) {
      this.state.shoppingLists[hhId] = {};
    }
    if (this.state.shoppingLists[hhId][weekStart] === undefined) {
      return this.generateShoppingList(weekStart);
    }
    return this.state.shoppingLists[hhId][weekStart] || [];
  }

  public findMatchingShopItem(queryOrName: string, weekStart = getMonday()): ShoppingListItem | null {
    const list = this.getShoppingList(weekStart);
    if (!queryOrName || list.length === 0) return null;
    const q = queryOrName.toLowerCase().trim();

    const exact = list.find(
      (i) =>
        i.id === queryOrName ||
        i.ingredient_id === queryOrName ||
        i.name.toLowerCase() === q
    );
    if (exact) return exact;

    const match = list.find((i) =>
      this.doesItemMatch(queryOrName, queryOrName, i.ingredient_id, i.name)
    );
    return match || null;
  }

  public updateShoppingListFromChat(
    queryOrName: string,
    op: 'add' | 'remove' | 'set' | 'bought',
    qty?: number,
    unit?: string,
    weekStart = getMonday()
  ) {
    const hhId = this.state.currentHouseholdId;
    const list = [...this.getShoppingList(weekStart)];
    const existingIdx = list.findIndex((i) =>
      this.doesItemMatch(queryOrName, queryOrName, i.ingredient_id, i.name)
    );
    const existing = existingIdx >= 0 ? list[existingIdx] : undefined;

    if (op === 'bought') {
      // Buying the item adds it to stock and removes (or reduces) it from the Shop tab
      const targetName = existing?.name || queryOrName;
      const targetIngId =
        existing?.ingredient_id ||
        `ing_${queryOrName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
      const buyQty = qty !== undefined && qty > 0 ? qty : existing?.qty_base || 500;
      const buyUnit: BaseUnit =
        (unit as BaseUnit) ||
        (existing?.base_unit === 'ml'
          ? 'ml'
          : existing?.base_unit === 'pcs'
          ? 'pcs'
          : 'g');
      const isFridge = ['doodh', 'milk', 'dahi', 'curd', 'paneer', 'tamatar', 'tomato', 'mirch', 'palak', 'spinach', 'butter'].some(
        (k) => targetIngId.includes(k) || targetName.toLowerCase().includes(k)
      );

      const stockRes = this.adjustStock(
        targetIngId,
        'add',
        buyQty,
        'shared',
        'shop_item_bought',
        {
          name: targetName,
          unit: buyUnit,
          location: isFridge ? 'fridge' : 'pantry',
          targetScope: 'shared',
        }
      );

      return {
        action: stockRes.removedFromShop?.length ? 'removed_and_stocked' : 'reduced_and_stocked',
        itemName: targetName,
        qty: buyQty,
        unit: buyUnit,
        stockRes,
        shoppingList: this.getShoppingList(weekStart),
      };
    }

    if (op === 'remove' || (op === 'set' && qty !== undefined && qty <= 0)) {
      if (existingIdx >= 0) {
        const removed = list.splice(existingIdx, 1)[0];
        this.state.shoppingLists[hhId][weekStart] = list;
        this.persist();
        return {
          action: 'removed',
          itemName: removed.name,
          qty: 0,
          unit: removed.base_unit,
          shoppingList: list,
        };
      }
      return {
        action: 'not_found',
        itemName: queryOrName,
        qty: 0,
        unit: unit || 'g',
        shoppingList: list,
      };
    }

    // op === 'add' or 'set' on the Shop tab
    if (existing) {
      const nextQty =
        op === 'set'
          ? qty || existing.qty_base
          : Math.round((existing.qty_base + (qty || 200)) * 10) / 10;
      existing.qty_base = nextQty;
      if (unit) existing.base_unit = unit;
      this.state.shoppingLists[hhId][weekStart] = list;
      this.persist();
      return {
        action: 'updated',
        itemName: existing.name,
        qty: existing.qty_base,
        unit: existing.base_unit,
        shoppingList: list,
      };
    } else {
      const cleanTitle = queryOrName
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const slug = queryOrName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const basePrice = 45;
      const newItem: ShoppingListItem = {
        id: 'shop_manual_' + slug + '_' + Date.now(),
        ingredient_id: `ing_${slug}`,
        name: cleanTitle,
        qty_base: qty || 500,
        base_unit: unit || 'g',
        owner_user_id: null,
        in_swiggy_cart: false,
        estimated_price: basePrice,
        swiggy_price: basePrice + 4,
        blinkit_price: basePrice,
        zepto_price: basePrice + 2,
        best_store: 'Blinkit',
        as_of: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      list.push(newItem);
      this.state.shoppingLists[hhId][weekStart] = list;
      this.persist();
      return {
        action: 'added',
        itemName: newItem.name,
        qty: newItem.qty_base,
        unit: newItem.base_unit,
        shoppingList: list,
      };
    }
  }

  // --- Protein Intake Stats ---
  public getMemberProteinStats(memberId: string) {
    const todayStr = getTodayStr();
    const logs = this.state.intakeLogs.filter((l) => l.member_id === memberId && l.date === todayStr);
    const todayTotal = logs.reduce((sum, l) => sum + l.protein_g, 0);

    const member = (this.state.members[this.state.currentHouseholdId] || []).find((m) => m.id === memberId);
    const target = member?.protein_target_g || 60;

    return {
      memberId,
      todayTotal,
      target,
      percentage: Math.min(100, Math.round((todayTotal / target) * 100)),
      logs,
    };
  }

  // --- Omnirush & Pending Actions ---
  public createPendingAction(
    intent: any,
    transcript: string,
    payload: ProposalPayload
  ): PendingAction {
    const id = 'prop_' + Date.now();
    const action: PendingAction = {
      id,
      household_id: this.state.currentHouseholdId,
      client_id: 'client_' + this.state.currentUserId,
      intent,
      transcript,
      payload,
      status: 'pending',
      expires_at: Date.now() + 20 * 60 * 1000,
      created_at: new Date().toISOString(),
    };

    this.state.pendingActions[id] = action;
    this.logAudit('proposal_created', { id, intent });
    this.persist();
    return action;
  }

  public confirmProposal(proposalId: string) {
    const action = this.state.pendingActions[proposalId];
    if (!action) throw new Error('Proposal not found');
    if (action.status !== 'pending') throw new Error('Proposal already handled');

    const applied: any[] = [];
    const payload = action.payload;

    // 1. Stock changes (apply for update_stock as well as any confirmed item list)
    for (const item of payload.items || []) {
      const res = this.adjustStock(
        item.ingredient_id,
        item.op || 'add',
        item.qty_base,
        item.target_scope || 'shared',
        'proposal_confirm',
        {
          stockId: item.stock_id || undefined,
          name: item.name,
          location: item.location,
          unit: item.unit_base,
          targetScope: item.target_scope,
        }
      );
      applied.push(res);
    }

    // 2. Plan changes / Meal scheduling
    for (const change of payload.plan_changes || []) {
      if (change.household_recipe_id) {
        const res = this.setMealSlot(
          change.meal_date,
          change.slot,
          change.household_recipe_id,
          change.servings || 2
        );
        applied.push({ plan_set: res });
      }
    }

    // 3. Offline recipe modifications (e.g. increase sugar in Kheer to 150g)
    if (payload.recipe_modification) {
      const rm = payload.recipe_modification;
      const res = this.modifyRecipeIngredient(
        rm.recipe_id || rm.recipe_title,
        rm.ingredient_name,
        rm.new_qty,
        rm.unit || 'g',
        rm.op || 'set'
      );
      applied.push({ recipe_modified: res });
    }

    action.status = 'confirmed';
    this.logAudit('proposal_confirmed', { proposalId, intent: action.intent, applied });
    this.persist();

    return {
      applied,
      stock: this.getStock('all'),
      recipe_modification: payload.recipe_modification,
    };
  }

  public discardProposal(proposalId: string) {
    const action = this.state.pendingActions[proposalId];
    if (action) {
      action.status = 'discarded';
      this.persist();
    }
  }

  // --- Audit & Sync ---
  private logAudit(action: string, meta: any) {
    this.state.auditLog.unshift({
      id: 'aud_' + Date.now(),
      householdId: this.state.currentHouseholdId,
      action,
      meta,
      time: new Date().toISOString(),
    });
    if (this.state.auditLog.length > 100) this.state.auditLog.pop();

    this.state.syncSeq += 1;
    this.state.syncLog.unshift({
      seq: this.state.syncSeq,
      table: action,
      id: 'item_' + Date.now(),
      op: 'upsert',
      time: new Date().toISOString(),
    });
  }

  public getAuditLog() {
    return this.state.auditLog;
  }
}

export const store = new StoreService();
