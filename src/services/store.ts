import { flattenState, applyDoc, SyncScope } from './syncSchema';
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
  SwiggyAccountConnection,
  RegistrationProfileData,
  MenuItem,
  CloudOrder,
  CookBatch,
  StockReservation,
  StockLedgerEntry,
  WastageEntry,
  Supplier,
  PurchaseList,
  PurchaseListItem,
  CloudKitchenReport,
  CloudKitchenRole,
  OrderStatus,
  OrderSource,
  PaymentStatus,
  CloudOrderItem,
  CommunityPost,
} from '../types';
import seedData from '../data/graph_rag_seed.json';
import {
  getDefaultMenuItems,
  getDefaultSuppliers,
  getDefaultOrders,
  calculatePortionsFeasibility,
  canPerformCloudAction,
  deriveDietTag,
  normalizeToBaseUnit,
} from './cloudKitchenService';

const SWIGGY_CONN_KEY = 'mastmeals_swiggy_conn_v1';

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
  menuItems: Record<string, MenuItem[]>;
  orders: Record<string, CloudOrder[]>;
  batches: Record<string, CookBatch[]>;
  stockReservations: Record<string, StockReservation[]>;
  stockLedger: Record<string, StockLedgerEntry[]>;
  wastage: Record<string, WastageEntry[]>;
  suppliers: Record<string, Supplier[]>;
  purchaseLists: Record<string, PurchaseList[]>;
  cloudRole: Record<string, CloudKitchenRole>;
  pureVegOnly: Record<string, boolean>;
  communityPosts: CommunityPost[];
}

export function getDefaultCommunityPosts(): CommunityPost[] {
  return [
    {
      id: 'post_seed_1',
      household_id: 'hh_alpha',
      author_id: 'usr_beta',
      author_name: 'Rohan Verma',
      author_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      caption: 'Cooked fresh Paneer Bhurji with hot tawa rotis for dinner tonight! Used fresh malai paneer from the kitchen stock and finished with roasted kasuri methi & extra green chillies. Turned out super soft and protein-packed! 🔥🍛',
      image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800&auto=format&fit=crop&q=80',
      recipe_id: 'rec_paneer_01',
      recipe_title: 'High-Protein Paneer Bhurji & Roti',
      recipe_prep_time_mins: 20,
      recipe_diet_tag: 'veg',
      likes_count: 14,
      liked_by_me: true,
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: 'post_seed_2',
      household_id: 'hh_alpha',
      author_id: 'usr_alpha',
      author_name: 'Divyansh (Head Chef)',
      author_avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      caption: 'Sunday special Hyderabadi Dum Biryani batch cooked in copper handi! Layered with aromatic basmati, saffron infused milk, fried golden onions (birista) and desi ghee. Followed the recipe yield ratio from the planner!',
      image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
      recipe_id: 'rec_biryani_01',
      recipe_title: 'Vegetable Dum Biryani',
      recipe_prep_time_mins: 45,
      recipe_diet_tag: 'veg',
      likes_count: 29,
      liked_by_me: false,
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: 'post_seed_3',
      household_id: 'hh_alpha',
      author_id: 'usr_sneha',
      author_name: 'Sneha Patel',
      author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      caption: 'Comfort food at its absolute best: Lasooni Palak Moong Dal with hot jeera rice. Added double garlic tadka with a dash of hing in pure cow ghee. Light, nutritious and comforting.',
      image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
      recipe_id: 'rec_palak_dal_01',
      recipe_title: 'Lasooni Palak Moong Dal',
      recipe_prep_time_mins: 25,
      recipe_diet_tag: 'veg',
      likes_count: 8,
      liked_by_me: false,
      created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    },
    {
      id: 'post_seed_4',
      household_id: 'hh_alpha',
      author_id: 'usr_aman',
      author_name: 'Aman Gupta',
      author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      caption: 'Quick 15-minute Kanda Poha before heading to work! Roasted peanuts with crunchy mustard seeds and fresh curry leaves. Simple homestyle Indian breakfast!',
      image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
      recipe_id: 'rec_poha_01',
      recipe_title: 'Kanda Poha (कांदा पोहा)',
      recipe_prep_time_mins: 15,
      recipe_diet_tag: 'veg',
      likes_count: 21,
      liked_by_me: true,
      created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    },
  ];
}

function initializeState(): DBState {
  const user1: User = {
    id: 'usr_alpha',
    email: 'divyansh@local',
    name: 'Divyansh (Head Chef)',
    diet_pref: 'veg',
    is_beginner_cook: true,
    password: 'password123',
    household_id: 'hh_alpha',
    onboarding_completed: true,
    google_sub: 'dev:divyansh@local',
    created_at: new Date().toISOString(),
  };

  const user2: User = {
    id: 'usr_beta',
    email: 'rohan@local',
    name: 'Rohan',
    diet_pref: 'nonveg',
    is_beginner_cook: false,
    password: 'password123',
    household_id: 'hh_alpha',
    onboarding_completed: true,
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
      qty_base: 3500,
      unit_base: 'ml',
      location: 'fridge',
      owner_user_id: null, // Shared
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 7,
      is_non_veg: false,
      expiry: 'In 5 days',
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
      name: 'Daawat Basmati Rice',
      name_hi: 'दावत बासमती चावल',
      qty_base: 12000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Kitchen Store',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 90,
      is_non_veg: false,
    },
    stk_paneer_bulk: {
      id: 'stk_paneer_bulk',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_paneer',
      name: 'Fresh Malai Paneer',
      name_hi: 'ताज़ा मलाई पनीर',
      qty_base: 4500,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 4,
      is_non_veg: false,
    },
    stk_pyaz: {
      id: 'stk_pyaz',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_pyaz',
      name: 'Nashik Red Onions',
      name_hi: 'लाल प्याज',
      qty_base: 8000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Sabzi Mandi',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 21,
      is_non_veg: false,
    },
    stk_urad_dal: {
      id: 'stk_urad_dal',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_urad_dal',
      name: 'Black Urad Dal (Makhani)',
      name_hi: 'उड़द साबुत काली दाल',
      qty_base: 5000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Shrinath Grains',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 120,
      is_non_veg: false,
    },
    stk_chana: {
      id: 'stk_chana',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_chana',
      name: 'Amritsari Kabuli Chana',
      name_hi: 'काबुली चना',
      qty_base: 4000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Shrinath Grains',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 120,
      is_non_veg: false,
    },
    stk_butter: {
      id: 'stk_butter',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_butter',
      name: 'Amul Table Butter',
      name_hi: 'अमूल मक्खन',
      qty_base: 3000,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 60,
      is_non_veg: false,
    },
    stk_cream: {
      id: 'stk_cream',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_cream',
      name: 'Amul Fresh Heavy Cream',
      name_hi: 'अमूल फ्रेश क्रीम',
      qty_base: 2500,
      unit_base: 'ml',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 14,
      is_non_veg: false,
    },
    stk_ghee: {
      id: 'stk_ghee',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_ghee',
      name: 'Shuddh Desi Cow Ghee',
      name_hi: 'शुद्ध देसी घी',
      qty_base: 2500,
      unit_base: 'ml',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 180,
      is_non_veg: false,
    },
    stk_maida: {
      id: 'stk_maida',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_maida',
      name: 'Shakti Bhog Maida',
      name_hi: 'मैदा',
      qty_base: 5000,
      unit_base: 'g',
      location: 'pantry',
      owner_user_id: null,
      contributed_by: 'Shrinath Grains',
      version: 1,
      storage_place: 'pantry',
      shelf_life_days: 90,
      is_non_veg: false,
    },
    stk_khoya: {
      id: 'stk_khoya',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_khoya',
      name: 'Hariyali Dhaap Khoya (Mawa)',
      name_hi: 'मावा / खोया',
      qty_base: 2000,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Krishna Dairy',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 7,
      is_non_veg: false,
    },
    stk_chicken: {
      id: 'stk_chicken',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_chicken',
      name: 'Boneless Fresh Chicken Breast/Thigh',
      name_hi: 'ताज़ा बोनलेस चिकन',
      qty_base: 2500,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Meat Fresh Daily',
      version: 1,
      storage_place: 'fridge',
      shelf_life_days: 2,
      is_non_veg: true,
    },
    stk_oil: {
      id: 'stk_oil',
      household_id: 'hh_alpha',
      ingredient_id: 'ing_oil',
      name: 'Fortune Sunflower Oil',
      name_hi: 'रिफाइंड तेल',
      qty_base: 5000,
      unit_base: 'ml',
      location: 'pantry',
      owner_user_id: null,
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
      qty_base: 3500,
      unit_base: 'g',
      location: 'fridge',
      owner_user_id: null,
      contributed_by: 'Sabzi Mandi',
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
    menuItems: {
      hh_alpha: getDefaultMenuItems('hh_alpha'),
    },
    orders: {
      hh_alpha: getDefaultOrders('hh_alpha'),
    },
    batches: {
      hh_alpha: [
        {
          id: 'batch_seed_1',
          household_id: 'hh_alpha',
          menu_item_id: 'menu_dum_biryani',
          item_name: 'Hyderabadi Dum Biryani (Veg)',
          portions_announced: 20,
          portions_cooked: 20,
          portions_remaining: 8,
          status: 'ready',
          announced_by: 'Chef Divyansh',
          ingredients_deducted: [
            { ingredient_id: 'ing_chawal', name: 'Basmati Rice', qty: 2400, unit: 'g' },
            { ingredient_id: 'ing_paneer', name: 'Fresh Paneer', qty: 1400, unit: 'g' },
          ],
          started_at: new Date(Date.now() - 3 * 3600000).toISOString(),
          completed_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        },
      ],
    },
    stockReservations: {
      hh_alpha: [],
    },
    stockLedger: {
      hh_alpha: [
        {
          id: 'led_1',
          household_id: 'hh_alpha',
          timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
          ingredient_id: 'ing_chawal',
          ingredient_name: 'Basmati Rice',
          change_qty: -2400,
          unit: 'g',
          balance_after: 12000,
          reason: 'batch_cook',
          linked_batch_id: 'batch_seed_1',
          performed_by: 'Chef Divyansh',
          notes: 'Batch of Veg Dum Biryani (20 portions)',
        },
      ],
    },
    wastage: {
      hh_alpha: [
        {
          id: 'w_1',
          household_id: 'hh_alpha',
          ingredient_id: 'ing_tamatar',
          ingredient_name: 'Desi Tamatar',
          qty: 250,
          unit: 'g',
          reason: 'spoilage',
          cost_inr: 15,
          logged_by: 'Chef Divyansh',
          notes: 'Soft tomatoes discarded during sorting',
          created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        },
      ],
    },
    suppliers: {
      hh_alpha: getDefaultSuppliers('hh_alpha'),
    },
    purchaseLists: {
      hh_alpha: [],
    },
    cloudRole: {
      hh_alpha: 'owner',
    },
    pureVegOnly: {
      hh_alpha: false,
    },
    communityPosts: getDefaultCommunityPosts(),
  };
}

class StoreService {
  private state: DBState;
  private isExplicitlyLoggedOut = false;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DBState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.menuItems) parsed.menuItems = {};
        if (!parsed.orders) parsed.orders = {};
        if (!parsed.batches) parsed.batches = {};
        if (!parsed.stockReservations) parsed.stockReservations = {};
        if (!parsed.stockLedger) parsed.stockLedger = {};
        if (!parsed.wastage) parsed.wastage = {};
        if (!parsed.suppliers) parsed.suppliers = {};
        if (!parsed.purchaseLists) parsed.purchaseLists = {};
        if (!parsed.cloudRole) parsed.cloudRole = {};
        if (!parsed.pureVegOnly) parsed.pureVegOnly = {};
        if (!parsed.communityPosts || parsed.communityPosts.length === 0) {
          parsed.communityPosts = getDefaultCommunityPosts();
        }

        const hhId = parsed.currentHouseholdId || 'hh_alpha';
        if (!parsed.menuItems[hhId] || parsed.menuItems[hhId].length === 0) {
          parsed.menuItems[hhId] = getDefaultMenuItems(hhId);
        }
        if (!parsed.suppliers[hhId] || parsed.suppliers[hhId].length === 0) {
          parsed.suppliers[hhId] = getDefaultSuppliers(hhId);
        }
        if (!parsed.orders[hhId] || parsed.orders[hhId].length === 0) {
          parsed.orders[hhId] = getDefaultOrders(hhId);
        }
        if (!parsed.cloudRole[hhId]) {
          parsed.cloudRole[hhId] = 'owner';
        }
        return parsed;
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
    this.notifySync();
  }

  // --- Cross-device sync hooks (the sync loop lives in syncClient.ts) ---
  private persistListener: (() => void) | null = null;
  private muteSync = false;

  public setPersistListener(fn: (() => void) | null) {
    this.persistListener = fn;
  }

  private notifySync() {
    if (!this.muteSync && this.persistListener) this.persistListener();
  }

  public getSyncScope(): SyncScope {
    const userId = this.state.currentUserId;
    const ids = [this.state.currentHouseholdId, this.state.users[userId]?.household_id].filter(Boolean) as string[];
    return { userId, householdIds: Array.from(new Set(ids)) };
  }

  /** All syncable documents of this device (flat key -> JSON value). */
  public getSyncDocs(): Record<string, any> {
    const docs = flattenState(this.state);
    try {
      const raw = localStorage.getItem(DIET_MEMORY_KEY);
      if (raw) docs[`dietMemory/${this.state.currentUserId}`] = JSON.parse(raw);
    } catch {
      // ignore
    }
    return docs;
  }

  /** Apply documents received from the server (value null = deleted). Does not trigger a push. */
  public applySyncDocs(changes: { key: string; value: any }[]) {
    this.muteSync = true;
    try {
      for (const { key, value } of changes) {
        if (key.startsWith('dietMemory/')) {
          const uid = key.slice('dietMemory/'.length);
          try {
            if (value === null) localStorage.removeItem(`mastmeals_diet_memory_${uid}`);
            else {
              localStorage.setItem(`mastmeals_diet_memory_${uid}`, JSON.stringify(value));
              if (uid === this.state.currentUserId) localStorage.setItem(DIET_MEMORY_KEY, JSON.stringify(value));
            }
          } catch {
            // ignore
          }
        } else {
          applyDoc(this.state, key, value);
        }
      }
      this.persist();
    } finally {
      this.muteSync = false;
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
      // Sync primary household member
      const members = this.state.members[this.state.currentHouseholdId] || [];
      if (members[0]) {
        members[0].diet_pref = diet_pref;
      }
      this.revalidateMealsForDiet(diet_pref);
      this.persist();
    }
    return this.getMe();
  }

  // --- Onboarding & Auth Gate ---
  public isOnboardingComplete(): boolean {
    const user = this.state.users[this.state.currentUserId];
    return !!user && user.onboarding_completed === true;
  }

  public isLoggedIn(): boolean {
    if (this.isExplicitlyLoggedOut) {
      return false;
    }
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('mastmeals_auth_session_v1') === 'logged_out') {
        return false;
      }
    } catch {
      // Ignore
    }
    const user = this.state.users[this.state.currentUserId];
    return Boolean(user && user.onboarding_completed);
  }

  public logout(): void {
    this.isExplicitlyLoggedOut = true;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('mastmeals_auth_session_v1', 'logged_out');
      }
    } catch {
      // Ignore
    }
  }

  public login(identifier: string, password?: string): { success: boolean; error?: string; user?: User } {
    const norm = identifier.trim().toLowerCase();
    const user = Object.values(this.state.users).find((u) => {
      const tail = (v: string) => { const d = v.replace(/[^0-9]/g, ''); return d.length >= 7 ? d.slice(-10) : ''; };
      const normDigits = /^[+\d][\d\s\-()+]*$/.test(norm) ? tail(norm) : '';
      const emailMatch = u.email && (u.email.toLowerCase() === norm ||
        (!!normDigits && /@mobile\.mastmeals$/i.test(u.email) && tail(u.email.split('@')[0]) === normDigits));
      const phoneMatch = u.phone && (u.phone.toLowerCase() === norm || (!!normDigits && tail(u.phone) === normDigits));
      const nameMatch = u.name && u.name.toLowerCase() === norm;
      const idMatch = u.id && u.id.toLowerCase() === norm;
      return emailMatch || phoneMatch || nameMatch || idMatch;
    });

    if (!user) {
      return {
        success: false,
        error: 'No account found with this email or mobile. Please register your account below.',
      };
    }

    if (password && user.password && user.password !== password) {
      return {
        success: false,
        error: 'Incorrect password. Please verify and try again.',
      };
    }

    this.isExplicitlyLoggedOut = false;
    this.state.currentUserId = user.id;
    try {
      const mem = localStorage.getItem(`mastmeals_diet_memory_${user.id}`);
      if (mem) localStorage.setItem(DIET_MEMORY_KEY, mem);
    } catch {
      // ignore
    }
    if (user.household_id && this.state.households[user.household_id]) {
      this.state.currentHouseholdId = user.household_id;
    } else {
      const hhEntry = Object.entries(this.state.members).find(([_, mems]) =>
        mems.some((m) => m.name === user.name)
      );
      if (hhEntry) {
        this.state.currentHouseholdId = hhEntry[0];
      }
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mastmeals_auth_session_v1');
      }
    } catch {}

    this.persist();
    return { success: true, user };
  }

  public loginWithDemoUser(userId: string): { success: boolean; user?: User } {
    const user = this.state.users[userId];
    if (!user) return { success: false };
    this.isExplicitlyLoggedOut = false;
    this.state.currentUserId = userId;
    if (user.household_id && this.state.households[user.household_id]) {
      this.state.currentHouseholdId = user.household_id;
    }
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mastmeals_auth_session_v1');
      }
    } catch {}
    this.persist();
    return { success: true, user };
  }

  public getAllRegisteredUsers(): Array<{ id: string; name: string; email: string; diet_pref: DietPreference; householdName: string }> {
    return Object.values(this.state.users).map((u) => {
      const hh = this.state.households[u.household_id || ''] || this.state.households[this.state.currentHouseholdId];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        diet_pref: u.diet_pref,
        householdName: hh?.name || 'Default Kitchen',
      };
    });
  }

  public registerWithFullProfile(data: RegistrationProfileData): { success: boolean; user: User } {
    const userId = 'usr_' + Date.now();
    const hhId = 'hh_' + Date.now();
    const isEmail = data.emailOrPhone.includes('@');

    // 1. Create User
    const newUser: User = {
      id: userId,
      email: isEmail
        ? data.emailOrPhone.trim().toLowerCase()
        : `${data.emailOrPhone.trim().replace(/[^0-9]/g, '')}@mobile.mastmeals`,
      phone: !isEmail ? data.emailOrPhone.trim() : undefined,
      password: data.password || 'password123',
      name: data.name.trim(),
      diet_pref: data.diet_pref,
      is_beginner_cook: data.is_beginner_cook,
      household_id: hhId,
      onboarding_completed: true,
      created_at: new Date().toISOString(),
    };
    this.state.users[userId] = newUser;

    // 2. Create Household with equipment & fridge
    const newHousehold: Household = {
      id: hhId,
      name: data.householdName.trim() || `${data.name}'s Kitchen`,
      household_type: data.householdType || 'bachelor_flat',
      has_fridge: data.has_fridge,
      equipment: data.equipment.length > 0 ? data.equipment : ['stove', 'pressure_cooker', 'kadhai_pan', 'tawa'],
      language: 'en',
      version: 1,
      invite_code: 'IN-' + Math.floor(100 + Math.random() * 900),
      updated_at: new Date().toISOString(),
    };
    this.state.households[hhId] = newHousehold;

    // 3. Create HouseholdMember with weight & protein goal
    const weight = data.weight_kg || 65;
    const proteinFactor = data.diet_goals.includes('protein_rich') ? 1.2 : 0.9;
    const proteinTarget = data.protein_target_g || Math.round(weight * proteinFactor);

    const primaryMember: HouseholdMember = {
      id: 'mem_' + Date.now(),
      household_id: hhId,
      name: (data.member_name || data.name).trim(),
      age_group: data.age_group || 'adult',
      diet_pref: data.diet_pref,
      weight_kg: weight,
      protein_target_g: proteinTarget,
      cautions: data.cautions || [],
    };
    this.state.members[hhId] = [primaryMember];

    // 4. Save UserDietMemory
    const userDietMemory: UserDietMemory = {
      user_id: userId,
      diet_goals: data.diet_goals,
      preferred_regions: data.preferred_regions.length > 0 ? data.preferred_regions : ['North Indian'],
      weekly_variety_schedule: data.weekly_variety_schedule,
      past_regular_dishes: (data.regular_dishes && data.regular_dishes.length > 0)
        ? data.regular_dishes.map((d, idx) => ({
            recipe_id: `rec_custom_${idx}_${Date.now()}`,
            title: d.title,
            cuisine: d.cuisine || 'North Indian',
            course: d.course || 'Dinner',
            ingredients: d.ingredients || ['dal', 'chawal', 'tamatar'],
            times_eaten: 8,
            weeks_active: 4,
            last_eaten_date: new Date().toISOString().slice(0, 10),
            is_regular_favorite: true,
          }))
        : createDefaultDietMemory(userId).past_regular_dishes,
      common_ingredients: ['dal', 'atta', 'chawal', 'aloo', 'tamatar', 'pyaz', 'jeera', 'haldi'],
      common_regions: data.preferred_regions,
      weeks_tracked: 4,
      updated_at: new Date().toISOString(),
    };
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mastmeals_diet_memory_${userId}`, JSON.stringify(userDietMemory));
        localStorage.setItem(DIET_MEMORY_KEY, JSON.stringify(userDietMemory));
      }
    } catch {}

    // 5. Seed kitchen stock
    const seedStock: Record<string, StockItem> = {
      [`stk_${Date.now()}_1`]: {
        id: `stk_${Date.now()}_1`,
        household_id: hhId,
        ingredient_id: 'ing_atta',
        name: 'Whole Wheat Atta',
        name_hi: 'आशीर्वाद गेहूं आटा',
        qty_base: 4000,
        unit_base: 'g',
        location: 'pantry',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'pantry',
        shelf_life_days: 60,
        is_non_veg: false,
      },
      [`stk_${Date.now()}_2`]: {
        id: `stk_${Date.now()}_2`,
        household_id: hhId,
        ingredient_id: 'ing_dal',
        name: 'Toor Dal (Yellow Lentils)',
        name_hi: 'अरहर दाल',
        qty_base: 1500,
        unit_base: 'g',
        location: 'pantry',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'pantry',
        shelf_life_days: 90,
        is_non_veg: false,
      },
      [`stk_${Date.now()}_3`]: {
        id: `stk_${Date.now()}_3`,
        household_id: hhId,
        ingredient_id: 'ing_chawal',
        name: 'Basmati Rice',
        name_hi: 'बासमती चावल',
        qty_base: 2500,
        unit_base: 'g',
        location: 'pantry',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'pantry',
        shelf_life_days: 90,
        is_non_veg: false,
      },
      [`stk_${Date.now()}_4`]: {
        id: `stk_${Date.now()}_4`,
        household_id: hhId,
        ingredient_id: 'ing_aloo',
        name: 'Potatoes (Aloo)',
        name_hi: 'आलू',
        qty_base: 2000,
        unit_base: 'g',
        location: 'pantry',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'pantry',
        shelf_life_days: 30,
        is_non_veg: false,
      },
      [`stk_${Date.now()}_5`]: {
        id: `stk_${Date.now()}_5`,
        household_id: hhId,
        ingredient_id: 'ing_pyaz',
        name: 'Onions (Pyaz)',
        name_hi: 'प्याज',
        qty_base: 2000,
        unit_base: 'g',
        location: 'pantry',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'pantry',
        shelf_life_days: 30,
        is_non_veg: false,
      },
    };

    if (data.has_fridge) {
      seedStock[`stk_${Date.now()}_6`] = {
        id: `stk_${Date.now()}_6`,
        household_id: hhId,
        ingredient_id: 'ing_tamatar',
        name: 'Fresh Tomatoes',
        name_hi: 'ताज़ा टमाटर',
        qty_base: 1000,
        unit_base: 'g',
        location: 'fridge',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'fridge',
        shelf_life_days: 7,
        is_non_veg: false,
      };
      seedStock[`stk_${Date.now()}_7`] = {
        id: `stk_${Date.now()}_7`,
        household_id: hhId,
        ingredient_id: 'ing_dahi',
        name: 'Fresh Dahi / Curd',
        name_hi: 'अमूल ताज़ा दही',
        qty_base: 500,
        unit_base: 'ml',
        location: 'fridge',
        owner_user_id: null,
        contributed_by: `${data.name} (Shared)`,
        version: 1,
        storage_place: 'fridge',
        shelf_life_days: 5,
        is_non_veg: false,
      };
      if (data.diet_pref === 'veg') {
        seedStock[`stk_${Date.now()}_8`] = {
          id: `stk_${Date.now()}_8`,
          household_id: hhId,
          ingredient_id: 'ing_paneer',
          name: 'Malai Paneer',
          name_hi: 'ताज़ा मलाई पनीर',
          qty_base: 400,
          unit_base: 'g',
          location: 'fridge',
          owner_user_id: null,
          contributed_by: `${data.name} (Shared)`,
          version: 1,
          storage_place: 'fridge',
          shelf_life_days: 4,
          is_non_veg: false,
        };
      } else {
        seedStock[`stk_${Date.now()}_8`] = {
          id: `stk_${Date.now()}_8`,
          household_id: hhId,
          ingredient_id: 'ing_anda',
          name: 'Farm Fresh Eggs',
          name_hi: 'अंडे (Eggs)',
          qty_base: 6,
          unit_base: 'pcs',
          location: 'fridge',
          owner_user_id: null,
          contributed_by: `${data.name} (Shared)`,
          version: 1,
          storage_place: 'fridge',
          shelf_life_days: 14,
          is_non_veg: true,
        };
      }
    }

    this.state.stock[hhId] = seedStock;
    this.state.recipes[hhId] = (this.state.recipes['hh_alpha'] || []).map((r) => ({
      ...r,
      household_id: hhId,
    }));

    // 6. Set context & clear logged out state
    this.isExplicitlyLoggedOut = false;
    this.state.currentUserId = userId;
    this.state.currentHouseholdId = hhId;

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mastmeals_auth_session_v1');
      }
    } catch {}

    this.revalidateMealsForDiet(data.diet_pref);
    this.persist();
    return { success: true, user: newUser };
  }

  public completeOnboarding(diet_pref: DietPreference, is_beginner_cook: boolean) {
    const user = this.state.users[this.state.currentUserId];
    if (user) {
      user.diet_pref = diet_pref;
      user.is_beginner_cook = is_beginner_cook;
      user.onboarding_completed = true;
      const members = this.state.members[this.state.currentHouseholdId] || [];
      if (members[0]) {
        members[0].diet_pref = diet_pref;
      }
      this.revalidateMealsForDiet(diet_pref);
      this.persist();
    }
    return this.getMe();
  }

  public revalidateMealsForDiet(newDietPref: DietPreference): { flaggedMeals: string[] } {
    const hhId = this.state.currentHouseholdId;
    const allPlans = this.state.plans[hhId] || {};
    const flaggedMeals: string[] = [];
    const nonVegKws = [
      'chicken', 'mutton', 'fish', 'egg', 'eggs', 'meat', 'prawn', 'prawns',
      'beef', 'pork', 'bacon', 'gelatin', 'murgh', 'machli', 'keema', 'gosht',
      'shrimp', 'crab'
    ];
    const isNonVegText = (txt?: string | null) =>
      nonVegKws.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(txt || ''));

    if (newDietPref === 'veg') {
      for (const wk of Object.keys(allPlans)) {
        const plan = allPlans[wk];
        if (!plan) continue;
        for (const meal of plan.meals) {
          if (meal.status === 'planned') {
            if (isNonVegText(meal.title) || isNonVegText(meal.household_recipe_id)) {
              (meal as any).diet_warning = 'Non-veg meal conflicts with current vegetarian diet preference';
              if (meal.title) flaggedMeals.push(meal.title);
            } else if ((meal as any).diet_warning) {
              delete (meal as any).diet_warning;
            }
          }
        }
      }
    }
    return { flaggedMeals };
  }

  // --- Household Invite Codes & Multi-User Join (Spec 2.1) ---
  public getHouseholdInviteCode(): string {
    const hh = this.state.households[this.state.currentHouseholdId];
    if (hh && !hh.invite_code) {
      hh.invite_code = 'BLR-402';
      this.persist();
    }
    return hh?.invite_code || 'BLR-402';
  }

  public regenerateInviteCode(): string {
    const hh = this.state.households[this.state.currentHouseholdId];
    if (hh) {
      hh.invite_code = 'SYNC-' + Math.floor(100 + Math.random() * 900);
      this.persist();
      return hh.invite_code;
    }
    return 'SYNC-101';
  }

  public joinHouseholdWithCode(code: string): { success: boolean; message: string; householdName?: string } {
    const clean = code.trim().toUpperCase();
    if (!clean) return { success: false, message: 'Please enter a valid invite code' };

    for (const [id, hh] of Object.entries(this.state.households)) {
      if (hh.invite_code && hh.invite_code.toUpperCase() === clean) {
        this.state.currentHouseholdId = id;
        this.persist();
        return {
          success: true,
          message: `Joined ${hh.name}!`,
          householdName: hh.name,
        };
      }
    }

    // Provision household for this invite code
    const newHhId = 'hh_' + clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newHh: Household = {
      id: newHhId,
      name: `Flat (${clean})`,
      household_type: 'bachelor_flat',
      has_fridge: true,
      equipment: ['stove', 'kadhai_pan', 'tawa', 'kettle'],
      language: 'hi',
      version: 1,
      invite_code: clean,
      updated_at: new Date().toISOString(),
    };
    this.state.households[newHhId] = newHh;
    if (!this.state.members[newHhId]) {
      this.state.members[newHhId] = [
        {
          id: 'mem_' + Date.now(),
          household_id: newHhId,
          name: this.state.users[this.state.currentUserId]?.name || 'Diner',
          age_group: 'adult',
          diet_pref: this.state.users[this.state.currentUserId]?.diet_pref || 'veg',
          weight_kg: 68,
          protein_target_g: 65,
          cautions: [],
        },
      ];
    }
    this.state.currentHouseholdId = newHhId;
    this.persist();
    return {
      success: true,
      message: `Joined household (${clean})!`,
      householdName: newHh.name,
    };
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
    this.notifySync();
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
      expiry?: string | null;
      shelf_life_days?: number;
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

    // 1. Locate item: first by options.stockId, then check expiry matching
    let item: StockItem | undefined = undefined;
    const normalizeExp = (exp?: string | null) => (exp ? exp.trim().toLowerCase() : '');
    const incomingExp = options?.expiry !== undefined ? options.expiry : undefined;

    if (options?.stockId) {
      const targetItem = items.find((i) => i.id === options.stockId);
      if (targetItem) {
        // If restocking with an explicitly different expiry, treat as a DISTINCT entity!
        if (
          incomingExp !== undefined &&
          op === 'add' &&
          normalizeExp(incomingExp) !== normalizeExp(targetItem.expiry)
        ) {
          // Check if an entity already exists with this exact target expiry
          const existingSameExp = items.find(
            (i) =>
              (i.ingredient_id === targetItem.ingredient_id || i.name.toLowerCase() === targetItem.name.toLowerCase()) &&
              i.owner_user_id === targetOwner &&
              normalizeExp(i.expiry) === normalizeExp(incomingExp)
          );
          if (existingSameExp) {
            item = existingSameExp;
          } else {
            // Create a brand new distinct batch entity
            const newId = 'stk_' + targetItem.ingredient_id.replace(/^ing_/, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const loc = options?.location || targetItem.storage_place || (targetItem.location as any) || 'pantry';
            item = {
              id: newId,
              household_id: hhId,
              ingredient_id: targetItem.ingredient_id,
              name: options?.name || targetItem.name,
              name_hi: options?.name_hi || targetItem.name_hi,
              qty_base: 0,
              unit_base: options?.unit || targetItem.unit_base,
              location: loc,
              storage_place: loc,
              owner_user_id: targetOwner,
              contributed_by: targetOwner ? 'Personal' : 'Shared',
              version: 1,
              shelf_life_days: options?.shelf_life_days ?? targetItem.shelf_life_days,
              expiry: incomingExp,
              is_non_veg: targetItem.is_non_veg,
            };
            this.state.stock[hhId][newId] = item;
          }
        } else {
          item = targetItem;
        }
      }
    }

    if (!item && incomingExp !== undefined) {
      // Find item with matching ingredient and SAME expiry
      item = items.find(
        (i) =>
          (i.ingredient_id === ingredientId || i.id === ingredientId || this.doesItemMatch(ingredientId, options?.name || '', i.ingredient_id, i.name)) &&
          i.owner_user_id === targetOwner &&
          normalizeExp(i.expiry) === normalizeExp(incomingExp)
      );
    }

    if (!item) {
      item = this.findMatchingStockItem(options?.name || ingredientId) || undefined;
      // If we found a matching item but incoming has a different expiry on add, don't merge
      if (
        item &&
        incomingExp !== undefined &&
        op === 'add' &&
        normalizeExp(item.expiry) !== normalizeExp(incomingExp)
      ) {
        item = undefined; // trigger creation of distinct entity below
      }
    }

    if (!item) {
      item = items.find(
        (i) =>
          (i.ingredient_id === ingredientId || i.id === ingredientId) &&
          (i.owner_user_id === targetOwner || items.length === 1) &&
          (incomingExp === undefined || normalizeExp(i.expiry) === normalizeExp(incomingExp))
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
      if (options?.shelf_life_days !== undefined) item.shelf_life_days = options.shelf_life_days;
      if (incomingExp !== undefined && normalizeExp(item.expiry) === normalizeExp(incomingExp)) {
        item.expiry = incomingExp;
      }
      item.version += 1;
    } else {
      const id = 'stk_' + ingredientId.replace(/^ing_/, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
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
        contributed_by: targetOwner ? 'Personal' : 'Shared',
        version: 1,
        storage_place: loc,
        shelf_life_days: options?.shelf_life_days ?? (loc === 'fridge' ? 7 : 45),
        expiry: incomingExp || null,
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
            as_of: 'Est. market benchmark',
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

  public restockItem(params: {
    stockId?: string;
    ingredientId: string;
    qty: number;
    name?: string;
    name_hi?: string;
    unit?: BaseUnit;
    expiry?: string | null;
    targetScope?: 'personal' | 'shared';
    location?: 'pantry' | 'fridge';
  }) {
    const targetScope = params.targetScope || 'shared';
    return this.adjustStock(
      params.ingredientId,
      'add',
      params.qty,
      targetScope,
      'inline_restock',
      {
        stockId: params.stockId,
        name: params.name,
        name_hi: params.name_hi,
        unit: params.unit,
        location: params.location,
        targetScope,
        expiry: params.expiry,
      }
    );
  }

  public removeStockItem(stockId: string): boolean {
    const hhId = this.state.currentHouseholdId;
    if (this.state.stock[hhId] && this.state.stock[hhId][stockId]) {
      const removedName = this.state.stock[hhId][stockId].name;
      delete this.state.stock[hhId][stockId];
      this.logAudit('stock_item_removed', { stockId, name: removedName });
      this.syncPlansAndShoppingWithStock();
      this.persist();
      return true;
    }
    return false;
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

    const user = this.state.users[this.state.currentUserId];
    const isVegUser = user?.diet_pref === 'veg';
    const nonVegKws = [
      'chicken', 'mutton', 'fish', 'egg', 'eggs', 'meat', 'prawn', 'prawns',
      'beef', 'pork', 'bacon', 'gelatin', 'murgh', 'machli', 'keema', 'gosht',
      'shrimp', 'crab', 'ham', 'sausage'
    ];
    const isAddingNonVeg = nonVegKws.some((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(ingredientNameOrId)
    );
    if (isVegUser && isAddingNonVeg && op !== 'remove') {
      throw new Error(`Dietary safety violation: Cannot add non-vegetarian ingredient "${ingredientNameOrId}" to a vegetarian recipe.`);
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
            } else if (
              !existingIsSeed &&
              !canonicalPlan.meals.some(
                (cm) =>
                  cm.meal_date === fixedDate &&
                  cm.slot === updatedMeal.slot &&
                  cm.household_recipe_id === updatedMeal.household_recipe_id
              )
            ) {
              canonicalPlan.meals.push(updatedMeal);
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
        const mapKey = `${m.meal_date}_${m.slot}_${m.household_recipe_id}`;
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
      // Drop placeholder seed meals when a real meal exists in the same slot
      const deduped = Array.from(slotMap.values()).filter((m) => {
        const isSeed = ['meal_1', 'meal_2', 'meal_3'].includes(m.id);
        if (!isSeed) return true;
        return !Array.from(slotMap.values()).some(
          (o) => o.id !== m.id && o.meal_date === m.meal_date && o.slot === m.slot && !['meal_1', 'meal_2', 'meal_3'].includes(o.id)
        );
      });
      if (deduped.length !== canonicalPlan.meals.length) {
        canonicalPlan.meals = deduped;
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
    },
    opts?: { append?: boolean; replaceMealId?: string }
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

    let existingIdx: number;
    if (opts?.replaceMealId) {
      existingIdx = plan.meals.findIndex((m) => m.id === opts.replaceMealId);
    } else if (opts?.append) {
      // Multi-item meal: keep what is already in the slot; only skip an exact duplicate recipe
      existingIdx = -1;
      const dup = plan.meals.find(
        (m) => m.meal_date === mealDate && m.slot === slot && m.household_recipe_id === recipeId
      );
      if (dup) return dup;
    } else {
      existingIdx = plan.meals.findIndex((m) => m.meal_date === mealDate && m.slot === slot);
    }

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

    // Automatic stock deduction: shared first, then personal (FEFO - Earliest expiry batch first)
    const parseExpirySortKey = (exp?: string | null): number => {
      if (!exp) return Infinity;
      const matchDays = exp.match(/(\d+)\s*day/i);
      if (matchDays) {
        return Date.now() + parseInt(matchDays[1], 10) * 86400000;
      }
      const timestamp = Date.parse(exp);
      if (!isNaN(timestamp)) return timestamp;
      return Infinity;
    };

    const deductions: string[] = [];
    for (const req of detail.ingredients) {
      let needed = req.qty_base;

      // Try shared stock first, sorted by earliest expiry
      const sharedItems = this.getStock('shared')
        .filter(
          (i) => i.qty_base > 0 && (i.ingredient_id === req.ingredient_id || i.name.toLowerCase() === req.name.toLowerCase())
        )
        .sort((a, b) => parseExpirySortKey(a.expiry) - parseExpirySortKey(b.expiry));

      for (const st of sharedItems) {
        if (needed <= 0) break;
        const take = Math.min(st.qty_base, needed);
        st.qty_base = Math.max(0, Math.round((st.qty_base - take) * 10) / 10);
        needed = Math.round((needed - take) * 10) / 10;
        const expLabel = st.expiry ? ` (${st.expiry})` : '';
        deductions.push(`${take} ${st.unit_base} ${st.name}${expLabel} (Shared)`);
      }

      // If still needed, deduct from personal stock, sorted by earliest expiry
      if (needed > 0) {
        const personalItems = this.getStock('mine')
          .filter(
            (i) => i.qty_base > 0 && (i.ingredient_id === req.ingredient_id || i.name.toLowerCase() === req.name.toLowerCase())
          )
          .sort((a, b) => parseExpirySortKey(a.expiry) - parseExpirySortKey(b.expiry));

        for (const pt of personalItems) {
          if (needed <= 0) break;
          const take = Math.min(pt.qty_base, needed);
          pt.qty_base = Math.max(0, Math.round((pt.qty_base - take) * 10) / 10);
          needed = Math.round((needed - take) * 10) / 10;
          const expLabel = pt.expiry ? ` (${pt.expiry})` : '';
          deductions.push(`${take} ${pt.unit_base} ${pt.name}${expLabel} (Personal)`);
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
        as_of: 'Est. market benchmark',
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

    // --- Manual protein quick-add ---
  public addManualProteinLog(memberId: string, grams: number): IntakeLog | null {
    const g = Math.round(grams);
    if (!Number.isFinite(g) || g <= 0 || g > 200) return null;
    if (!Array.isArray(this.state.intakeLogs)) this.state.intakeLogs = [];
    const log: IntakeLog = {
      id: 'intake_manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      member_id: memberId,
      date: getTodayStr(),
      protein_g: g,
      source: 'manual',
    };
    this.state.intakeLogs.push(log);
    this.logAudit('protein_manual_logged', { memberId, protein_g: g });
    this.persist();
    return log;
  }

  public getManualProteinToday(memberId: string): number {
    const todayStr = getTodayStr();
    return (this.state.intakeLogs || [])
      .filter((l) => l.member_id === memberId && l.date === todayStr && l.source === 'manual')
      .reduce((sum, l) => sum + l.protein_g, 0);
  }

  public getLastManualProteinLogToday(memberId: string): IntakeLog | null {
    const todayStr = getTodayStr();
    const logs = (this.state.intakeLogs || []).filter(
      (l) => l.member_id === memberId && l.date === todayStr && l.source === 'manual'
    );
    return logs.length > 0 ? logs[logs.length - 1] : null;
  }

  public removeLastManualProteinLog(memberId: string): IntakeLog | null {
    const last = this.getLastManualProteinLogToday(memberId);
    if (!last) return null;
    this.state.intakeLogs = this.state.intakeLogs.filter((l) => l.id !== last.id);
    this.logAudit('protein_manual_removed', { memberId, protein_g: last.protein_g });
    this.persist();
    return last;
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

    // 1. Expiry check
    if (action.expires_at && Date.now() > action.expires_at) {
      action.status = 'expired';
      this.persist();
      throw new Error('Proposal has expired (valid for 20 minutes). Please generate a fresh proposal.');
    }

    // 2. Household isolation check
    if (action.household_id !== this.state.currentHouseholdId) {
      throw new Error('Access denied: Proposal belongs to a different household.');
    }

    const applied: any[] = [];
    const payload = action.payload;

    // 3. Strict dietary safety verification
    const user = this.state.users[this.state.currentUserId];
    const isVegHousehold = user?.diet_pref === 'veg';
    const nonVegKws = [
      'chicken', 'mutton', 'fish', 'egg', 'eggs', 'meat', 'prawn', 'prawns',
      'beef', 'pork', 'bacon', 'gelatin', 'murgh', 'machli', 'keema', 'gosht',
      'shrimp', 'crab', 'ham', 'sausage'
    ];
    const isNonVegText = (txt?: string | null) =>
      nonVegKws.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(txt || ''));

    if (isVegHousehold) {
      for (const item of payload.items || []) {
        if (isNonVegText(item.name) || isNonVegText(item.ingredient_id)) {
          throw new Error(`Dietary safety violation: Cannot add non-vegetarian item "${item.name}" to vegetarian household.`);
        }
      }
      for (const change of payload.plan_changes || []) {
        if (isNonVegText(change.recipe_title) || isNonVegText(change.household_recipe_id)) {
          throw new Error(`Dietary safety violation: Cannot add non-vegetarian dish "${change.recipe_title || 'unnamed'}" to vegetarian meal plan.`);
        }
      }
      if (payload.recipe_modification && payload.recipe_modification.op !== 'remove') {
        if (isNonVegText(payload.recipe_modification.ingredient_name)) {
          throw new Error(`Dietary safety violation: Cannot add non-vegetarian ingredient "${payload.recipe_modification.ingredient_name}" to recipe.`);
        }
      }
    }

    // 4. Quantity and schema validation
    for (const item of payload.items || []) {
      if (typeof item.qty_base !== 'number' || item.qty_base < 0) {
        throw new Error(`Invalid quantity for item "${item.name}". Must be a non-negative number.`);
      }
    }

    // 0. "Bought everything missing": move the whole Shop Tab into stock in one confirmed step
    if (payload.restock_all_missing) {
      const restock = this.restockAllMissingItems();
      applied.push({ restocked: restock.appliedItems || [] });
    }

    // 1. Stock changes (apply for update_stock as well as any confirmed item list)
    for (const item of payload.restock_all_missing ? [] : payload.items || []) {
      // Shop Tab edits proposed from chat (add / remove / mark bought) go to the shopping list, not stock
      if (item.target_section === 'Shop Tab') {
        const shopOp = ['add', 'remove', 'set', 'bought'].includes(String(item.note))
          ? (item.note as any)
          : item.op === 'remove'
          ? 'remove'
          : 'add';
        const shopRes = this.updateShoppingListFromChat(
          item.name || item.ingredient_id,
          shopOp,
          item.qty_base,
          item.unit_base
        );
        applied.push({ shop_list: shopRes });
        continue;
      }
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

  // --- Swiggy Instamart Account Connection & Cart Sync ---
  public getSwiggyConnection(): SwiggyAccountConnection {
    try {
      const saved = localStorage.getItem(SWIGGY_CONN_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      isConnected: false,
    };
  }

  public saveSwiggyConnection(conn: SwiggyAccountConnection): void {
    try {
      localStorage.setItem(SWIGGY_CONN_KEY, JSON.stringify(conn));
      this.logAudit('swiggy_connection_saved', { isConnected: conn.isConnected, user: conn.userProfile?.name });
    } catch (e) {
      console.error('Failed to save Swiggy connection to storage:', e);
    }
  }

  public disconnectSwiggy(): void {
    try {
      localStorage.removeItem(SWIGGY_CONN_KEY);
      this.logAudit('swiggy_disconnected', {});
    } catch (e) {
      console.error('Failed to clear Swiggy connection from storage:', e);
    }
  }

  public markItemsInSwiggyCart(itemIds: string[], cartId?: string): void {
    const hhId = this.state.currentHouseholdId;
    const shoppingLists = this.state.shoppingLists[hhId] || {};
    let changed = false;

    for (const weekKey of Object.keys(shoppingLists)) {
      const list = shoppingLists[weekKey] || [];
      for (const item of list) {
        if (itemIds.includes(item.id) || itemIds.includes(item.name)) {
          item.in_swiggy_cart = true;
          changed = true;
        }
      }
    }

    if (changed) {
      this.logAudit('swiggy_cart_items_marked', { itemIds, cartId });
      this.persist();
    }
  }

  // =========================================================================
  // Food Business Management Methods
  // =========================================================================

  public getCloudKitchenRole(householdId = this.state.currentHouseholdId): CloudKitchenRole {
    return this.state.cloudRole?.[householdId] || 'owner';
  }

  public setCloudKitchenRole(role: CloudKitchenRole, householdId = this.state.currentHouseholdId): void {
    if (!this.state.cloudRole) this.state.cloudRole = {};
    this.state.cloudRole[householdId] = role;
    this.logAudit('cloud_role_changed', { householdId, role });
    this.persist();
  }

  public isPureVegOnly(householdId = this.state.currentHouseholdId): boolean {
    return Boolean(this.state.pureVegOnly?.[householdId]);
  }

  public setPureVegOnly(enabled: boolean, householdId = this.state.currentHouseholdId): void {
    if (!this.state.pureVegOnly) this.state.pureVegOnly = {};
    this.state.pureVegOnly[householdId] = enabled;
    this.logAudit('cloud_pure_veg_toggled', { householdId, enabled });
    this.persist();
  }

  public getMenuItems(householdId = this.state.currentHouseholdId): MenuItem[] {
    const list = this.state.menuItems?.[householdId] || [];
    const isPureVeg = this.isPureVegOnly(householdId);
    const stockItems = this.getStock();

    return list
      .filter((item) => {
        if (!isPureVeg) return true;
        // Strictly filter out any item that has nonveg diet_tag or meat ingredients
        if (item.diet_tag === 'nonveg') return false;
        return true;
      })
      .map((item) => {
        // Calculate dynamic food cost from ingredients
        const calculatedCost = item.ingredients.reduce(
          (sum, ing) => sum + (ing.cost_estimate_inr || 0),
          0
        );
        // Compute portion feasibility
        const feasibility = calculatePortionsFeasibility(item, 1, stockItems);
        return {
          ...item,
          cost_inr: calculatedCost > 0 ? calculatedCost : item.cost_inr,
          // Auto sold out when stock cannot cover even 1 portion
          is_sold_out: !feasibility.canCook && (item.cook_method === 'to_order' || (item.cooked_portions_available || 0) <= 0),
        } as MenuItem & { is_sold_out?: boolean };
      });
  }

  public addOrUpdateMenuItem(item: MenuItem, householdId = this.state.currentHouseholdId): MenuItem {
    const currentRole = this.getCloudKitchenRole(householdId);
    if (currentRole !== 'owner') {
      throw new Error('Only the kitchen Owner can create or modify menu items and prices.');
    }

    if (!this.state.menuItems) this.state.menuItems = {};
    if (!this.state.menuItems[householdId]) this.state.menuItems[householdId] = [];

    // Derive diet tag deterministically in code from ingredients
    const { tag, hasConflict, conflictReason } = deriveDietTag(item.ingredients);
    const cleanItem: MenuItem = {
      ...item,
      household_id: householdId,
      diet_tag: tag,
      updated_at: new Date().toISOString(),
    };

    if (this.isPureVegOnly(householdId) && tag === 'nonveg') {
      throw new Error('Cannot add non-veg items while Pure Veg Kitchen mode is enabled.');
    }

    const idx = this.state.menuItems[householdId].findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      this.state.menuItems[householdId][idx] = cleanItem;
    } else {
      cleanItem.id = cleanItem.id || 'menu_' + Date.now();
      cleanItem.created_at = new Date().toISOString();
      this.state.menuItems[householdId].push(cleanItem);
    }

    this.logAudit('menu_item_saved', { id: cleanItem.id, name: cleanItem.name, diet_tag: tag, hasConflict });
    this.persist();
    return cleanItem;
  }

  public deleteMenuItem(itemId: string, householdId = this.state.currentHouseholdId): void {
    const currentRole = this.getCloudKitchenRole(householdId);
    if (currentRole !== 'owner') {
      throw new Error('Only the kitchen Owner can delete menu items.');
    }
    if (!this.state.menuItems?.[householdId]) return;
    this.state.menuItems[householdId] = this.state.menuItems[householdId].filter((m) => m.id !== itemId);
    this.logAudit('menu_item_deleted', { itemId });
    this.persist();
  }

  public toggleMenuItemAvailability(itemId: string, isAvailable: boolean, householdId = this.state.currentHouseholdId): void {
    const list = this.state.menuItems?.[householdId] || [];
    const item = list.find((m) => m.id === itemId);
    if (item) {
      item.is_available = isAvailable;
      item.updated_at = new Date().toISOString();
      this.logAudit('menu_availability_toggled', { itemId, isAvailable });
      this.persist();
    }
  }

  public getCloudOrders(householdId = this.state.currentHouseholdId): CloudOrder[] {
    return this.state.orders?.[householdId] || [];
  }

  public createCloudOrder(
    data: {
      customer_name: string;
      customer_phone?: string;
      items: { menu_item_id: string; quantity: number; variant_name?: string; unit_price_inr?: number; notes?: string }[];
      source?: OrderSource;
      notes?: string;
      scheduled_time?: string;
      payment_status?: PaymentStatus;
    },
    householdId = this.state.currentHouseholdId
  ): CloudOrder {
    if (!this.state.orders) this.state.orders = {};
    if (!this.state.orders[householdId]) this.state.orders[householdId] = [];

    const menuItems = this.getMenuItems(householdId);
    const existingOrders = this.state.orders[householdId];
    const nextOrderNum = existingOrders.length > 0 ? Math.max(...existingOrders.map((o) => o.order_number)) + 1 : 101;

    let totalAmount = 0;
    const orderItems: CloudOrderItem[] = [];
    const reservationIds: string[] = [];

    for (const raw of data.items) {
      const menuItem = menuItems.find((m) => m.id === raw.menu_item_id);
      if (!menuItem) continue;

      const price = raw.unit_price_inr ?? menuItem.price_inr;
      const itemTotal = price * raw.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        item_id: 'oi_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        menu_item_id: menuItem.id,
        name: menuItem.name,
        variant_name: raw.variant_name,
        quantity: raw.quantity,
        unit_price_inr: price,
        total_price_inr: itemTotal,
        notes: raw.notes,
      });

      // Handle Reservation for Cook-to-Order vs Batch items
      if (menuItem.cook_method === 'to_order') {
        for (const ing of menuItem.ingredients) {
          if (ing.is_pinch_or_taste) continue;
          const resId = 'res_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          const reservation: StockReservation = {
            id: resId,
            household_id: householdId,
            order_id: 'ord_' + nextOrderNum,
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.name,
            qty_reserved: ing.qty_per_portion * raw.quantity,
            unit: ing.unit,
            status: 'active',
            created_at: new Date().toISOString(),
          };
          if (!this.state.stockReservations) this.state.stockReservations = {};
          if (!this.state.stockReservations[householdId]) this.state.stockReservations[householdId] = [];
          this.state.stockReservations[householdId].push(reservation);
          reservationIds.push(resId);
        }
      } else if (menuItem.cook_method === 'batch') {
        // Decrement from cooked portions available pool
        const currentPool = menuItem.cooked_portions_available || 0;
        menuItem.cooked_portions_available = Math.max(0, currentPool - raw.quantity);
      }
    }

    const newOrder: CloudOrder = {
      id: 'ord_' + nextOrderNum,
      household_id: householdId,
      order_number: nextOrderNum,
      customer_name: data.customer_name || 'Walk-in Guest',
      customer_phone: data.customer_phone || '',
      items: orderItems,
      total_amount_inr: totalAmount,
      source: data.source || 'walk_in',
      notes: data.notes || '',
      scheduled_time: data.scheduled_time || 'Immediate Prep',
      status: 'new',
      payment_status: data.payment_status || 'pending',
      reserved_stock_ids: reservationIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.state.orders[householdId].unshift(newOrder);
    this.logAudit('cloud_order_created', { orderNumber: nextOrderNum, totalAmount, itemsCount: orderItems.length });
    this.persist();
    return newOrder;
  }

  public updateCloudOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    overrideReason?: string,
    householdId = this.state.currentHouseholdId
  ): { success: boolean; message?: string } {
    const orders = this.state.orders?.[householdId] || [];
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    const oldStatus = order.status;
    if (oldStatus === nextStatus) return { success: true };

    const role = this.getCloudKitchenRole(householdId);
    const userMe = this.getMe();
    const performer = userMe.user.name || role.toUpperCase();

    // 1. Moving to PREPARING or READY: DEDUCT stock from reservations
    if ((nextStatus === 'preparing' || nextStatus === 'ready') && oldStatus !== 'preparing' && oldStatus !== 'ready') {
      const reservations = this.state.stockReservations?.[householdId] || [];
      const orderRes = reservations.filter((r) => r.order_id === order.id && r.status === 'active');

      const stockMap = this.state.stock[householdId] || {};

      for (const res of orderRes) {
        // Deduct across matching stock items (multi-lot deduction)
        const matchingStocks = Object.values(stockMap).filter((s) => s.ingredient_id === res.ingredient_id);
        if (matchingStocks.length > 0) {
          const qtyToDeduct = res.qty_reserved;
          let remainingToDeduct = qtyToDeduct;

          for (const stockItem of matchingStocks) {
            if (remainingToDeduct <= 0) break;
            const deductFromThis = Math.min(stockItem.qty_base, remainingToDeduct);
            stockItem.qty_base -= deductFromThis;
            remainingToDeduct -= deductFromThis;
          }

          if (remainingToDeduct > 0) {
            matchingStocks[0].qty_base = Math.max(0, matchingStocks[0].qty_base - remainingToDeduct);
          }

          const balanceAfter = matchingStocks.reduce((sum, s) => sum + s.qty_base, 0);
          res.status = 'deducted';

          // Write to Stock Audit Ledger
          this.logStockLedgerEntry({
            household_id: householdId,
            timestamp: new Date().toISOString(),
            ingredient_id: res.ingredient_id,
            ingredient_name: res.ingredient_name,
            change_qty: -qtyToDeduct,
            unit: res.unit,
            balance_after: balanceAfter,
            reason: 'order_prep',
            linked_order_id: order.id,
            performed_by: performer,
            notes: `KOT Order #${order.order_number} (${order.customer_name})`,
          });
        }
      }
    }

    // 2. CANCELLED: Release active reservations and restore batch portions
    if (nextStatus === 'cancelled') {
      const reservations = this.state.stockReservations?.[householdId] || [];
      const orderRes = reservations.filter((r) => r.order_id === order.id);

      for (const res of orderRes) {
        if (res.status === 'active') {
          res.status = 'released';
        } else if (res.status === 'deducted') {
          // Restore stock if it was already deducted!
          const stockMap = this.state.stock[householdId] || {};
          const matchingStocks = Object.values(stockMap).filter((s) => s.ingredient_id === res.ingredient_id);
          if (matchingStocks.length > 0) {
            matchingStocks[0].qty_base += res.qty_reserved;
            res.status = 'released';
            const balanceAfter = matchingStocks.reduce((sum, s) => sum + s.qty_base, 0);
            this.logStockLedgerEntry({
              household_id: householdId,
              timestamp: new Date().toISOString(),
              ingredient_id: res.ingredient_id,
              ingredient_name: res.ingredient_name,
              change_qty: res.qty_reserved,
              unit: res.unit,
              balance_after: balanceAfter,
              reason: 'cancellation_restore',
              linked_order_id: order.id,
              performed_by: performer,
              notes: `Order #${order.order_number} cancelled - inventory restored`,
            });
          }
        }
      }

      // Restore batch item cooked portions pool
      const menuList = this.state.menuItems?.[householdId] || [];
      for (const item of order.items) {
        const menuItem = menuList.find((m) => m.id === item.menu_item_id);
        if (menuItem && menuItem.cook_method === 'batch') {
          menuItem.cooked_portions_available = (menuItem.cooked_portions_available || 0) + item.quantity;
        }
      }
    }

    order.status = nextStatus;
    order.updated_at = new Date().toISOString();
    this.logAudit('cloud_order_status_updated', { orderId, oldStatus, nextStatus });
    this.persist();
    return { success: true };
  }

  public getBatches(householdId = this.state.currentHouseholdId): CookBatch[] {
    return this.state.batches?.[householdId] || [];
  }

  public announceBatch(
    menuItemId: string,
    portions: number,
    allowNegativeOverride = false,
    overrideReason?: string,
    householdId = this.state.currentHouseholdId
  ): { success: boolean; batch?: CookBatch; shortages?: any[]; error?: string } {
    const menuList = this.state.menuItems?.[householdId] || [];
    const menuItem = menuList.find((m) => m.id === menuItemId);
    if (!menuItem) return { success: false, error: 'Menu item not found' };

    const stockMap = this.state.stock[householdId] || {};
    const feasibility = calculatePortionsFeasibility(menuItem, portions, stockMap);

    if (!feasibility.canCook && !allowNegativeOverride) {
      return {
        success: false,
        shortages: feasibility.shortages,
        error: `Insufficient stock for ${portions} portions of ${menuItem.name}`,
      };
    }

    const userMe = this.getMe();
    const performer = userMe.user.name || 'Chef Divyansh';
    const deductedList: { ingredient_id: string; name: string; qty: number; unit: BaseUnit }[] = [];

    // Deduct stock for each ingredient scaled to portions across matching lots
    for (const ing of menuItem.ingredients) {
      if (ing.is_pinch_or_taste) continue;
      const totalNeeded = ing.qty_per_portion * portions;
      const matchingStockItems = Object.values(stockMap).filter(
        (s) => s.ingredient_id === ing.ingredient_id || s.name.toLowerCase().includes(ing.name.toLowerCase())
      );

      if (matchingStockItems.length > 0) {
        let remainingToDeduct = totalNeeded;
        for (const stockItem of matchingStockItems) {
          if (remainingToDeduct <= 0) break;
          const deductFromThis = Math.min(stockItem.qty_base, remainingToDeduct);
          stockItem.qty_base -= deductFromThis;
          remainingToDeduct -= deductFromThis;
        }

        if (remainingToDeduct > 0) {
          matchingStockItems[0].qty_base = Math.max(0, matchingStockItems[0].qty_base - remainingToDeduct);
        }

        const balanceAfter = matchingStockItems.reduce((sum, s) => sum + s.qty_base, 0);

        deductedList.push({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          qty: totalNeeded,
          unit: ing.unit,
        });

        // Write to Stock Audit Ledger
        this.logStockLedgerEntry({
          household_id: householdId,
          timestamp: new Date().toISOString(),
          ingredient_id: ing.ingredient_id,
          ingredient_name: ing.name,
          change_qty: -totalNeeded,
          unit: ing.unit,
          balance_after: balanceAfter,
          reason: 'batch_cook',
          performed_by: performer,
          notes: `Batch Cook: ${portions} portions of ${menuItem.name}`,
        });
      }
    }

    // Add to CookBatch and increment cooked portions pool
    const batchId = 'batch_' + Date.now();
    const newBatch: CookBatch = {
      id: batchId,
      household_id: householdId,
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      portions_announced: portions,
      portions_cooked: portions,
      portions_remaining: portions,
      status: 'ready',
      announced_by: performer,
      ingredients_deducted: deductedList,
      notes: overrideReason ? `Override reason: ${overrideReason}` : undefined,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    if (!this.state.batches) this.state.batches = {};
    if (!this.state.batches[householdId]) this.state.batches[householdId] = [];
    this.state.batches[householdId].unshift(newBatch);

    // Update menuItem cooked portions available pool
    menuItem.cooked_portions_available = (menuItem.cooked_portions_available || 0) + portions;

    this.logAudit('cloud_batch_announced', { batchId, menuItem: menuItem.name, portions });
    this.persist();
    return { success: true, batch: newBatch };
  }

  public completeBatch(batchId: string, householdId = this.state.currentHouseholdId): void {
    const batches = this.state.batches?.[householdId] || [];
    const b = batches.find((item) => item.id === batchId);
    if (b) {
      b.status = 'ready';
      b.completed_at = new Date().toISOString();
      this.persist();
    }
  }

  public getStockReservations(householdId = this.state.currentHouseholdId): StockReservation[] {
    return this.state.stockReservations?.[householdId] || [];
  }

  public getStockLedger(householdId = this.state.currentHouseholdId): StockLedgerEntry[] {
    return this.state.stockLedger?.[householdId] || [];
  }

  private logStockLedgerEntry(entry: Omit<StockLedgerEntry, 'id'>): void {
    const hhId = entry.household_id;
    if (!this.state.stockLedger) this.state.stockLedger = {};
    if (!this.state.stockLedger[hhId]) this.state.stockLedger[hhId] = [];

    const fullEntry: StockLedgerEntry = {
      ...entry,
      id: 'led_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    };
    this.state.stockLedger[hhId].unshift(fullEntry);
  }

  public getWastageEntries(householdId = this.state.currentHouseholdId): WastageEntry[] {
    return this.state.wastage?.[householdId] || [];
  }

  public logWastage(
    ingredientId: string,
    qty: number,
    unit: BaseUnit,
    reason: WastageEntry['reason'],
    costInr: number,
    notes?: string,
    householdId = this.state.currentHouseholdId
  ): WastageEntry {
    const stockMap = this.state.stock[householdId] || {};
    const stockItem = Object.values(stockMap).find((s) => s.ingredient_id === ingredientId);

    const userMe = this.getMe();
    const performer = userMe.user.name || 'Chef';

    if (stockItem) {
      stockItem.qty_base = Math.max(0, stockItem.qty_base - qty);
      this.logStockLedgerEntry({
        household_id: householdId,
        timestamp: new Date().toISOString(),
        ingredient_id: ingredientId,
        ingredient_name: stockItem.name,
        change_qty: -qty,
        unit,
        balance_after: stockItem.qty_base,
        reason: 'spoilage',
        performed_by: performer,
        notes: `Wastage logged (${reason}): ${notes || ''}`,
      });
    }

    const entry: WastageEntry = {
      id: 'w_' + Date.now(),
      household_id: householdId,
      ingredient_id: ingredientId,
      ingredient_name: stockItem ? stockItem.name : ingredientId,
      qty,
      unit,
      reason,
      cost_inr: costInr,
      logged_by: performer,
      notes,
      created_at: new Date().toISOString(),
    };

    if (!this.state.wastage) this.state.wastage = {};
    if (!this.state.wastage[householdId]) this.state.wastage[householdId] = [];
    this.state.wastage[householdId].unshift(entry);

    this.logAudit('wastage_logged', { ingredientId, qty, reason, costInr });
    this.persist();
    return entry;
  }

  public getSuppliers(householdId = this.state.currentHouseholdId): Supplier[] {
    if (!this.state.suppliers) this.state.suppliers = {};
    if (!this.state.suppliers[householdId] || this.state.suppliers[householdId].length === 0) {
      this.state.suppliers[householdId] = getDefaultSuppliers(householdId);
      this.persist();
    }
    return this.state.suppliers[householdId];
  }

  public addSupplier(
    data: Omit<Supplier, 'id' | 'household_id' | 'created_at' | 'updated_at'>,
    householdId = this.state.currentHouseholdId
  ): Supplier {
    if (!this.state.suppliers) this.state.suppliers = {};
    if (!this.state.suppliers[householdId]) {
      this.state.suppliers[householdId] = getDefaultSuppliers(householdId);
    }

    const newSupplier: Supplier = {
      id: 'sup_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      household_id: householdId,
      name: data.name.trim(),
      category: data.category.trim() || 'General Food & Provisions',
      phone: data.phone.trim(),
      contact_person: data.contact_person?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      lead_time_hours: Number(data.lead_time_hours) || 2,
      preferred_brands: Array.isArray(data.preferred_brands) ? data.preferred_brands : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.state.suppliers[householdId].push(newSupplier);
    this.logAudit('supplier_added', { supplierId: newSupplier.id, name: newSupplier.name });
    this.persist();
    return newSupplier;
  }

  public updateSupplier(
    supplierId: string,
    updates: Partial<Omit<Supplier, 'id' | 'household_id'>>,
    householdId = this.state.currentHouseholdId
  ): { success: boolean; supplier?: Supplier; message?: string } {
    if (!this.state.suppliers || !this.state.suppliers[householdId]) {
      return { success: false, message: 'Supplier not found' };
    }

    const supplier = this.state.suppliers[householdId].find((s) => s.id === supplierId);
    if (!supplier) {
      return { success: false, message: 'Supplier not found' };
    }

    if (updates.name !== undefined) supplier.name = updates.name.trim();
    if (updates.category !== undefined) supplier.category = updates.category.trim();
    if (updates.phone !== undefined) supplier.phone = updates.phone.trim();
    if (updates.contact_person !== undefined) supplier.contact_person = updates.contact_person?.trim();
    if (updates.email !== undefined) supplier.email = updates.email?.trim();
    if (updates.address !== undefined) supplier.address = updates.address?.trim();
    if (updates.notes !== undefined) supplier.notes = updates.notes?.trim();
    if (updates.lead_time_hours !== undefined) supplier.lead_time_hours = Number(updates.lead_time_hours) || 2;
    if (updates.preferred_brands !== undefined) supplier.preferred_brands = updates.preferred_brands;

    supplier.updated_at = new Date().toISOString();

    this.logAudit('supplier_updated', { supplierId, name: supplier.name });
    this.persist();
    return { success: true, supplier };
  }

  public deleteSupplier(
    supplierId: string,
    householdId = this.state.currentHouseholdId
  ): { success: boolean; message?: string } {
    if (!this.state.suppliers || !this.state.suppliers[householdId]) {
      return { success: false, message: 'Supplier not found' };
    }

    const initialLen = this.state.suppliers[householdId].length;
    this.state.suppliers[householdId] = this.state.suppliers[householdId].filter((s) => s.id !== supplierId);

    if (this.state.suppliers[householdId].length === initialLen) {
      return { success: false, message: 'Supplier not found' };
    }

    this.logAudit('supplier_deleted', { supplierId });
    this.persist();
    return { success: true };
  }

  public getPurchaseLists(householdId = this.state.currentHouseholdId): PurchaseList[] {
    return this.state.purchaseLists?.[householdId] || [];
  }

  public generatePurchaseList(householdId = this.state.currentHouseholdId): PurchaseList {
    const stockMap = this.state.stock[householdId] || {};
    const suppliers = this.getSuppliers(householdId);
    const items: PurchaseListItem[] = [];

    // Check each stock item par level (default par level is 5000g / 5000ml)
    for (const s of Object.values(stockMap)) {
      if (this.isPureVegOnly(householdId) && s.is_non_veg) continue;
      const parLevel = s.unit_base === 'pcs' ? 50 : 5000;
      if (s.qty_base < parLevel) {
        const needed = parLevel - s.qty_base;
        // Match supplier
        const cat = s.location === 'fridge' ? 'Dairy' : 'Dry Grains';
        const sup = suppliers.find((sp) => sp.category.toLowerCase().includes(cat.toLowerCase())) || suppliers[0];

        items.push({
          ingredient_id: s.ingredient_id,
          name: s.name,
          supplier_id: sup?.id,
          supplier_name: sup?.name,
          current_stock: s.qty_base,
          par_level: parLevel,
          needed_qty: needed,
          unit: s.unit_base as BaseUnit,
          estimated_price_inr: Math.round((needed / 1000) * 80),
          price_as_of: 'Today',
          source: 'par_reorder',
        });
      }
    }

    const list: PurchaseList = {
      id: 'pur_' + Date.now(),
      household_id: householdId,
      date: new Date().toISOString().slice(0, 10),
      items,
      total_estimated_cost_inr: items.reduce((sum, i) => sum + i.estimated_price_inr, 0),
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    if (!this.state.purchaseLists) this.state.purchaseLists = {};
    if (!this.state.purchaseLists[householdId]) this.state.purchaseLists[householdId] = [];
    this.state.purchaseLists[householdId].unshift(list);

    this.persist();
    return list;
  }

  public receiveGoods(
    purchaseListId: string,
    items: { ingredient_id: string; qty_received: number; unit: BaseUnit }[],
    householdId = this.state.currentHouseholdId
  ): void {
    const stockMap = this.state.stock[householdId] || {};
    const userMe = this.getMe();
    const performer = userMe.user.name || 'Owner';

    for (const rec of items) {
      let stockItem = Object.values(stockMap).find((s) => s.ingredient_id === rec.ingredient_id);
      if (stockItem) {
        stockItem.qty_base += rec.qty_received;
        this.logStockLedgerEntry({
          household_id: householdId,
          timestamp: new Date().toISOString(),
          ingredient_id: rec.ingredient_id,
          ingredient_name: stockItem.name,
          change_qty: rec.qty_received,
          unit: rec.unit,
          balance_after: stockItem.qty_base,
          reason: 'receipt_purchase',
          performed_by: performer,
          notes: `Goods received against PO #${purchaseListId.slice(-6)}`,
        });
      }
    }

    const pLists = this.state.purchaseLists?.[householdId] || [];
    const targetList = pLists.find((p) => p.id === purchaseListId);
    if (targetList) {
      targetList.status = 'received';
    }

    this.persist();
  }

  public getCloudKitchenReport(dateStr = new Date().toISOString().slice(0, 10), householdId = this.state.currentHouseholdId): CloudKitchenReport {
    const orders = this.getCloudOrders(householdId);
    const wastage = this.getWastageEntries(householdId);
    const menuItems = this.getMenuItems(householdId);

    const completed = orders.filter((o) => o.status === 'delivered' || o.status === 'ready' || o.status === 'preparing');
    const cancelled = orders.filter((o) => o.status === 'cancelled');

    const grossRevenue = completed.reduce((sum, o) => sum + o.total_amount_inr, 0);

    // Calculate food cost from item recipe costs
    let totalFoodCost = 0;
    const itemSales: Record<string, { name: string; portions: number; revenue: number }> = {};

    for (const ord of completed) {
      for (const it of ord.items) {
        const menuItem = menuItems.find((m) => m.id === it.menu_item_id);
        const costPerPortion = menuItem?.cost_inr || it.unit_price_inr * 0.32;
        totalFoodCost += costPerPortion * it.quantity;

        if (!itemSales[it.name]) {
          itemSales[it.name] = { name: it.name, portions: 0, revenue: 0 };
        }
        itemSales[it.name].portions += it.quantity;
        itemSales[it.name].revenue += it.total_price_inr;
      }
    }

    const totalWastageCost = wastage.reduce((sum, w) => sum + (w.cost_inr || 0), 0);
    const grossProfitPercent = grossRevenue > 0 ? Math.round(((grossRevenue - totalFoodCost) / grossRevenue) * 100) : 0;

    const topSelling = Object.values(itemSales)
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 5)
      .map((i) => ({ name: i.name, portions: i.portions, revenue_inr: i.revenue }));

    // Low margin warnings (items below 40% margin)
    const lowMarginWarnings: { name: string; margin_percent: number }[] = [];
    for (const m of menuItems) {
      if (m.price_inr > 0) {
        const margin = Math.round(((m.price_inr - m.cost_inr) / m.price_inr) * 100);
        if (margin < 40) {
          lowMarginWarnings.push({ name: m.name, margin_percent: margin });
        }
      }
    }

    return {
      date: dateStr,
      total_orders: orders.length,
      completed_orders: completed.length,
      cancelled_orders: cancelled.length,
      gross_revenue_inr: grossRevenue,
      estimated_food_cost_inr: Math.round(totalFoodCost),
      gross_profit_margin_percent: grossProfitPercent,
      wastage_cost_inr: totalWastageCost,
      top_selling_items: topSelling,
      low_margin_warnings: lowMarginWarnings,
    };
  }

  public exportReportCsv(report: CloudKitchenReport): string {
    const lines = [
      'MAST MEALS FOOD BUSINESS DAILY PERFORMANCE REPORT',
      `Date,${report.date}`,
      `Total Orders,${report.total_orders}`,
      `Completed Orders,${report.completed_orders}`,
      `Cancelled Orders,${report.cancelled_orders}`,
      `Gross Revenue (INR),₹${report.gross_revenue_inr}`,
      `Estimated Food Cost (INR),₹${report.estimated_food_cost_inr}`,
      `Gross Profit Margin,${report.gross_profit_margin_percent}%`,
      `Wastage Cost (INR),₹${report.wastage_cost_inr}`,
      '',
      'TOP SELLING ITEMS',
      'Item Name,Portions Sold,Revenue (INR)',
      ...report.top_selling_items.map((t) => `"${t.name}",${t.portions},${t.revenue_inr}`),
      '',
      'LOW MARGIN WARNINGS',
      'Item Name,Gross Margin %',
      ...report.low_margin_warnings.map((w) => `"${w.name}",${w.margin_percent}%`),
    ];
    return lines.join('\n');
  }

  public getAuditLog() {
    return this.state.auditLog;
  }

  // ---------------------------------------------------------------------------
  // COMMUNITY DISH FEED (Threads-style cooked dishes sharing)
  // ---------------------------------------------------------------------------
  public getCommunityPosts(): CommunityPost[] {
    if (!this.state.communityPosts || this.state.communityPosts.length === 0) {
      this.state.communityPosts = getDefaultCommunityPosts();
      this.persist();
    }
    return this.state.communityPosts;
  }

  public createCommunityPost(data: {
    caption: string;
    image_url: string;
    recipe_id?: string;
    recipe_title?: string;
    recipe_prep_time_mins?: number;
    recipe_diet_tag?: 'veg' | 'nonveg' | 'egg';
  }): CommunityPost {
    if (!this.state.communityPosts) {
      this.state.communityPosts = getDefaultCommunityPosts();
    }

    const me = this.getMe();
    const newPost: CommunityPost = {
      id: 'post_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      household_id: me.household.id,
      author_id: me.user.id,
      author_name: me.user.name || 'Home Cook',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      caption: data.caption.trim(),
      image_url: data.image_url,
      recipe_id: data.recipe_id,
      recipe_title: data.recipe_title,
      recipe_prep_time_mins: data.recipe_prep_time_mins,
      recipe_diet_tag: data.recipe_diet_tag,
      likes_count: 0,
      liked_by_me: false,
      created_at: new Date().toISOString(),
    };

    this.state.communityPosts.unshift(newPost);
    this.logAudit('community_post_created', { postId: newPost.id, recipe: data.recipe_title });
    this.persist();
    return newPost;
  }

  public togglePostLike(postId: string): { liked: boolean; likesCount: number } {
    if (!this.state.communityPosts) {
      this.state.communityPosts = getDefaultCommunityPosts();
    }

    const post = this.state.communityPosts.find((p) => p.id === postId);
    if (!post) {
      return { liked: false, likesCount: 0 };
    }

    post.liked_by_me = !post.liked_by_me;
    post.likes_count = Math.max(0, post.likes_count + (post.liked_by_me ? 1 : -1));
    this.persist();
    return { liked: post.liked_by_me, likesCount: post.likes_count };
  }

  public deleteCommunityPost(postId: string): boolean {
    if (!this.state.communityPosts) return false;
    const initialLen = this.state.communityPosts.length;
    this.state.communityPosts = this.state.communityPosts.filter((p) => p.id !== postId);
    if (this.state.communityPosts.length !== initialLen) {
      this.logAudit('community_post_deleted', { postId });
      this.persist();
      return true;
    }
    return false;
  }
}

export const store = new StoreService();
