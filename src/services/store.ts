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
  DietCaution,
  AgeGroup,
} from '../types';

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
];

export const CANONICAL_RECIPES: Recipe[] = [
  {
    id: 'rec_aloo_paratha',
    title: 'Aloo Paratha',
    category: 'regular',
    slots: ['breakfast'],
    base_servings: 2,
    times_cooked: 3,
    ingredients: [
      { ingredient_id: 'ing_aloo', qty_base: 300 },
      { ingredient_id: 'ing_atta', qty_base: 250 },
      { ingredient_id: 'ing_oil', qty_base: 30 },
      { ingredient_id: 'ing_namak', qty_base: 6 },
      { ingredient_id: 'ing_jeera', qty_base: 4 },
    ],
  },
  {
    id: 'rec_dal_chawal',
    title: 'Dal Chawal',
    category: 'regular',
    slots: ['lunch', 'dinner'],
    base_servings: 2,
    times_cooked: 7,
    ingredients: [
      { ingredient_id: 'ing_dal', qty_base: 150 },
      { ingredient_id: 'ing_chawal', qty_base: 180 },
      { ingredient_id: 'ing_oil', qty_base: 20 },
      { ingredient_id: 'ing_namak', qty_base: 6 },
      { ingredient_id: 'ing_tamatar', qty_base: 100 },
    ],
  },
  {
    id: 'rec_paneer_bhurji',
    title: 'Paneer Bhurji',
    category: 'regular',
    slots: ['lunch', 'dinner'],
    base_servings: 2,
    times_cooked: 2,
    ingredients: [
      { ingredient_id: 'ing_paneer', qty_base: 200 },
      { ingredient_id: 'ing_pyaz', qty_base: 100 },
      { ingredient_id: 'ing_tamatar', qty_base: 80 },
      { ingredient_id: 'ing_oil', qty_base: 25 },
      { ingredient_id: 'ing_namak', qty_base: 5 },
    ],
  },
  {
    id: 'rec_dahi_chawal',
    title: 'Dahi Chawal',
    category: 'regular',
    slots: ['lunch'],
    base_servings: 2,
    times_cooked: 4,
    ingredients: [
      { ingredient_id: 'ing_dahi', qty_base: 200 },
      { ingredient_id: 'ing_chawal', qty_base: 150 },
      { ingredient_id: 'ing_namak', qty_base: 3 },
    ],
  },
];

export function getMonday(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

const STORAGE_KEY = 'mastmeals_db_state_v1';

interface DBState {
  currentHouseholdId: string;
  currentUserId: string;
  users: Record<string, User>;
  households: Record<string, Household>;
  members: Record<string, HouseholdMember[]>;
  stock: Record<string, Record<string, StockItem>>; // householdId -> ingredientId -> StockItem
  recipes: Record<string, Recipe[]>; // householdId -> Recipe[]
  plans: Record<string, Record<string, MealPlan>>; // householdId -> weekStart -> MealPlan
  shoppingLists: Record<string, Record<string, ShoppingListItem[]>>; // householdId -> weekStart -> items
  pendingActions: Record<string, PendingAction>;
  auditLog: { id: string; householdId: string; action: string; meta: any; time: string }[];
  syncLog: { seq: number; table: string; id: string; op: string; time: string }[];
  syncSeq: number;
}

function initializeState(): DBState {
  const user1: User = {
    id: 'usr_alpha',
    email: 'alpha@local',
    name: 'Divyansh (Head Chef)',
    google_sub: 'dev:alpha@local',
    created_at: new Date().toISOString(),
  };

  const user2: User = {
    id: 'usr_beta',
    email: 'beta@local',
    name: 'Sharma Household',
    google_sub: 'dev:beta@local',
    created_at: new Date().toISOString(),
  };

  const hh1: Household = {
    id: 'hh_alpha',
    name: 'My Kitchen',
    has_fridge: true,
    language: 'hi',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const hh2: Household = {
    id: 'hh_beta',
    name: "Sharma's Kitchen",
    has_fridge: true,
    language: 'en',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const members1: HouseholdMember[] = [
    { id: 'mem_1', household_id: 'hh_alpha', age_group: 'adult', label: 'Papa', cautions: ['diabetes'] },
    { id: 'mem_2', household_id: 'hh_alpha', age_group: 'adult', label: 'Mummy', cautions: ['upset_stomach'] },
    { id: 'mem_3', household_id: 'hh_alpha', age_group: 'kid', label: 'Aarav', cautions: [] },
  ];

  const members2: HouseholdMember[] = [
    { id: 'mem_4', household_id: 'hh_beta', age_group: 'adult', label: 'Raj', cautions: ['heart'] },
    { id: 'mem_5', household_id: 'hh_beta', age_group: 'adult', label: 'Priya', cautions: [] },
  ];

  const seedStock1: Record<string, StockItem> = {
    ing_aloo: {
      id: 'stk_1',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_aloo',
      name: 'aloo',
      qty_base: 1200,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_atta: {
      id: 'stk_2',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_atta',
      name: 'atta',
      qty_base: 1500,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_dal: {
      id: 'stk_3',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_dal',
      name: 'dal',
      qty_base: 600,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_chawal: {
      id: 'stk_4',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_chawal',
      name: 'chawal',
      qty_base: 900,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_oil: {
      id: 'stk_5',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_oil',
      name: 'oil',
      qty_base: 400,
      unit_base: 'ml',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_namak: {
      id: 'stk_6',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_namak',
      name: 'namak',
      qty_base: 400,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
    ing_tamatar: {
      id: 'stk_7',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_tamatar',
      name: 'tamatar',
      qty_base: 300,
      unit_base: 'g',
      location: 'fridge',
      version: 1,
      is_estimate: false,
    },
  };

  const seedStock2: Record<string, StockItem> = {
    ing_chawal: {
      id: 'stk_b1',
      household_id: 'hh_beta',
      ingredient_id: 'ing_chawal',
      name: 'chawal',
      qty_base: 1000,
      unit_base: 'g',
      location: 'pantry',
      version: 1,
      is_estimate: false,
    },
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStart = getMonday();

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
        slot: 'lunch',
        household_recipe_id: 'rec_dal_chawal',
        title: 'Dal Chawal',
        servings: 2,
        status: 'planned',
        missing: [],
        nutrition: { kcal: 750, protein_g: 29, carbs_g: 147, fat_g: 21, sodium_mg: 2335 },
      },
    ],
  };

  return {
    currentHouseholdId: 'hh_alpha',
    currentUserId: 'usr_alpha',
    users: { usr_alpha: user1, usr_beta: user2 },
    households: { hh_alpha: hh1, hh_beta: hh2 },
    members: { hh_alpha: members1, hh_beta: members2 },
    stock: { hh_alpha: seedStock1, hh_beta: seedStock2 },
    recipes: {
      hh_alpha: JSON.parse(JSON.stringify(CANONICAL_RECIPES)),
      hh_beta: JSON.parse(JSON.stringify(CANONICAL_RECIPES)),
    },
    plans: {
      hh_alpha: { [weekStart]: planAlpha },
      hh_beta: {},
    },
    shoppingLists: {
      hh_alpha: {},
      hh_beta: {},
    },
    pendingActions: {},
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
      // Ignore storage errors
    }
  }

  public resetToDefaults() {
    this.state = initializeState();
    this.persist();
  }

  // --- Auth & Context ---
  public getMe() {
    const hh = this.state.households[this.state.currentHouseholdId] || {
      id: this.state.currentHouseholdId,
      name: 'My Kitchen',
      has_fridge: true,
      language: 'en',
      version: 1,
    };
    const user = this.state.users[this.state.currentUserId] || {
      id: this.state.currentUserId,
      name: 'Chef',
      email: 'app@local',
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

  public switchHousehold(hhId: string, userId?: string) {
    if (this.state.households[hhId]) {
      this.state.currentHouseholdId = hhId;
      if (userId && this.state.users[userId]) {
        this.state.currentUserId = userId;
      }
      this.persist();
    }
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

  public addMember(age_group: AgeGroup, label?: string, cautions: DietCaution[] = []) {
    const list = this.state.members[this.state.currentHouseholdId] || [];
    const newMember: HouseholdMember = {
      id: 'mem_' + Date.now(),
      household_id: this.state.currentHouseholdId,
      age_group,
      label,
      cautions,
    };
    list.push(newMember);
    this.state.members[this.state.currentHouseholdId] = list;
    this.persist();
    return newMember;
  }

  public deleteMember(memberId: string) {
    let list = this.state.members[this.state.currentHouseholdId] || [];
    list = list.filter((m) => m.id !== memberId);
    this.state.members[this.state.currentHouseholdId] = list;
    this.persist();
  }

  // --- Ingredients ---
  public getIngredients(): Ingredient[] {
    return CANONICAL_INGREDIENTS;
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

  // --- Recipes ---
  public getRecipes(): Recipe[] {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.recipes[hhId]) {
      this.state.recipes[hhId] = JSON.parse(JSON.stringify(CANONICAL_RECIPES));
      this.persist();
    }
    return this.state.recipes[hhId];
  }

  public getRecipeDetail(recipeId: string, servings = 2) {
    const recipes = this.getRecipes();
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) throw new Error('Recipe not found');

    const factor = servings / Math.max(recipe.base_servings || 2, 1);
    const stock = this.getStockMap();

    const scaledIngredients = recipe.ingredients.map((ri) => {
      const ing = this.getIngredientById(ri.ingredient_id);
      const qty_base = Math.round(ri.qty_base * factor * 10) / 10;
      const have_base = stock[ri.ingredient_id] || 0;
      return {
        ...ri,
        name: ing?.name_en || ri.ingredient_id,
        unit_base: ing?.base_unit || 'g',
        qty_base,
        have_base,
        enough: have_base >= qty_base - 1e-9,
      };
    });

    const missing = scaledIngredients
      .filter((i) => i.have_base < i.qty_base - 1e-9)
      .map((i) => ({
        ingredient_id: i.ingredient_id,
        name: i.name,
        unit_base: i.unit_base,
        qty_base: i.qty_base,
        have_base: i.have_base,
        short_base: Math.round((i.qty_base - i.have_base) * 10) / 10,
      }));

    // Nutrition calculation
    const nutrition: Record<string, number> = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 0 };
    scaledIngredients.forEach((si) => {
      const ing = this.getIngredientById(si.ingredient_id);
      if (ing) {
        nutrition.kcal += Math.round(((ing.nutrients_per_100.kcal || 0) * si.qty_base) / 100);
        nutrition.protein_g += Math.round(((ing.nutrients_per_100.protein_g || 0) * si.qty_base) / 100 * 10) / 10;
        nutrition.carbs_g += Math.round(((ing.nutrients_per_100.carbs_g || 0) * si.qty_base) / 100 * 10) / 10;
        nutrition.fat_g += Math.round(((ing.nutrients_per_100.fat_g || 0) * si.qty_base) / 100 * 10) / 10;
        nutrition.sodium_mg += Math.round(((ing.nutrients_per_100.sodium_mg || 0) * si.qty_base) / 100);
      }
    });

    return {
      ...recipe,
      servings,
      ingredients: scaledIngredients,
      missing,
      nutrition,
    };
  }

  // --- Stock ---
  public getStock(): StockItem[] {
    const hhId = this.state.currentHouseholdId;
    const stockMap = this.state.stock[hhId] || {};
    return Object.values(stockMap).sort((a, b) => a.name.localeCompare(b.name));
  }

  public getStockMap(): Record<string, number> {
    const items = this.getStock();
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.ingredient_id] = item.qty_base;
    }
    return map;
  }

  public adjustStock(ingredientId: string, op: StockOp, qty: number, reason = 'manual') {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.stock[hhId]) {
      this.state.stock[hhId] = {};
    }
    const ing = this.getIngredientById(ingredientId);
    if (!ing) throw new Error('Unknown ingredient');

    const current = this.state.stock[hhId][ingredientId];
    const before = current ? current.qty_base : 0;
    let after = before;

    if (op === 'add') {
      after = before + qty;
    } else if (op === 'remove') {
      after = Math.max(before - qty, 0);
    } else if (op === 'set') {
      after = qty;
    }

    if (current) {
      current.qty_base = Math.round(after * 10) / 10;
      current.version += 1;
    } else {
      this.state.stock[hhId][ingredientId] = {
        id: 'stk_' + Date.now(),
        household_id: hhId,
        ingredient_id: ingredientId,
        name: ing.name_en,
        qty_base: Math.round(after * 10) / 10,
        unit_base: ing.base_unit,
        location: ing.storage_place || 'pantry',
        version: 1,
        is_estimate: false,
      };
    }

    this.logAudit('stock_adjust', { ingredientId, op, qty, before, after, reason });
    this.persist();

    return {
      name: ing.name_en,
      unit_base: ing.base_unit,
      before,
      after,
      stock: this.getStock(),
    };
  }

  // --- Plan ---
  public getPlan(weekStart = getMonday()): MealPlan {
    const hhId = this.state.currentHouseholdId;
    if (!this.state.plans[hhId]) {
      this.state.plans[hhId] = {};
    }
    let plan = this.state.plans[hhId][weekStart];
    if (!plan) {
      plan = {
        id: 'plan_' + Date.now(),
        household_id: hhId,
        week_start: weekStart,
        version: 1,
        meals: [],
      };
      this.state.plans[hhId][weekStart] = plan;
      this.persist();
    }

    // Refresh shortages with current stock
    const stock = this.getStockMap();
    const updatedMeals = plan.meals.map((meal) => {
      const detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);
      return {
        ...meal,
        title: detail.title,
        missing: detail.missing,
        nutrition: detail.nutrition,
      };
    });

    plan.meals = updatedMeals;
    return plan;
  }

  public addMeal(mealDate: string, slot: MealSlot, householdRecipeId: string, servings = 2) {
    const weekStart = getMonday(new Date(mealDate));
    const plan = this.getPlan(weekStart);
    const detail = this.getRecipeDetail(householdRecipeId, servings);

    // Replace if meal in same slot & date
    plan.meals = plan.meals.filter((m) => !(m.meal_date === mealDate && m.slot === slot));

    const newMeal: PlannedMeal = {
      id: 'meal_' + Date.now(),
      plan_id: plan.id,
      meal_date: mealDate,
      slot,
      household_recipe_id: householdRecipeId,
      title: detail.title,
      servings,
      status: 'planned',
      missing: detail.missing,
      nutrition: detail.nutrition,
      updated_at: new Date().toISOString(),
    };

    plan.meals.push(newMeal);
    // Sort meals
    const slotOrder: Record<MealSlot, number> = { breakfast: 1, lunch: 2, dinner: 3 };
    plan.meals.sort((a, b) => {
      if (a.meal_date === b.meal_date) {
        return slotOrder[a.slot] - slotOrder[b.slot];
      }
      return a.meal_date.localeCompare(b.meal_date);
    });

    this.persist();
    return newMeal;
  }

  public markDone(mealId: string) {
    const plan = this.findMealPlanByMealId(mealId);
    if (!plan) throw new Error('Meal not found');
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) throw new Error('Meal not found');
    if (meal.status === 'done') throw new Error('Meal already done');

    // Deduct stock for all recipe ingredients
    const detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);
    const deductions: any[] = [];
    for (const req of detail.ingredients) {
      this.adjustStock(req.ingredient_id, 'remove', req.qty_base, 'meal_done');
      deductions.push({ name: req.name, qty: req.qty_base, unit: req.unit_base });
    }

    meal.status = 'done';
    meal.missing = [];

    // Increment times cooked on recipe
    const recipes = this.getRecipes();
    const recipe = recipes.find((r) => r.id === meal.household_recipe_id);
    if (recipe) {
      recipe.times_cooked = (recipe.times_cooked || 0) + 1;
    }

    this.logAudit('meal_done', { mealId, deductions });
    this.persist();

    return { meal, deducted: deductions, stock: this.getStock() };
  }

  public markSkip(mealId: string) {
    const plan = this.findMealPlanByMealId(mealId);
    if (!plan) throw new Error('Meal not found');
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) throw new Error('Meal not found');

    meal.status = 'skipped';
    this.logAudit('meal_skipped', { mealId });
    this.persist();
    return meal;
  }

  private findMealPlanByMealId(mealId: string): MealPlan | undefined {
    const hhId = this.state.currentHouseholdId;
    const plans = this.state.plans[hhId] || {};
    for (const p of Object.values(plans)) {
      if (p.meals.some((m) => m.id === mealId)) return p;
    }
    return undefined;
  }

  // --- Plan Check & Shopping List ---
  public planCheck(weekStart = getMonday()) {
    const plan = this.getPlan(weekStart);
    const stock = this.getStockMap();

    const requirements: Record<string, { ingredient_id: string; name: string; unit_base: string; required_base: number }> = {};

    for (const meal of plan.meals) {
      if (meal.status !== 'planned' || !meal.household_recipe_id) continue;
      const detail = this.getRecipeDetail(meal.household_recipe_id, meal.servings);
      for (const req of detail.ingredients) {
        if (!requirements[req.ingredient_id]) {
          requirements[req.ingredient_id] = {
            ingredient_id: req.ingredient_id,
            name: req.name || req.ingredient_id,
            unit_base: req.unit_base || 'g',
            required_base: 0,
          };
        }
        requirements[req.ingredient_id].required_base += req.qty_base;
      }
    }

    const missing: { ingredient_id: string; name: string; unit_base: string; required_base: number; have_base: number; short_base: number }[] = [];

    for (const ingId of Object.keys(requirements)) {
      const item = requirements[ingId];
      const have = stock[ingId] || 0;
      const short = Math.max(item.required_base - have, 0);
      if (short > 0) {
        missing.push({
          ...item,
          have_base: have,
          short_base: Math.round(short * 10) / 10,
        });
      }
    }

    return {
      week_start: weekStart,
      meals: plan.meals,
      missing,
    };
  }

  public generateShoppingList(weekStart = getMonday()): ShoppingListItem[] {
    const check = this.planCheck(weekStart);
    const hhId = this.state.currentHouseholdId;
    if (!this.state.shoppingLists[hhId]) {
      this.state.shoppingLists[hhId] = {};
    }

    // Price estimates per 100g/100ml for Indian grocery platforms
    const priceRates: Record<string, number> = {
      ing_aloo: 3.5, // ~35/kg
      ing_atta: 4.5, // ~45/kg
      ing_dahi: 6.0, // ~60/400g
      ing_chawal: 8.0, // ~80/kg
      ing_dal: 16.0, // ~160/kg
      ing_oil: 18.0, // ~180/L
      ing_namak: 2.5,
      ing_pyaz: 4.0, // ~40/kg
      ing_tamatar: 5.0, // ~50/kg
      ing_paneer: 38.0, // ~76/200g
      ing_doodh: 6.8, // ~34/500ml
      ing_jeera: 45.0, // ~45/100g
    };

    const stores: ('Blinkit' | 'Zepto' | 'Swiggy Instamart')[] = ['Blinkit', 'Zepto', 'Swiggy Instamart'];

    const items: ShoppingListItem[] = check.missing.map((item, idx) => {
      const rate = priceRates[item.ingredient_id] || 10;
      const price = Math.round((item.short_base / 100) * rate);
      const store = stores[idx % stores.length];

      return {
        id: 'shop_' + item.ingredient_id,
        ingredient_id: item.ingredient_id,
        name: item.name,
        qty_base: item.short_base,
        base_unit: item.unit_base,
        in_swiggy_cart: false,
        estimated_price: Math.max(price, 15),
        best_store: store,
        as_of: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    this.state.shoppingLists[hhId][weekStart] = items;
    this.persist();
    return items;
  }

  public getShoppingList(weekStart = getMonday()): ShoppingListItem[] {
    const hhId = this.state.currentHouseholdId;
    const lists = this.state.shoppingLists[hhId] || {};
    return lists[weekStart] || [];
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
        const res = this.adjustStock(item.ingredient_id, item.op, item.qty_base, 'proposal_confirm');
        applied.push(res);
      }
    }

    // 2. Plan changes
    for (const change of payload.plan_changes || []) {
      if (change.household_recipe_id) {
        const res = this.addMeal(
          change.meal_date,
          change.slot,
          change.household_recipe_id,
          change.servings || 2
        );
        applied.push({ plan_added: res });
      }
    }

    // 3. New Recipe
    if (payload.recipe && payload.recipe.title) {
      const hhId = this.state.currentHouseholdId;
      const recipes = this.getRecipes();
      const newRec: Recipe = {
        id: 'rec_' + Date.now(),
        household_id: hhId,
        title: payload.recipe.title,
        category: 'irregular',
        slots: ['lunch', 'dinner'],
        base_servings: payload.recipe.base_servings || 2,
        times_cooked: 0,
        ingredients: (payload.recipe.ingredients || []).map((i) => ({
          ingredient_id: i.ingredient_id,
          qty_base: i.qty_base,
        })),
      };
      recipes.push(newRec);
      applied.push({ recipe_added: newRec.title });
    }

    action.status = 'confirmed';
    this.logAudit('proposal_confirmed', { proposalId, intent: action.intent, applied });
    this.persist();

    return {
      applied,
      stock: this.getStock(),
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
