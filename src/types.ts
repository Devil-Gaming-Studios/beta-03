export type AgeGroup = 'kid' | 'adult' | 'elderly';
export type DietCaution = 'diabetes' | 'upset_stomach' | 'heart' | 'bp' | 'cholesterol' | 'digestion';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type MealStatus = 'planned' | 'done' | 'skipped';
export type BaseUnit = 'g' | 'ml' | 'pcs';
export type AppLanguage = 'en' | 'hi' | 'hinglish';
export type OmnirushMode = 'chat' | 'plan' | 'cart';
export type ProposalIntent = 'edit_plan' | 'update_stock' | 'add_recipe' | 'set_category' | 'add_to_cart' | 'modify_recipe' | 'edit_schedule';
export type StockOp = 'add' | 'remove' | 'set';
export type HouseholdType = 'family' | 'bachelor_flat' | 'hostel_room' | 'cloud_kitchen';
export type CloudKitchenRole = 'owner' | 'cook' | 'packer' | 'helper';
export type DietPreference = 'veg' | 'nonveg';
export type CookEquipment =
  | 'stove'
  | 'induction'
  | 'pressure_cooker'
  | 'kadhai_pan'
  | 'mixer'
  | 'microwave'
  | 'kettle'
  | 'rice_cooker'
  | 'tawa'
  | 'oven';

export interface User {
  id: string;
  email: string;
  phone?: string;
  password?: string;
  household_id?: string;
  name: string;
  diet_pref: DietPreference;
  is_beginner_cook: boolean;
  onboarding_completed?: boolean;
  google_sub?: string;
  created_at: string;
}

export interface RegistrationProfileData {
  // 1. Account & Household
  name: string;
  emailOrPhone: string;
  password?: string;
  householdName: string;
  householdType?: HouseholdType;
  // 2. Core Diet & Cooking Experience
  diet_pref: DietPreference;
  is_beginner_cook: boolean;
  // 3. Health & Dietary Goals
  diet_goals: DietaryGoalTag[];
  // 4. Preferred Regional Cuisines
  preferred_regions: string[];
  // 5. Kitchen Setup & Appliances
  has_fridge: boolean;
  equipment: CookEquipment[];
  // 6. Household Primary Member Profile
  member_name?: string;
  age_group: AgeGroup;
  weight_kg: number;
  protein_target_g?: number;
  cautions: DietCaution[];
  // 7. Weekly Variety & Schedule
  weekly_variety_schedule: WeeklyVarietySchedule;
  // 8. Habitual Favorite Dishes
  regular_dishes?: Array<{
    title: string;
    cuisine: string;
    course: string;
    ingredients: string[];
  }>;
}

export interface Household {
  id: string;
  name: string;
  household_type: HouseholdType;
  has_fridge: boolean;
  equipment: CookEquipment[];
  language: AppLanguage;
  version: number;
  invite_code?: string;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  name?: string;
  label?: string;
  age_group: AgeGroup;
  diet_pref: DietPreference;
  weight_kg?: number;
  protein_target_g?: number;
  cautions: DietCaution[];
}

export interface IngredientNutrients {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
}

export interface Ingredient {
  id: string;
  name_en: string;
  name_hi: string;
  aliases: string[];
  category: string;
  base_unit: BaseUnit;
  grams_per_pc: number | null;
  storage_place: 'pantry' | 'fridge';
  shelf_life_days: number;
  nutrients_per_100: IngredientNutrients;
}

export interface RecipeIngredient {
  ingredient_id: string;
  name?: string;
  qty_base: number;
  unit_base?: BaseUnit;
  optional?: boolean;
  have_base?: number;
  enough?: boolean;
}

export interface Recipe {
  id: string;
  household_id?: string;
  recipe_id?: string; // canonical reference if any
  title: string;
  category: string;
  slots: MealSlot[];
  base_servings: number;
  times_cooked: number;
  ingredients: RecipeIngredient[];
}

export interface StockItem {
  id: string;
  household_id: string;
  ingredient_id: string;
  name: string;
  name_hi?: string;
  qty_base: number;
  unit_base: BaseUnit;
  location: string;
  owner_user_id: string | null; // null = shared, string = personal
  contributed_by?: string;
  expiry?: string | null;
  is_estimate?: boolean;
  version: number;
  shelf_life_days?: number;
  storage_place?: 'pantry' | 'fridge';
  is_non_veg?: boolean;
}

export interface MissingIngredient {
  ingredient_id: string;
  name: string;
  unit_base: string;
  qty_base: number;
  have_base: number;
  short_base: number;
}

export interface PlannedMeal {
  id: string;
  plan_id: string;
  meal_date: string;
  slot: MealSlot;
  household_recipe_id: string;
  title?: string;
  servings: number;
  status: MealStatus;
  diner_member_ids?: string[];
  missing: MissingIngredient[];
  nutrition: IngredientNutrients;
  variety_type?: 'regular' | 'new';
  cuisine?: string;
  ai_reason?: string;
  diet_tags?: string[];
  updated_at?: string;
}

export type DayOfWeekKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type DayVarietyMode = 'regular' | 'new';
export type WeeklyVarietySchedule = Record<DayOfWeekKey, DayVarietyMode>;
export type DietaryGoalTag = 'protein_rich' | 'diabetes' | 'heart' | 'low_oil' | 'high_fiber';

export interface PastDietEntry {
  recipe_id: string;
  title: string;
  cuisine: string;
  course: string;
  ingredients: string[];
  times_eaten: number;
  weeks_active: number;
  last_eaten_date: string;
  is_regular_favorite: boolean;
}

export interface UserDietMemory {
  user_id: string;
  diet_goals: DietaryGoalTag[];
  preferred_regions: string[];
  weekly_variety_schedule: WeeklyVarietySchedule;
  past_regular_dishes: PastDietEntry[];
  common_ingredients: string[];
  common_regions: string[];
  weeks_tracked: number;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start: string;
  version: number;
  meals: PlannedMeal[];
}

export interface ShoppingListItem {
  id: string;
  ingredient_id: string;
  name: string;
  qty_base: number;
  base_unit: string;
  owner_user_id?: string | null; // null = shared, string = personal
  in_swiggy_cart?: boolean;
  estimated_price?: number;
  best_store?: 'Blinkit' | 'Zepto' | 'Swiggy Instamart';
  swiggy_price?: number;
  blinkit_price?: number;
  zepto_price?: number;
  as_of?: string;
}

export interface SwiggyMcpTool {
  name: string;
  description: string;
  inputSchema?: any;
}

export interface SwiggyAccountConnection {
  isConnected: boolean;
  expiresAt?: number;
  scope?: string;
  userProfile?: {
    name?: string;
    phoneNumber?: string;
    email?: string;
  } | null;
  availableTools?: SwiggyMcpTool[];
  lastCheckedAt?: string;
  firstToolCallResult?: {
    tool: string;
    calledAt: string;
    success: boolean;
    summary: string;
    addressCount?: number;
    error?: string;
  } | null;
}

export interface GraphRecipe {
  id: string;
  srno: number;
  name: string;
  translatedName: string;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  cuisine: string;
  course: string;
  diet: string;
  isNonVeg: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  instructions: string;
  translatedInstructions: string;
  url: string;
  ingredients: {
    raw: string;
    name: string;
    canonicalId: string;
    qty_base: number;
    unit_base: BaseUnit;
    isNonVeg: boolean;
  }[];
  nutrientsEstimated: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sodium_mg: number;
  };
  similarRecipeObjects?: GraphRecipe[];
}

export interface ProposalItemChange {
  ingredient_id: string;
  name?: string;
  qty_base: number;
  unit_base: BaseUnit;
  op: StockOp;
  note?: string | null;
  before?: number;
  after?: number;
  stock_id?: string | null;
  is_existing?: boolean;
  location?: 'pantry' | 'fridge';
  target_scope?: 'personal' | 'shared';
  target_section?: string;
  classification?: string;
}

export interface ProposalPlanChange {
  meal_date: string;
  slot: MealSlot;
  household_recipe_id: string | null;
  servings: number;
  recipe_title?: string;
}

export interface ProposalRecipeModification {
  recipe_id: string;
  recipe_title: string;
  ingredient_name: string;
  ingredient_id?: string;
  old_qty?: number;
  new_qty: number;
  unit: string;
  op?: 'set' | 'add' | 'remove';
  servings?: number;
  reason?: string;
}

export interface ProposalRecipe {
  title: string;
  base_servings: number;
  ingredients: { ingredient_id: string; qty_base: number }[];
}

export interface ProposalPayload {
  intent: ProposalIntent;
  target_section?: string;
  update_type_label?: string;
  classification_badge?: string;
  items: ProposalItemChange[];
  plan_changes: ProposalPlanChange[];
  recipe: ProposalRecipe | null;
  recipe_modification?: ProposalRecipeModification | null;
}

export interface OmnirushResponse {
  mode: OmnirushMode;
  message: string;
  proposal_id?: string | null;
  intent?: ProposalIntent | null;
  target_section?: string;
  update_type_label?: string;
  classification_badge?: string;
  items?: ProposalItemChange[];
  plan_changes?: ProposalPlanChange[];
  recipe?: ProposalRecipe | null;
  recipe_modification?: ProposalRecipeModification | null;
  unmatched?: { raw_name: string; reason: string }[];
  warnings?: string[];
  needs_clarification?: string | null;
  injection_suspected?: boolean;
  auto_applied?: boolean;
  timing?: {
    model: string;
    elapsed_ms: number;
    eval_count?: number;
  };
  elapsed_ms?: number;
}

export interface PendingAction {
  id: string;
  household_id: string;
  client_id: string;
  intent: ProposalIntent;
  transcript: string;
  payload: ProposalPayload;
  status: 'pending' | 'confirmed' | 'expired' | 'discarded';
  expires_at: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Cloud Kitchen Mode Types
// ---------------------------------------------------------------------------
export type MenuItemDietTag = 'veg' | 'nonveg' | 'egg';
export type MenuItemCookMethod = 'batch' | 'to_order';

export interface MenuItemVariant {
  id: string;
  name: string; // e.g. "Half", "Full", "Extra Paneer"
  price_inr: number;
  portion_multiplier: number; // e.g. 0.5 for half, 1.0 for full, 1.5
  ingredient_deltas?: {
    ingredient_id: string;
    qty_delta: number;
    unit: BaseUnit;
  }[];
}

export interface MenuItemRecipeIngredient {
  ingredient_id: string;
  name: string;
  qty_per_portion: number;
  unit: BaseUnit;
  is_pinch_or_taste?: boolean; // spices like salt/turmeric tracked approximately
  cost_estimate_inr?: number;
}

export interface MenuItem {
  id: string;
  household_id: string;
  recipe_id?: string;
  name: string;
  name_hi?: string;
  description?: string;
  category: string; // e.g. "Biryani & Rice", "Curries", "Breads", "Combos", "Desserts"
  price_inr: number;
  cost_inr: number; // calculated food cost
  portion_size: string; // e.g. "450g box", "2 pcs", "500ml container"
  yield_per_batch: number; // default batch portions (e.g. 20 or 40)
  prep_time_mins: number;
  cook_method: MenuItemCookMethod; // 'batch' (biryani, dal makhani) vs 'to_order' (roti, fresh tadka)
  is_available: boolean;
  diet_tag: MenuItemDietTag; // derived strictly from ingredients in code
  is_spicy?: boolean;
  allergens: string[]; // e.g. ["dairy", "gluten", "nuts"]
  variants: MenuItemVariant[];
  ingredients: MenuItemRecipeIngredient[];
  cooked_portions_available?: number; // for 'batch' items: pool of cooked portions ready to pack
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type OrderSource = 'walk_in' | 'phone_call' | 'whatsapp' | 'telegram' | 'swiggy_manual' | 'zomato_manual';
export type PaymentStatus = 'pending' | 'paid' | 'cod';

export interface CloudOrderItem {
  item_id: string;
  menu_item_id: string;
  name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit_price_inr: number;
  total_price_inr: number;
  notes?: string;
}

export interface CloudOrder {
  id: string;
  household_id: string;
  order_number: number; // KOT number e.g. #101
  customer_name: string;
  customer_phone?: string;
  items: CloudOrderItem[];
  total_amount_inr: number;
  notes?: string;
  source: OrderSource;
  scheduled_time?: string; // ISO date-time or time string
  status: OrderStatus;
  payment_status: PaymentStatus;
  reserved_stock_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface CookBatch {
  id: string;
  household_id: string;
  menu_item_id: string;
  item_name: string;
  portions_announced: number;
  portions_cooked: number;
  portions_remaining: number;
  status: 'announced' | 'cooking' | 'ready' | 'exhausted';
  announced_by: string;
  ingredients_deducted: {
    ingredient_id: string;
    name: string;
    qty: number;
    unit: BaseUnit;
  }[];
  notes?: string;
  started_at: string;
  completed_at?: string;
}

export interface StockReservation {
  id: string;
  household_id: string;
  order_id: string;
  ingredient_id: string;
  ingredient_name: string;
  qty_reserved: number;
  unit: BaseUnit;
  status: 'active' | 'deducted' | 'released';
  created_at: string;
}

export interface StockLedgerEntry {
  id: string;
  household_id: string;
  timestamp: string;
  ingredient_id: string;
  ingredient_name: string;
  change_qty: number; // positive for addition/receipt, negative for deduction/batch/spoilage
  unit: BaseUnit;
  balance_after: number;
  reason: 'batch_cook' | 'order_prep' | 'spoilage' | 'staff_meal' | 'receipt_purchase' | 'manual_adjustment' | 'cancellation_restore';
  linked_order_id?: string;
  linked_batch_id?: string;
  performed_by: string;
  notes?: string;
}

export interface WastageEntry {
  id: string;
  household_id: string;
  ingredient_id: string;
  ingredient_name: string;
  qty: number;
  unit: BaseUnit;
  reason: 'spoilage' | 'spill' | 'staff_meal' | 'customer_return' | 'expired';
  cost_inr: number;
  logged_by: string;
  notes?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  household_id: string;
  name: string;
  category: string; // e.g. "Dairy", "Vegetables & Greens", "Dry Spices & Grains", "Packaging"
  phone: string;
  contact_person?: string;
  email?: string;
  address?: string;
  notes?: string;
  lead_time_hours: number;
  preferred_brands: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseListItem {
  ingredient_id: string;
  name: string;
  supplier_id?: string;
  supplier_name?: string;
  current_stock: number;
  par_level: number;
  needed_qty: number;
  unit: BaseUnit;
  estimated_price_inr: number;
  preferred_brand?: string;
  price_as_of: string;
  source: 'par_reorder' | 'tomorrow_demand';
}

export interface PurchaseList {
  id: string;
  household_id: string;
  date: string;
  items: PurchaseListItem[];
  total_estimated_cost_inr: number;
  status: 'draft' | 'ordered' | 'received';
  created_at: string;
}

export interface CloudKitchenReport {
  date: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  gross_revenue_inr: number;
  estimated_food_cost_inr: number;
  gross_profit_margin_percent: number;
  wastage_cost_inr: number;
  top_selling_items: { name: string; portions: number; revenue_inr: number }[];
  low_margin_warnings: { name: string; margin_percent: number }[];
}

