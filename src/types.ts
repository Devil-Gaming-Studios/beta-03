export type AgeGroup = 'kid' | 'adult' | 'elderly';
export type DietCaution = 'diabetes' | 'upset_stomach' | 'heart' | 'bp' | 'cholesterol' | 'digestion';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';
export type MealStatus = 'planned' | 'done' | 'skipped';
export type BaseUnit = 'g' | 'ml' | 'pcs';
export type AppLanguage = 'en' | 'hi' | 'hinglish';
export type OmnirushMode = 'chat' | 'plan' | 'cart';
export type ProposalIntent = 'edit_plan' | 'update_stock' | 'add_recipe' | 'set_category' | 'add_to_cart' | 'modify_recipe' | 'edit_schedule';
export type StockOp = 'add' | 'remove' | 'set';
export type HouseholdType = 'family' | 'bachelor_flat' | 'hostel_room';
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
  name: string;
  diet_pref: DietPreference;
  is_beginner_cook: boolean;
  google_sub?: string;
  created_at: string;
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
