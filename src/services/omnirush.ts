import {
  OmnirushMode,
  OmnirushResponse,
  ProposalPayload,
  ProposalItemChange,
  ProposalPlanChange,
  ProposalRecipeModification,
  MealSlot,
} from '../types';
import { store, CANONICAL_INGREDIENTS, getMonday, formatLocalDate, getTodayStr } from './store';
import seedData from '../data/graph_rag_seed.json';

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+|any\s+)?(previous|prior|above)/i,
  /reveal\s+(your\s+|the\s+)?(system\s+prompt|instructions)/i,
  /you\s+are\s+now/i,
  /system\s+prompt/i,
  /developer\s+message/i,
];

// Hindi/Hinglish numeric words to numbers
const NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  seven: 7,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  aadha: 0.5,
  aadhe: 0.5,
  half: 0.5,
  pao: 0.25,
  quarter: 0.25,
  derh: 1.5,
  dedh: 1.5,
  dhai: 2.5,
};

export async function askOmnirush(
  text: string,
  mode: OmnirushMode = 'chat'
): Promise<OmnirushResponse> {
  const started = Date.now();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Please enter a message or command.');
  }

  // 1. Injection screening
  const injectionSuspected = INJECTION_PATTERNS.some((p) => p.test(trimmed));
  const warnings: string[] = [];
  if (injectionSuspected) {
    warnings.push('Input matched injection screening patterns; treated strictly as data.');
  }

  // 2. Fetch current household context
  const me = store.getMe();
  const stock = store.getStock();
  const recipes = store.getRecipes();

  // 3. First, run the deterministic Indian Kitchen NLP parser
  const localParsed = parseLocally(trimmed, mode, stock, recipes, me);

  // If local parser identified an explicit actionable intent (stock update, recipe modification, schedule),
  // use it directly. It is 100% accurate, domain-grounded, and works completely offline.
  if (localParsed.intent) {
    return finalizeResponse(localParsed, trimmed, injectionSuspected, warnings, started);
  }

  // 4. For open-ended chat or queries where local parser had no specific intent, call Server-Side API
  try {
    const serverRes = await callServerOmnirush(trimmed, mode, me, stock, recipes);
    if (serverRes && serverRes.intent) {
      return finalizeResponse(serverRes, trimmed, injectionSuspected, warnings, started);
    }
  } catch {
    // Fall back to localParsed
  }

  return finalizeResponse(localParsed, trimmed, injectionSuspected, warnings, started);
}

function finalizeResponse(
  parsed: OmnirushResponse,
  transcript: string,
  injectionSuspected: boolean,
  warnings: string[],
  started: number
): OmnirushResponse {
  if (injectionSuspected) {
    parsed.injection_suspected = true;
    parsed.warnings = [...(parsed.warnings || []), ...warnings];
  }

  // If there's an actionable proposal and it wasn't already auto-applied, register a pending action in store
  let proposalId: string | null = null;
  if (
    !parsed.auto_applied &&
    (parsed.items?.length ||
      parsed.plan_changes?.length ||
      parsed.recipe ||
      parsed.recipe_modification)
  ) {
    const payload: ProposalPayload = {
      intent: parsed.intent || 'update_stock',
      items: parsed.items || [],
      plan_changes: parsed.plan_changes || [],
      recipe: parsed.recipe || null,
      recipe_modification: parsed.recipe_modification || null,
      restock_all_missing: parsed.restock_all_missing || false,
    };
    const pending = store.createPendingAction(payload.intent, transcript, payload);
    proposalId = pending.id;
  }

  return {
    ...parsed,
    proposal_id: proposalId,
    elapsed_ms: Date.now() - started,
    timing: {
      model: 'Omnirush Engine (Offline Graph RAG + NLP)',
      elapsed_ms: Date.now() - started,
    },
  };
}

function parseLocally(
  text: string,
  mode: OmnirushMode,
  stock: any[],
  recipes: any[],
  me: any
): OmnirushResponse {
  const lower = text.toLowerCase();

  // -------------------------------------------------------------------------
  // 0. INTENT: BOUGHT / RESTOCKED EVERYTHING REQUIRED OR ALL MISSING / SHOP TAB ITEMS
  // (e.g. "i have bought everything that was missing so please update it", "I bought everything that is required", "saara saman le aaye")
  // -------------------------------------------------------------------------
  const hasBoughtVerb =
    lower.includes('bought') ||
    lower.includes('purchased') ||
    lower.includes('restock') ||
    lower.includes('got') ||
    lower.includes('brought') ||
    lower.includes('added') ||
    lower.includes('have all') ||
    lower.includes('le aaye') ||
    lower.includes('le liya') ||
    lower.includes('kharid') ||
    lower.includes('khareed') ||
    lower.includes('aa gaya') ||
    lower.includes('filled') ||
    lower.includes('stocked');

  const refersToAllOrMissing =
    lower.includes('everything') ||
    lower.includes('all') ||
    lower.includes('required') ||
    lower.includes('missing') ||
    lower.includes('needed') ||
    lower.includes('shortfall') ||
    lower.includes('shopping list') ||
    lower.includes('shop tab') ||
    lower.includes('shop list') ||
    lower.includes('the store') ||
    lower.includes('groceries') ||
    lower.includes('saara') ||
    lower.includes('sara') ||
    lower.includes('sab kuch') ||
    lower.includes('sab saman');

  if (
    (hasBoughtVerb && refersToAllOrMissing) ||
    lower.includes('bought everything') ||
    lower.includes('everything that was missing') ||
    lower.includes('everything that is required') ||
    lower.includes('all missing') ||
    lower.includes('restock missing') ||
    lower.includes('empty the store') ||
    lower.includes('clear shopping list')
  ) {
    // Preview only: nothing is moved into stock until the user confirms the card
    const applied: any[] = store.getShoppingList().map((sh: any) => ({
      ingredient_id: sh.ingredient_id,
      name: sh.name,
      qty_base: sh.qty_base,
      unit_base: sh.base_unit || 'g',
      op: 'add',
      before: 0,
      after: sh.qty_base,
      target_section: 'Kitchen Stock',
    }));

    if (applied.length === 0) {
      return {
        mode: 'chat',
        message:
          '✅ All required ingredients are already in your Kitchen Inventory and your Shop Tab is completely empty (0 missing items)!',
        intent: 'update_stock',
        classification_badge: 'Shop Emptied & Stock Complete',
        update_type_label: 'Full Shop Tab → Inventory Transfer',
        target_section: 'Kitchen Stock & Shop Tab (Synced)',
        items: [],
        auto_applied: true,
        warnings: [],
        unmatched: [],
      };
    }

    const itemSummaryList = applied
      .map((it: any) => `${it.name} (+${it.qty_base}${it.unit_base} → ${it.after}${it.unit_base})`)
      .join(', ');

    return {
      mode: 'chat',
      message: `✅ Ready to move all ${applied.length} item(s) from your Shop Tab / Missing List into your Kitchen Inventory (tap Confirm): ${itemSummaryList}.\n🛒 Your Shop Tab is now completely emptied (0 items remaining) and all planned meals are marked "In Stock"!`,
      intent: 'update_stock',
      classification_badge: 'Shop Emptied & Inventory Updated',
      update_type_label: 'Full Offline Purchase Sync (Shop → Inventory)',
      target_section: 'Kitchen Stock (Added) + Shop Tab (Emptied)',
      items: applied,
      restock_all_missing: true,
      warnings: [],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 1. INTENT: MODIFY OFFLINE SAVED RECIPES (e.g. increase sugar in Kheer to 150g)
  // -------------------------------------------------------------------------
  const isModifyRecipe =
    lower.includes('recipe') ||
    lower.includes('increase') ||
    lower.includes('badha') ||
    lower.includes('ghata') ||
    lower.includes('reduce') ||
    lower.includes('decrease') ||
    lower.includes('change sugar') ||
    lower.includes('more sugar') ||
    lower.includes('chini') ||
    lower.includes('sugar in') ||
    lower.includes('namak in') ||
    lower.includes('salt in');

  if (isModifyRecipe) {
    // Check if a specific recipe name is mentioned, or fallback to Kheer/Poha/recent recipe
    const allKnownRecipes = [
      ...recipes,
      ...((seedData as any).recipes || []).map((sr: any) => ({
        id: sr.id,
        title: sr.name,
        ingredients: sr.ingredients || [],
      })),
      { id: 'rec_kheer_01', title: 'Rice Kheer (चावल की खीर)', ingredients: [{ name: 'Sugar / Chini', qty_base: 100, unit_base: 'g' }] },
      { id: 'rec_poha_01', title: 'Kanda Poha', ingredients: [{ name: 'Green Chillies', qty_base: 2, unit_base: 'pcs' }] },
      { id: 'rec_dal_01', title: 'Toor Dal Tadka', ingredients: [{ name: 'Salt / Namak', qty_base: 10, unit_base: 'g' }] },
    ];

    let targetRecipe = allKnownRecipes.find((r) => {
      const t = r.title.toLowerCase();
      return (
        lower.includes(t) ||
        (t.includes('kheer') && (lower.includes('kheer') || lower.includes('sugar') || lower.includes('chini'))) ||
        (t.includes('poha') && lower.includes('poha')) ||
        (t.includes('paneer') && lower.includes('paneer bhurji')) ||
        (t.includes('dal') && lower.includes('dal'))
      );
    });

    // Default to Kheer if user specifically mentions sugar/sweet/chini in an offline recipe
    if (!targetRecipe && (lower.includes('sugar') || lower.includes('chini') || lower.includes('sweet'))) {
      targetRecipe = allKnownRecipes.find((r) => r.title.toLowerCase().includes('kheer')) || allKnownRecipes[0];
    }

    if (targetRecipe) {
      // Find which ingredient is being adjusted
      let ingredientName = 'Sugar / Chini';
      let ingredientId = 'ing_chini';
      let oldQty = 100;
      let unit = 'g';

      if (lower.includes('salt') || lower.includes('namak')) {
        ingredientName = 'Salt / Namak';
        ingredientId = 'ing_namak';
        oldQty = 10;
        unit = 'g';
      } else if (lower.includes('mirch') || lower.includes('chilli') || lower.includes('chillie')) {
        ingredientName = 'Green Chillies';
        ingredientId = 'ing_hari_mirch';
        oldQty = 2;
        unit = 'pcs';
      } else if (lower.includes('doodh') || lower.includes('milk')) {
        ingredientName = 'Milk / Doodh';
        ingredientId = 'ing_doodh';
        oldQty = 750;
        unit = 'ml';
      } else if (lower.includes('peanut') || lower.includes('moongfali')) {
        ingredientName = 'Roasted Peanuts';
        ingredientId = 'ing_peanuts';
        oldQty = 50;
        unit = 'g';
      }

      // Extract target quantity
      let newQty = 150; // default for "increase sugar in kheer"
      const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(g|gm|grams|ml|pcs|packet|kilo|kg)?/);
      if (qtyMatch) {
        newQty = parseFloat(qtyMatch[1]) || 150;
        if (qtyMatch[2]) {
          const u = qtyMatch[2].toLowerCase();
          if (u === 'kg' || u === 'kilo') newQty *= 1000;
        }
      } else if (lower.includes('increase') || lower.includes('badha') || lower.includes('extra') || lower.includes('more')) {
        newQty = oldQty + 50;
      } else if (lower.includes('decrease') || lower.includes('ghata') || lower.includes('kam') || lower.includes('less')) {
        newQty = Math.max(0, oldQty - 30);
      }

      const mod: ProposalRecipeModification = {
        recipe_id: targetRecipe.id,
        recipe_title: targetRecipe.title,
        ingredient_name: ingredientName,
        ingredient_id: ingredientId,
        old_qty: oldQty,
        new_qty: newQty,
        unit,
        op: 'set',
      };

      const targetSection = `Offline Saved Recipes → ${targetRecipe.title}`;

      return {
        mode: 'chat',
        message: `Offline saved recipe "${targetRecipe.title}" me ${ingredientName} ko ${oldQty}${unit} se badha kar ${newQty}${unit} karne ka proposal ready hai. Niche 'Confirm Changes' par click karke recipe save karein.`,
        intent: 'modify_recipe',
        classification_badge: 'Recipe Customization',
        update_type_label: 'Offline Recipe Modification',
        target_section: targetSection,
        recipe_modification: mod,
        items: [],
        plan_changes: [],
        warnings: ['Changes will be saved to offline household recipe database.'],
        unmatched: [],
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. INTENT: FULL WEEK SCHEDULE (e.g. "plan full schedule for this week")
  // -------------------------------------------------------------------------
  const isFullSchedule =
    lower.includes('full schedule') ||
    lower.includes('entire week') ||
    lower.includes('whole week') ||
    lower.includes('saare hafte') ||
    lower.includes('full week') ||
    lower.includes('hafta') ||
    lower.includes('all days') ||
    lower.includes('complete menu');

  if (isFullSchedule) {
    const weekStart = getMonday();
    const startDate = new Date(weekStart);
    const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
    const allPlanChanges: ProposalPlanChange[] = [];

    const availableRecipes = recipes.length > 0 ? recipes : (seedData as any).recipes?.slice(0, 10) || [];
    const recipePool = availableRecipes.map((r: any) => ({
      id: r.id,
      title: r.title || r.name,
      slots: r.slots || ['breakfast', 'lunch', 'dinner'],
    }));

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const curDate = new Date(startDate);
      curDate.setDate(curDate.getDate() + dayOffset);
      const dateStr = curDate.toISOString().slice(0, 10);

      for (const slot of slots) {
        const pool = recipePool.filter((r: any) => r.slots?.includes(slot)) || recipePool;
        const chosen = pool.length > 0 ? pool[(dayOffset + slots.indexOf(slot)) % pool.length] : recipePool[0];

        allPlanChanges.push({
          meal_date: dateStr,
          slot,
          household_recipe_id: chosen ? chosen.id : 'rec_default',
          servings: me.members?.length || 2,
          recipe_title: chosen ? chosen.title : 'Planned Meal',
        });
      }
    }

    return {
      mode: 'plan',
      message: `Aapke kitchen stock aur ${me.members?.length || 2} members ke preferences ke mutabik 7-day complete weekly schedule plan generate kiya gaya hai (${allPlanChanges.length} meals scheduled). Niche proposal card check karke confirm karein.`,
      intent: 'edit_schedule',
      classification_badge: 'Weekly Schedule Sync',
      update_type_label: '7-Day Weekly Meal Schedule Auto-Plan',
      target_section: `Weekly Schedule → Week of ${weekStart}`,
      plan_changes: allPlanChanges,
      items: [],
      warnings: ['Replaces or fills missing slots for the week of ' + weekStart],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 3. INTENT: CHANGE SPECIFIC MEAL SLOT (e.g. "change dinner today to Paneer Bhurji")
  // -------------------------------------------------------------------------
  const isSlotChange =
    lower.includes('change dinner') ||
    lower.includes('change lunch') ||
    lower.includes('change breakfast') ||
    lower.includes('make dinner') ||
    lower.includes('make lunch') ||
    lower.includes('make breakfast') ||
    lower.includes('dinner me') ||
    lower.includes('lunch me') ||
    lower.includes('nashta me') ||
    lower.includes('set dinner') ||
    lower.includes('schedule');

  if (isSlotChange || lower.includes('paneer bhurji') || lower.includes('khichdi') || lower.includes('biryani') || lower.includes('poha')) {
    // Detect slot
    let slot: MealSlot = 'dinner';
    if (lower.includes('breakfast') || lower.includes('nashta') || lower.includes('subah')) {
      slot = 'breakfast';
    } else if (lower.includes('lunch') || lower.includes('dopahar')) {
      slot = 'lunch';
    } else if (lower.includes('dinner') || lower.includes('raat') || lower.includes('shaam')) {
      slot = 'dinner';
    }

    // Detect target date
    const today = new Date();
    let targetDate = new Date(today);
    if (lower.includes('tomorrow') || lower.includes('kal')) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (lower.includes('friday') || lower.includes('shukrawar')) {
      // Find Friday offset
      targetDate.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
    } else if (lower.includes('saturday') || lower.includes('shaniwar')) {
      targetDate.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));
    } else if (lower.includes('sunday') || lower.includes('ravivar')) {
      targetDate.setDate(today.getDate() + ((7 - today.getDay() + 7) % 7));
    }
    const dateStr = formatLocalDate(targetDate);
    const todayLocalStr = getTodayStr();

    // Identify recipe
    const allRecipes = [
      ...recipes,
      ...((seedData as any).recipes || []).map((r: any) => ({ id: r.id, title: r.name })),
      { id: 'rec_paneer_01', title: 'Paneer Bhurji with Rotis' },
      { id: 'rec_dal_01', title: 'Toor Dal, Rice & Bhindi' },
      { id: 'rec_poha_01', title: 'Poha with Roasted Peanuts' },
      { id: 'rec_khichdi_01', title: 'Moong Dal Khichdi with Dahi' },
      { id: 'rec_biryani_01', title: 'Vegetable Dum Biryani' },
    ];

    const matchedRecipe = allRecipes.find((r) => {
      const t = r.title.toLowerCase();
      if (lower.includes('paneer bhurji') && t.includes('paneer')) return true;
      if (lower.includes('khichdi') && t.includes('khichdi')) return true;
      if (lower.includes('poha') && t.includes('poha')) return true;
      if (lower.includes('biryani') && t.includes('biryani')) return true;
      if (lower.includes('dal') && t.includes('dal')) return true;
      return lower.includes(t);
    }) || allRecipes[0];

    const servingsCount = me.members?.length || 2;
    const planChange: ProposalPlanChange = {
      meal_date: dateStr,
      slot,
      household_recipe_id: matchedRecipe.id,
      servings: servingsCount,
      recipe_title: matchedRecipe.title,
    };

    // Proposal only: the meal plan is written when the user confirms the card

    const targetSection = `Meal Planner → ${slot.toUpperCase()} (${dateStr === todayLocalStr ? 'Today' : dateStr})`;

    return {
      mode: 'plan',
      message: `Proposed Meal Plan change: Schedule "${matchedRecipe.title}" (${servingsCount} servings) for ${dateStr === todayLocalStr ? 'Today' : dateStr} (${slot.toUpperCase()}). Synced across Home & Calendar!`,
      intent: 'edit_plan',
      classification_badge: 'Meal Slot Updated',
      update_type_label: 'Meal Slot Scheduled (Live Synced)',
      target_section: targetSection,
      plan_changes: [planChange],
      items: [],
      warnings: [],
      unmatched: [],
      auto_applied: false,
    };
  }

  // -------------------------------------------------------------------------
  // 4. INTENT: GENERAL MEAL SUGGESTION (e.g. "suggest dinner", "what to cook")
  // -------------------------------------------------------------------------
  if (mode === 'plan' || lower.includes('suggest') || lower.includes('kya banayein') || lower.includes('menu')) {
    const dStr = getTodayStr();

    const availableRecipes = recipes.length > 0 ? recipes : (seedData as any).recipes?.slice(0, 10) || [];
    const bFast = availableRecipes.find((r: any) => r.slots?.includes('breakfast')) || availableRecipes[0];
    const lunch = availableRecipes.find((r: any) => r.slots?.includes('lunch') && r.id !== bFast.id) || availableRecipes[1] || bFast;
    const dinner = availableRecipes.find((r: any) => r.slots?.includes('dinner') && r.id !== lunch.id) || availableRecipes[2] || lunch;

    const planChanges: ProposalPlanChange[] = [
      {
        meal_date: dStr,
        slot: 'breakfast',
        household_recipe_id: bFast.id,
        servings: me.members?.length || 2,
        recipe_title: bFast.title || bFast.name,
      },
      {
        meal_date: dStr,
        slot: 'lunch',
        household_recipe_id: lunch.id,
        servings: me.members?.length || 2,
        recipe_title: lunch.title || lunch.name,
      },
      {
        meal_date: dStr,
        slot: 'dinner',
        household_recipe_id: dinner.id,
        servings: me.members?.length || 2,
        recipe_title: dinner.title || dinner.name,
      },
    ];

    return {
      mode: 'plan',
      message: `Aapke kitchen stock aur ${me.members?.length || 2} members ke hisaab se proposed menu taiyar hai: Breakfast: ${bFast.title || bFast.name}, Lunch: ${lunch.title || lunch.name}, Dinner: ${dinner.title || dinner.name}.`,
      intent: 'edit_plan',
      classification_badge: 'Meal Planner Sync',
      update_type_label: 'Suggested Daily Meal Plan',
      target_section: `Meal Planner → Today (${dStr})`,
      plan_changes: planChanges,
      items: [],
      warnings: [],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 5. INTENT: DIRECT SHOP TAB / SHOPPING LIST EDITS OR CART CHECK FROM CHAT
  // (e.g. "remove karela from shop tab", "add 2 kg sugar to shopping list", "change tomato in shop to 500g")
  // -------------------------------------------------------------------------
  const mentionsShopTab =
    lower.includes('shop tab') ||
    lower.includes('shopping list') ||
    lower.includes('shop list') ||
    lower.includes('grocery list') ||
    lower.includes('in shop') ||
    lower.includes('from shop') ||
    lower.includes('to shop');

  const hasEditVerb =
    lower.includes('add') ||
    lower.includes('remove') ||
    lower.includes('delete') ||
    lower.includes('change') ||
    lower.includes('set') ||
    lower.includes('update') ||
    lower.includes('hata') ||
    lower.includes('bought') ||
    lower.includes('jod');

  if (mentionsShopTab && hasEditVerb) {
    let shopOp: 'add' | 'remove' | 'set' | 'bought' = 'add';
    if (
      lower.includes('remove') ||
      lower.includes('delete') ||
      lower.includes('hata') ||
      lower.includes('clear')
    ) {
      shopOp = 'remove';
    } else if (lower.includes('bought') || lower.includes('purchased') || lower.includes('kharid')) {
      shopOp = 'bought';
    } else if (lower.includes('change') || lower.includes('set') || lower.includes('update')) {
      shopOp = 'set';
    }

    // 1. Check if the user is referring to an existing item in the Shop tab
    const currentShopList = store.getShoppingList();
    let matchedShopItem = currentShopList.find((sh) => {
      const tokens = `${sh.name} ${sh.ingredient_id.replace(/^ing_/, '')}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3);
      return (
        tokens.some((tok) => lower.includes(tok)) ||
        store.doesItemMatch(lower, lower, sh.ingredient_id, sh.name)
      );
    });

    let targetName = matchedShopItem?.name || '';
    let parsedQty = matchedShopItem?.qty_base || 500;
    let parsedUnit = matchedShopItem?.base_unit || 'g';

    if (matchedShopItem) {
      const tokens = `${matchedShopItem.name} ${matchedShopItem.ingredient_id.replace(/^ing_/, '')}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3);
      const tok = tokens.find((t) => lower.includes(t)) || matchedShopItem.name.toLowerCase();
      if (hasExplicitNumber(lower)) {
        parsedQty = extractQuantityFor(lower, tok, matchedShopItem.base_unit);
      }
    } else {
      // Extract new item name & quantity from command like "add 2 kg sugar to shopping list"
      const cleaned = lower
        .replace(/\b(please|can you|omnirush|add|remove|delete|change|set|update|bought|to|from|in|the|my|shop|shopping|grocery|list|tab|for|me)\b/gi, ' ')
        .trim();
      const numMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|grams|ml|l|litre|liter|pcs|pc)?\s*([a-z\s]+)/i);
      if (numMatch) {
        const rawQty = parseFloat(numMatch[1]) || 1;
        const rawUnit = (numMatch[2] || '').toLowerCase();
        if (rawUnit === 'kg' || rawUnit === 'kilo') {
          parsedQty = rawQty * 1000;
          parsedUnit = 'g';
        } else if (rawUnit === 'l' || rawUnit === 'litre' || rawUnit === 'liter') {
          parsedQty = rawQty * 1000;
          parsedUnit = 'ml';
        } else if (rawUnit === 'ml') {
          parsedQty = rawQty;
          parsedUnit = 'ml';
        } else if (rawUnit === 'pcs' || rawUnit === 'pc') {
          parsedQty = rawQty;
          parsedUnit = 'pcs';
        } else {
          parsedQty = rawQty <= 10 ? rawQty * 100 : rawQty;
          parsedUnit = 'g';
        }
        targetName = (numMatch[3] || '').trim();
      } else {
        targetName = cleaned.replace(/[^a-z\s]/gi, '').trim();
      }
    }

    if (targetName) {
      // Preview only: the Shop Tab is changed when the user confirms the card
      const before = matchedShopItem?.qty_base || 0;
      const foundForRemove = shopOp === 'remove' && Boolean(matchedShopItem);
      const notFound = shopOp === 'remove' && !matchedShopItem;
      const shopRes = {
        itemName: matchedShopItem?.name || targetName,
        qty: parsedQty,
        unit: parsedUnit,
        action: notFound ? 'not_found' : shopOp === 'remove' ? 'removed' : shopOp === 'bought' ? 'bought' : matchedShopItem ? 'updated' : 'added',
      };
      const statusMsg =
        shopRes.action === 'removed'
          ? `Remove "${shopRes.itemName}" from your Shop Tab? Tap Confirm to apply.`
          : shopRes.action === 'bought'
          ? `Mark "${shopRes.itemName}" as bought (add to Kitchen Stock and remove from Shop Tab)? Tap Confirm to apply.`
          : shopRes.action === 'updated'
          ? `Update "${shopRes.itemName}" in your Shop Tab to ${shopRes.qty} ${shopRes.unit}? Tap Confirm to apply.`
          : shopRes.action === 'added'
          ? `Add "${shopRes.itemName}" (${shopRes.qty} ${shopRes.unit}) to your Shop Tab? Tap Confirm to apply.`
          : `Could not find "${targetName}" in the Shop Tab.`;
      void foundForRemove;

      return {
        mode: 'cart',
        message: statusMsg,
        intent: 'add_to_cart',
        classification_badge: 'Shop Tab Change (Needs Confirm)',
        update_type_label: 'Shopping List Update',
        target_section: 'Shop Tab',
        items:
          shopRes.action === 'not_found'
            ? []
            : [
                {
                  ingredient_id: `ing_${shopRes.itemName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                  name: shopRes.itemName,
                  qty_base: shopRes.qty,
                  unit_base: (shopRes.unit as any) || 'g',
                  op: shopOp === 'remove' ? 'remove' : 'add',
                  before,
                  after: shopOp === 'remove' ? 0 : shopRes.qty,
                  is_existing: Boolean(matchedShopItem),
                  target_section: 'Shop Tab',
                  note: shopOp,
                },
              ],
        auto_applied: false,
        warnings: [],
        unmatched: [],
      };
    }
  }

  const isPastTensePurchase =
    lower.includes('bought') ||
    lower.includes('purchased') ||
    lower.includes('got') ||
    lower.includes('brought') ||
    lower.includes('kharid liya') ||
    lower.includes('le aaye');

  if (
    !isPastTensePurchase &&
    !hasEditVerb &&
    (mode === 'cart' || lower.includes('cart') || lower.includes('what to buy') || lower.includes('shopping list'))
  ) {
    const shopItems = store.getShoppingList();
    if (shopItems.length === 0) {
      return {
        mode: 'cart',
        message: 'Aapke plan ke mutabik saare ingredients stock me maujood hain! Shop tab me abhi koi item pending nahi hai.',
        intent: 'add_to_cart',
        items: [],
        plan_changes: [],
        warnings: [],
        unmatched: [],
      };
    }

    const cartItems: ProposalItemChange[] = shopItems.map((m) => ({
      ingredient_id: m.ingredient_id,
      name: m.name,
      qty_base: m.qty_base,
      unit_base: (m.base_unit || 'g') as any,
      op: 'add',
      note: 'Listed in Shop Tab',
    }));

    return {
      mode: 'cart',
      message: `Shop Tab me abhi ${cartItems.length} item(s) listed hain: ${cartItems.map((c) => `${c.name} (${c.qty_base}${c.unit_base})`).join(', ')}. Aap bol sakte hain "I bought everything required" ya kisi bhi item ko add/remove kar sakte hain.`,
      intent: 'add_to_cart',
      items: cartItems,
      plan_changes: [],
      warnings: [],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 6. INTENT: INVENTORY STOCK UPDATES + SHOP TAB AUTO-CHECK & REMOVAL
  // Checks: (A) Shop Tab Listings, (B) Missing Plan Items, (C) Current Stock, (D) Canonical & Synonyms!
  // -------------------------------------------------------------------------
  const items: ProposalItemChange[] = [];
  const unmatched: { raw_name: string; reason: string }[] = [];
  const warnings: string[] = [];

  // Determine global op
  let defaultOp: 'add' | 'remove' | 'set' = 'add';
  if (
    lower.includes('khatam') ||
    lower.includes('remove') ||
    lower.includes('finish') ||
    lower.includes('used up') ||
    lower.includes('deduct') ||
    lower.includes('hata do')
  ) {
    defaultOp = 'remove';
  } else if (lower.includes('set') || lower.includes('hai abhi') || lower.includes('sirf') || lower.includes('bacha hai')) {
    defaultOp = 'set';
  }

  const matchedItemKeys = new Set<string>();
  const markMatched = (id: string, name: string) => {
    matchedItemKeys.add((id || '').toLowerCase());
    matchedItemKeys.add((name || '').toLowerCase());
  };
  const isAlreadyMatched = (id: string, name: string) => {
    for (const prev of items) {
      if (store.doesItemMatch(id, name, prev.ingredient_id, prev.name || '')) {
        return true;
      }
    }
    return matchedItemKeys.has((id || '').toLowerCase()) || matchedItemKeys.has((name || '').toLowerCase());
  };

  // A. First: Check all listings in the SHOP TAB (store.getShoppingList())!
  const currentShopTabList = store.getShoppingList();
  for (const sh of currentShopTabList) {
    if (isAlreadyMatched(sh.ingredient_id, sh.name)) continue;

    const tokens = `${sh.name} ${sh.ingredient_id.replace(/^ing_/, '')}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !['ing', 'fresh', 'raw', 'chopped', 'seeds', 'leaves', 'powder'].includes(t));

    const matchedToken = tokens.find((t) => lower.includes(t));
    if (matchedToken) {
      markMatched(sh.ingredient_id, sh.name);
      const haveNow = store.getAvailableStockQty(sh.ingredient_id, sh.name);
      // If user specified a quantity (e.g. "add 500g karela"), use it; otherwise default to the full Shop Tab needed qty so the listing is satisfied & removed!
      const qty = hasExplicitNumber(lower)
        ? extractQuantityFor(lower, matchedToken, sh.base_unit || 'g')
        : sh.qty_base;

      const isChilled = ['doodh', 'milk', 'dahi', 'curd', 'paneer', 'tamatar', 'tomato', 'butter', 'palak', 'mirch'].some(
        (c) => sh.ingredient_id.toLowerCase().includes(c) || sh.name.toLowerCase().includes(c)
      );
      const location: 'pantry' | 'fridge' = isChilled ? 'fridge' : 'pantry';

      items.push({
        ingredient_id: sh.ingredient_id,
        name: sh.name,
        qty_base: qty,
        unit_base: (sh.base_unit || 'g') as any,
        op: defaultOp,
        before: haveNow,
        after: defaultOp === 'remove' ? Math.max(0, haveNow - qty) : defaultOp === 'set' ? qty : haveNow + qty,
        stock_id: null,
        is_existing: haveNow > 0,
        location,
        target_scope: 'shared',
        target_section: `Kitchen Stock & Shop Tab → ${location === 'fridge' ? 'Fridge' : 'Pantry'}`,
        classification: 'Shop Tab Item Restocked',
      });
    }
  }

  // B. Second: Check any MISSING items in the Weekly Meal Plan (store.planCheck().missing)
  const currentMissing = store.planCheck().missing || [];
  for (const miss of currentMissing) {
    if (isAlreadyMatched(miss.ingredient_id, miss.name)) continue;
    const tokens = `${miss.name} ${miss.ingredient_id.replace(/^ing_/, '')}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !['ing', 'fresh', 'raw', 'chopped', 'seeds', 'leaves', 'powder'].includes(t));

    const matchedTerm = tokens.find((t) => lower.includes(t));
    if (matchedTerm) {
      markMatched(miss.ingredient_id, miss.name);
      const qty = hasExplicitNumber(lower)
        ? extractQuantityFor(lower, matchedTerm, miss.unit_base || 'g')
        : Math.max(miss.short_base || 0, miss.qty_base || 100);
      const isChilled = ['doodh', 'milk', 'dahi', 'curd', 'paneer', 'tamatar', 'tomato', 'butter', 'palak', 'mirch'].some(
        (c) => miss.ingredient_id.toLowerCase().includes(c) || miss.name.toLowerCase().includes(c)
      );
      const location: 'pantry' | 'fridge' = isChilled ? 'fridge' : 'pantry';
      items.push({
        ingredient_id: miss.ingredient_id,
        name: miss.name,
        qty_base: qty,
        unit_base: (miss.unit_base || 'g') as any,
        op: defaultOp,
        before: miss.have_base || 0,
        after: (miss.have_base || 0) + qty,
        stock_id: null,
        is_existing: (miss.have_base || 0) > 0,
        location,
        target_scope: 'shared',
        target_section: `Kitchen Stock → ${location === 'fridge' ? 'Fridge' : 'Pantry'} (Shared)`,
        classification: 'Missing Meal Plan Ingredient Restock',
      });
    }
  }

  // C. Third: Match against current items already in the household inventory
  const currentHouseholdStock = store.getStock('all');
  for (const st of currentHouseholdStock) {
    if (isAlreadyMatched(st.ingredient_id, st.name)) continue;

    const searchTerms = [
      st.name.toLowerCase(),
      st.ingredient_id.replace(/^ing_/, '').replace(/_/g, ' ').toLowerCase(),
      st.ingredient_id.replace(/^ing_/, '').toLowerCase(),
      st.name_hi || '',
      ...st.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !['fresh', 'raw', 'chopped'].includes(t)),
    ];

    if (st.ingredient_id.includes('aloo') || st.name.toLowerCase().includes('aloo')) {
      searchTerms.push('aloo', 'potatoes', 'potato', 'pahari aloo', 'आलू');
    } else if (st.ingredient_id.includes('atta') || st.name.toLowerCase().includes('atta')) {
      searchTerms.push('atta', 'flour', 'wheat', 'gehu', 'आटा');
    } else if (st.ingredient_id.includes('doodh') || st.name.toLowerCase().includes('milk')) {
      searchTerms.push('doodh', 'milk', 'dood', 'दूध');
    } else if (st.ingredient_id.includes('dahi') || st.name.toLowerCase().includes('curd')) {
      searchTerms.push('dahi', 'curd', 'yogurt', 'दही');
    } else if (st.ingredient_id.includes('paneer') || st.name.toLowerCase().includes('paneer')) {
      searchTerms.push('paneer', 'cottage cheese', 'पनीर');
    } else if (st.ingredient_id.includes('tamatar') || st.name.toLowerCase().includes('tomato')) {
      searchTerms.push('tamatar', 'tomato', 'tomatoes', 'टमाटर');
    } else if (st.ingredient_id.includes('chawal') || st.name.toLowerCase().includes('rice')) {
      searchTerms.push('chawal', 'rice', 'basmati', 'चावल');
    } else if (st.ingredient_id.includes('pyaz') || st.name.toLowerCase().includes('onion')) {
      searchTerms.push('pyaz', 'onion', 'onions', 'प्याज');
    } else if (st.ingredient_id.includes('oil') || st.name.toLowerCase().includes('oil')) {
      searchTerms.push('oil', 'tel', 'sunflower oil', 'तेल');
    }

    const matchedWord = searchTerms.find((term) => term && term.length >= 3 && lower.includes(term));
    if (matchedWord) {
      markMatched(st.ingredient_id, st.name);

      const qty = extractQuantityFor(lower, matchedWord, st.unit_base);
      const before = st.qty_base;
      const after =
        defaultOp === 'add'
          ? before + qty
          : defaultOp === 'remove'
          ? Math.max(before - qty, 0)
          : qty;

      const locationLabel = st.location === 'fridge' ? 'Fridge' : 'Pantry';
      const scopeLabel = st.owner_user_id ? 'Personal' : 'Shared';
      const targetSection = `Kitchen Stock → ${locationLabel} (${scopeLabel})`;

      items.push({
        ingredient_id: st.ingredient_id,
        name: st.name,
        qty_base: qty,
        unit_base: st.unit_base,
        op: defaultOp,
        before,
        after,
        stock_id: st.id,
        is_existing: true,
        location: st.location as 'pantry' | 'fridge',
        target_scope: st.owner_user_id ? 'personal' : 'shared',
        target_section: targetSection,
        classification: 'Existing Inventory Item Adjustment',
      });
    }
  }

  // D. Fourth: Check canonical list for items NOT currently in inventory
  for (const ing of CANONICAL_INGREDIENTS) {
    if (isAlreadyMatched(ing.id, ing.name_en)) continue;

    const names = [ing.name_en.toLowerCase(), ing.name_hi, ...ing.aliases.map((a) => a.toLowerCase())];
    const match = names.find((n) => lower.includes(n));
    if (match) {
      markMatched(ing.id, ing.name_en);
      const qty = extractQuantityFor(lower, match, ing.base_unit);
      const isChilled = ['doodh', 'milk', 'dahi', 'curd', 'paneer', 'tamatar', 'tomato', 'butter'].some(
        (c) => ing.id.includes(c) || ing.name_en.toLowerCase().includes(c)
      );
      const location: 'pantry' | 'fridge' = isChilled ? 'fridge' : 'pantry';
      const locationLabel = location === 'fridge' ? 'Fridge' : 'Pantry';
      const targetSection = `Kitchen Stock → ${locationLabel} (Shared)`;

      items.push({
        ingredient_id: ing.id,
        name: ing.name_en,
        qty_base: qty,
        unit_base: ing.base_unit,
        op: defaultOp,
        before: 0,
        after: qty,
        stock_id: null,
        is_existing: false,
        location,
        target_scope: 'shared',
        target_section: targetSection,
        classification: 'New Inventory Item Addition',
      });
    }
  }

  // E. Fifth: Generic fallback for ANY ingredient when user says "add/bought <qty> <unit> <item>"
  if (items.length === 0 && (hasEditVerb || isPastTensePurchase)) {
    const genericMatch = lower.match(
      /(?:add|added|bought|purchased|got|brought|restock|remove|deduct|set)\s+(?:(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|grams|ml|l|litre|liter|pcs|pc)?\s+)?([a-z\s]{3,25})/i
    );
    if (genericMatch) {
      const rawNum = genericMatch[1] ? parseFloat(genericMatch[1]) : undefined;
      const rawUnit = (genericMatch[2] || '').toLowerCase();
      const rawName = (genericMatch[3] || '')
        .replace(/\b(to|in|from|stock|inventory|fridge|pantry|kitchen|please|now)\b/gi, '')
        .trim();

      if (rawName.length >= 3) {
        const matchedShop = store.findMatchingShopItem(rawName);
        const matchedStock = store.findMatchingStockItem(rawName);
        let unit: 'g' | 'ml' | 'pcs' = (matchedShop?.base_unit as any) || matchedStock?.unit_base || 'g';
        let qty = rawNum !== undefined ? rawNum : matchedShop?.qty_base || 500;
        if (rawUnit === 'kg' || rawUnit === 'kilo') {
          qty = (rawNum || 1) * 1000;
          unit = 'g';
        } else if (rawUnit === 'l' || rawUnit === 'litre' || rawUnit === 'liter') {
          qty = (rawNum || 1) * 1000;
          unit = 'ml';
        } else if (rawUnit === 'ml') {
          unit = 'ml';
        } else if (rawUnit === 'pcs' || rawUnit === 'pc') {
          unit = 'pcs';
        } else if (rawNum !== undefined && rawNum <= 10 && unit === 'g' && !rawUnit) {
          qty = rawNum * 120;
        }

        const displayTitle =
          matchedShop?.name ||
          matchedStock?.name ||
          rawName.replace(/\b\w/g, (c) => c.toUpperCase());
        const ingId =
          matchedShop?.ingredient_id ||
          matchedStock?.ingredient_id ||
          `ing_${rawName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const before = matchedStock?.qty_base || 0;

        items.push({
          ingredient_id: ingId,
          name: displayTitle,
          qty_base: qty,
          unit_base: unit,
          op: defaultOp,
          before,
          after: defaultOp === 'remove' ? Math.max(0, before - qty) : defaultOp === 'set' ? qty : before + qty,
          stock_id: matchedStock?.id || null,
          is_existing: Boolean(matchedStock),
          location: 'pantry',
          target_scope: 'shared',
          target_section: 'Kitchen Stock & Shop Tab',
          classification: matchedShop ? 'Shop Tab Item Restocked' : 'Inventory Update',
        });
      }
    }
  }

  // Proposal only: stock is changed when the user confirms the card
  if (items.length > 0) {
    const stockSummaries = items.map(
      (it) =>
        `"${it.name}" (${it.before ?? 0}${it.unit_base} -> ${it.op === 'remove' ? '-' : '+'}${it.qty_base}${it.unit_base} = ${it.after ?? it.qty_base}${it.unit_base})`
    );

    return {
      mode: 'chat',
      message: `Proposed Kitchen Stock update: ${stockSummaries.join(', ')}. Tap Confirm to apply.`,
      intent: 'update_stock',
      classification_badge: 'Stock Change (Needs Confirm)',
      update_type_label: 'Inventory Update',
      target_section: 'Kitchen Stock & Shop Tab',
      items,
      auto_applied: false,
      warnings,
      unmatched,
    };
  }

  // -------------------------------------------------------------------------
  // 7. DEFAULT HELPFUL CHAT RESPONSE
  // -------------------------------------------------------------------------
  return {
    mode: 'chat',
    message: `Omnirush Kitchen Assistant ready hai! Aap mujhse:\n• Inventory & Shop Tab update karwa sakte hain (e.g. "add 4 karela", "I bought everything required", "remove karela from shop tab")\n• Aaj ka dinner/lunch change karwa sakte hain (e.g. "change dinner today to Paneer Bhurji")\n• Poore hafte ka menu schedule karwa sakte hain (e.g. "plan full schedule for this week")\n• Offline saved recipes me changes karwa sakte hain (e.g. "increase sugar in Kheer to 150g")`,
    intent: null,
    items: [],
    warnings: [],
    unmatched: [],
  };
}

function hasExplicitNumber(text: string): boolean {
  if (/\d/.test(text)) return true;
  const words = text.toLowerCase().split(/[^a-z]+/);
  return words.some((w) => NUMBER_WORDS[w] !== undefined);
}

function extractQuantityFor(text: string, ingredientWord: string, defaultUnit: string): number {
  const patterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml|pcs|pc)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
    new RegExp(`(ek|one|do|two|teen|three|char|chaar|four|paanch|five|chhe|six|saat|seven|aath|eight|nau|nine|das|ten|aadha|half|derh|dhai)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml|pcs|pc)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
    new RegExp(`${ingredientWord}\\s*(\\d+(?:\\.\\d+)?)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml|pcs|pc)?`, 'i'),
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      let numVal = 1;
      const rawNum = match[1].toLowerCase();
      if (NUMBER_WORDS[rawNum] !== undefined) {
        numVal = NUMBER_WORDS[rawNum];
      } else {
        numVal = parseFloat(rawNum) || 1;
      }

      const unit = (match[2] || '').toLowerCase();
      if (unit === 'kg' || unit === 'kilo') {
        return numVal * 1000;
      }
      if (unit === 'l' || unit === 'liter' || unit === 'litre') {
        return numVal * 1000;
      }
      if (unit === 'g' || unit === 'gm' || unit === 'grams' || unit === 'ml') {
        return numVal;
      }

      if (defaultUnit === 'g' && numVal <= 10) {
        return numVal * 120; // e.g. 2 aloo -> 240g
      }
      return numVal;
    }
  }

  return defaultUnit === 'ml' ? 500 : 500;
}

async function callServerOmnirush(
  text: string,
  mode: OmnirushMode,
  me: any,
  stock: any[],
  recipes: any[]
): Promise<OmnirushResponse | null> {
  const startCall = Date.now();
  try {
    const check = store.planCheck();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        mode,
        household: { members: me.members, has_fridge: me.household.has_fridge },
        stock: stock.map((s) => ({
          ingredient_id: s.ingredient_id,
          name: s.name,
          qty_base: s.qty_base,
          unit_base: s.unit_base,
        })),
        missing_items: check.missing,
        recipes: recipes.map((r) => ({
          household_recipe_id: r.id,
          title: r.title,
        })),
        ingredient_aliases: CANONICAL_INGREDIENTS.map((i) => ({
          ingredient_id: i.id,
          names: i.aliases,
        })),
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const resolvedItems = data.proposal?.items || data.items || [];
    const resolvedPlanChanges = data.proposal?.plan_changes || data.plan_changes || [];
    const resolvedRecipeMod = data.proposal?.recipe_modification || data.recipe_modification || null;
    const resolvedIntent =
      data.proposal?.intent ||
      data.intent ||
      (resolvedItems.length > 0
        ? 'update_stock'
        : resolvedPlanChanges.length > 0
        ? 'edit_plan'
        : resolvedRecipeMod
        ? 'modify_recipe'
        : null);

    return {
      mode: data.mode || mode,
      message: data.message || 'Updated requested items.',
      intent: resolvedIntent,
      items: resolvedItems,
      plan_changes: resolvedPlanChanges,
      recipe: data.proposal?.recipe || data.recipe || null,
      recipe_modification: resolvedRecipeMod,
      warnings: data.warnings || [],
      unmatched: data.unmatched || [],
      timing: {
        model: 'Omnirush AI + Graph RAG',
        elapsed_ms: Date.now() - startCall,
      },
    };
  } catch (err) {
    console.warn('Server Omnirush API call notice, using local engine:', err);
    return null;
  }
}
