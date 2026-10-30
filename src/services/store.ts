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
} from '../types';
import seedData from '../data/graph_rag_seed.json';

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

export function getMonday(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
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
  const todayStr = new Date().toISOString().slice(0, 10);

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
    const missing: any[] = [];
    for (const m of plan.meals) {
      if (m.status === 'planned' && m.missing) {
        for (const mi of m.missing) {
          missing.push(mi);
        }
      }
    }
    return {
      week_start: weekStart,
      meals_count: plan.meals.length,
      enough: missing.length === 0,
      missing,
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
      const slug = item.ingredient_id.replace('ing_', '');
      map[item.ingredient_id] = (map[item.ingredient_id] || 0) + item.qty_base;
      map[slug] = (map[slug] || 0) + item.qty_base;
    }
    return map;
  }

  public findMatchingStockItem(queryOrName: string): StockItem | null {
    const hhId = this.state.currentHouseholdId;
    const stockMap = this.state.stock[hhId] || {};
    const items = Object.values(stockMap);
    if (!queryOrName || items.length === 0) return null;

    const q = queryOrName.toLowerCase().trim();
    const qClean = q.replace(/^ing_/, '').replace(/^stk_/, '').replace(/[^a-z0-9]/g, '');

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

    // 3. Known Kitchen alias dictionary
    const aliasesMap: Record<string, string[]> = {
      aloo: ['potato', 'potatoes', 'pahari aloo', 'baby potato', 'aloo', 'आलू'],
      atta: ['wheat', 'whole wheat', 'chakki atta', 'flour', 'gehu', 'आटा'],
      doodh: ['milk', 'fresh milk', 'amul milk', 'taaza milk', 'doodh', 'दूध'],
      dahi: ['curd', 'fresh curd', 'yogurt', 'masti dahi', 'dahi', 'दही'],
      paneer: ['cottage cheese', 'malai paneer', 'paneer block', 'पनीर'],
      tamatar: ['tomato', 'tomatoes', 'desi tamatar', 'tamatar', 'टमाटर'],
      chawal: ['rice', 'basmati', 'basmati rice', 'chawal', 'चावल'],
      pyaz: ['onion', 'onions', 'red onion', 'pyaj', 'pyaz', 'प्याज'],
      tel: ['oil', 'cooking oil', 'sunflower oil', 'mustard oil', 'tel', 'तेल'],
      chini: ['sugar', 'cheeni', 'chini', 'चीनी'],
      namak: ['salt', 'sendha namak', 'namak', 'नमक'],
      mirchi: ['chilli', 'chili', 'green chillies', 'hari mirch', 'mirch', 'मिर्च'],
      haldi: ['turmeric', 'haldi', 'हल्दी'],
      jeera: ['cumin', 'cumin seeds', 'jeera', 'जीरा'],
      dal: ['lentils', 'toor dal', 'moong dal', 'masoor dal', 'chana dal', 'दाल'],
    };

    // Find which alias cluster matches the query
    let matchedClusterKey: string | null = null;
    for (const [key, aliases] of Object.entries(aliasesMap)) {
      if (key === qClean || aliases.some((a) => q.includes(a) || a.includes(q))) {
        matchedClusterKey = key;
        break;
      }
    }

    if (matchedClusterKey) {
      const clusterAliases = aliasesMap[matchedClusterKey];
      const match = items.find((i) => {
        const itemLower = i.name.toLowerCase();
        const ingId = i.ingredient_id.toLowerCase();
        return (
          ingId.includes(matchedClusterKey!) ||
          clusterAliases.some((a) => itemLower.includes(a))
        );
      });
      if (match) return match;
    }

    // 4. Substring containment match
    const subMatch = items.find(
      (i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())
    );
    if (subMatch) return subMatch;

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
    });
    this.persist();

    return {
      stockId: item.id,
      name: item.name,
      unit_base: item.unit_base,
      before,
      after,
      stock: this.getStock('all'),
    };
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
    const recipes = this.state.recipes[this.state.currentHouseholdId] || [];
    let recipe = recipes.find((r) => r.id === recipeId);

    // If not in local household cache, look up in seed Graph
    if (!recipe) {
      const seedRec = (seedData as any).recipes?.find((r: any) => r.id === recipeId);
      if (seedRec) {
        recipe = {
          id: seedRec.id,
          title: seedRec.name,
          category: seedRec.course || 'regular',
          slots: ['lunch', 'dinner'],
          base_servings: seedRec.servings || 2,
          times_cooked: 0,
          ingredients: seedRec.ingredients.map((ing: any) => ({
            ingredient_id: ing.canonicalId,
            name: ing.name,
            qty_base: ing.qty_base,
            unit_base: ing.unit_base,
            isNonVeg: ing.isNonVeg,
          })),
        };
      }
    }

    if (!recipe) throw new Error('Recipe not found');

    const factor = servings / Math.max(recipe.base_servings || 2, 1);
    const stock = this.getStockMap();

    const scaledIngredients = recipe.ingredients.map((ri: any) => {
      const qty_base = Math.round(ri.qty_base * factor * 10) / 10;
      const slug = ri.ingredient_id.replace('ing_', '');
      const have_base = stock[ri.ingredient_id] || stock[slug] || 0;
      return {
        ...ri,
        name: ri.name || ri.ingredient_id.replace('ing_', '').replace(/_/g, ' '),
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

    const nutrition = {
      kcal: Math.round(180 * servings),
      protein_g: Math.round(10 * servings),
      carbs_g: Math.round(30 * servings),
      fat_g: Math.round(5 * servings),
      sodium_mg: Math.round(400 * servings),
    };

    return {
      ...recipe,
      servings,
      ingredients: scaledIngredients,
      missing,
      nutrition,
    };
  }

  // --- Meal Planner ---
  public getPlan(weekStart = getMonday()): MealPlan {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.plans[hhId]) {
      this.state.plans[hhId] = {};
    }
    if (!this.state.plans[hhId][weekStart]) {
      this.state.plans[hhId][weekStart] = {
        id: 'plan_' + Date.now(),
        household_id: hhId,
        week_start: weekStart,
        version: 1,
        meals: [],
      };
      this.persist();
    }

    const plan = this.state.plans[hhId][weekStart];
    // Re-check missing ingredients for planned meals
    for (const m of plan.meals) {
      if (m.status === 'planned') {
        try {
          const detail = this.getRecipeDetail(m.household_recipe_id, m.servings);
          m.missing = detail.missing;
        } catch {
          // Keep existing
        }
      }
    }

    return plan;
  }

  public addMeal(
    mealDate: string,
    slot: MealSlot,
    recipeId: string,
    servings = 2,
    diners: string[] = ['mem_1', 'mem_2']
  ) {
    const weekStart = getMonday(new Date(mealDate));
    const plan = this.getPlan(weekStart);

    let detail: any;
    try {
      detail = this.getRecipeDetail(recipeId, servings);
    } catch {
      detail = { title: 'Custom Meal', missing: [], nutrition: { kcal: 350, protein_g: 12 } };
    }

    const newMeal: PlannedMeal = {
      id: 'meal_' + Date.now(),
      plan_id: plan.id,
      meal_date: mealDate,
      slot,
      household_recipe_id: recipeId,
      title: detail.title,
      servings,
      status: 'planned',
      diner_member_ids: diners,
      missing: detail.missing || [],
      nutrition: detail.nutrition || { kcal: 350, protein_g: 12 },
      updated_at: new Date().toISOString(),
    };

    plan.meals.push(newMeal);
    plan.version += 1;
    this.persist();
    return newMeal;
  }

  public setMealSlot(
    mealDate: string,
    slot: MealSlot,
    recipeIdOrTitle: string,
    servings = 2,
    diners: string[] = ['mem_1', 'mem_2']
  ) {
    const weekStart = getMonday(new Date(mealDate));
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

    // Check if slot already exists on that date
    const existingIndex = plan.meals.findIndex(
      (m) => m.meal_date === mealDate && m.slot === slot
    );

    let detail: any;
    try {
      detail = this.getRecipeDetail(recipeId, servings);
    } catch {
      detail = { title, missing: [], nutrition: { kcal: 350, protein_g: 14 } };
    }

    const updatedMeal: PlannedMeal = {
      id: existingIndex >= 0 ? plan.meals[existingIndex].id : 'meal_' + Date.now(),
      plan_id: plan.id,
      meal_date: mealDate,
      slot,
      household_recipe_id: recipeId,
      title: detail.title || title,
      servings,
      status: 'planned',
      diner_member_ids: diners,
      missing: detail.missing || [],
      nutrition: detail.nutrition || { kcal: 350, protein_g: 14 },
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      plan.meals[existingIndex] = updatedMeal;
    } else {
      plan.meals.push(updatedMeal);
    }

    plan.version += 1;
    this.logAudit('meal_slot_set', { mealDate, slot, title: updatedMeal.title });
    this.persist();
    return updatedMeal;
  }

  public markMealDone(mealId: string) {
    const hhId = this.state.currentHouseholdId;
    const plan = this.getPlan();
    const meal = plan.meals.find((m) => m.id === mealId);

    if (!meal) throw new Error('Meal not found');
    if (meal.status === 'done') {
      return { alreadyDone: true, meal };
    }

    const detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);

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
    const plan = this.getPlan();
    const meal = plan.meals.find((m) => m.id === mealId);
    if (meal) {
      meal.status = 'skipped';
      this.persist();
    }
  }

  // Auto suggest / fill 7-day plan from stock with Graph RAG
  public autoFillWeekPlan(weekStart = getMonday()) {
    const plan = this.getPlan(weekStart);
    const recipes = this.getRecipes();
    const user = this.state.users[this.state.currentUserId];

    let available = recipes;
    if (user.is_beginner_cook) {
      available = available.filter((r) => r.category.includes('Breakfast') || r.title.length < 25);
    }

    const startDate = new Date(weekStart);
    const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const curDate = new Date(startDate);
      curDate.setDate(curDate.getDate() + dayOffset);
      const dateStr = curDate.toISOString().slice(0, 10);

      for (const slot of slots) {
        // If already planned, skip
        const existing = plan.meals.find((m) => m.meal_date === dateStr && m.slot === slot);
        if (!existing && available.length > 0) {
          const randRec = available[Math.floor(Math.random() * available.length)];
          this.addMeal(dateStr, slot, randRec.id, 2, ['mem_1', 'mem_2']);
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
    const lists = this.state.shoppingLists[hhId] || {};
    return lists[weekStart] || [];
  }

  // --- Protein Intake Stats ---
  public getMemberProteinStats(memberId: string) {
    const todayStr = new Date().toISOString().slice(0, 10);
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

    // 1. Stock changes
    if (payload.intent !== 'add_to_cart') {
      for (const item of payload.items || []) {
        const res = this.adjustStock(
          item.ingredient_id,
          item.op,
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
