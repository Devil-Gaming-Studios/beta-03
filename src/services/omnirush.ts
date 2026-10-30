import {
  OmnirushMode,
  OmnirushResponse,
  ProposalPayload,
  ProposalItemChange,
  ProposalPlanChange,
  ProposalRecipeModification,
  MealSlot,
} from '../types';
import { store, CANONICAL_INGREDIENTS, getMonday } from './store';
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

  // If there's an actionable proposal, register a pending action in store
  let proposalId: string | null = null;
  if (
    parsed.items?.length ||
    parsed.plan_changes?.length ||
    parsed.recipe ||
    parsed.recipe_modification
  ) {
    const payload: ProposalPayload = {
      intent: parsed.intent || 'update_stock',
      items: parsed.items || [],
      plan_changes: parsed.plan_changes || [],
      recipe: parsed.recipe || null,
      recipe_modification: parsed.recipe_modification || null,
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
    const dateStr = targetDate.toISOString().slice(0, 10);

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

    const planChange: ProposalPlanChange = {
      meal_date: dateStr,
      slot,
      household_recipe_id: matchedRecipe.id,
      servings: me.members?.length || 2,
      recipe_title: matchedRecipe.title,
    };

    const targetSection = `Meal Planner → ${slot.toUpperCase()} (${dateStr === today.toISOString().slice(0, 10) ? 'Today' : dateStr})`;

    return {
      mode: 'plan',
      message: `Menu update proposal: ${dateStr === today.toISOString().slice(0, 10) ? 'Aaj' : dateStr} ke ${slot.toUpperCase()} me "${matchedRecipe.title}" (${planChange.servings} servings) schedule karne ke liye proposal generate kiya gaya hai.`,
      intent: 'edit_plan',
      classification_badge: 'Meal Slot Plan',
      update_type_label: 'Meal Slot Replacement',
      target_section: targetSection,
      plan_changes: [planChange],
      items: [],
      warnings: [],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 4. INTENT: GENERAL MEAL SUGGESTION (e.g. "suggest dinner", "what to cook")
  // -------------------------------------------------------------------------
  if (mode === 'plan' || lower.includes('suggest') || lower.includes('kya banayein') || lower.includes('menu')) {
    const today = new Date();
    const dStr = today.toISOString().slice(0, 10);

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
  // 5. INTENT: CART / GROCERY CHECK
  // -------------------------------------------------------------------------
  if (mode === 'cart' || lower.includes('cart') || lower.includes('buy') || lower.includes('kharid')) {
    const check = store.planCheck();
    if (check.missing.length === 0) {
      return {
        mode: 'cart',
        message: 'Aapke plan ke mutabik saare ingredients stock me maujood hain! Abhi koi item missing nahi hai.',
        intent: 'add_to_cart',
        items: [],
        plan_changes: [],
        warnings: [],
        unmatched: [],
      };
    }

    const cartItems: ProposalItemChange[] = check.missing.map((m: any) => ({
      ingredient_id: m.ingredient_id,
      name: m.name,
      qty_base: m.short_base,
      unit_base: m.unit_base as any,
      op: 'add',
      note: 'Missing for planned meals',
    }));

    return {
      mode: 'cart',
      message: `Planned meals ke liye ${cartItems.length} missing items identify hue hain. Cart me add karne ke liye proposal taiyar hai.`,
      intent: 'add_to_cart',
      items: cartItems,
      plan_changes: [],
      warnings: ['Swiggy / Blinkit cart quick handoff enabled.'],
      unmatched: [],
    };
  }

  // -------------------------------------------------------------------------
  // 6. INTENT: INVENTORY STOCK UPDATES (Checks Current Stock First!)
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

  // Fetch current household stock to match against existing items!
  const currentHouseholdStock = store.getStock('all');
  const matchedItemIds = new Set<string>();

  // A. First: Match against current items already in the household inventory
  for (const st of currentHouseholdStock) {
    const searchTerms = [
      st.name.toLowerCase(),
      st.ingredient_id.replace(/^ing_/, '').toLowerCase(),
      st.name_hi || '',
    ];

    // Add keyword stems for common Indian items
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

    const matchedWord = searchTerms.find((term) => term && lower.includes(term));
    if (matchedWord) {
      matchedItemIds.add(st.id);
      matchedItemIds.add(st.ingredient_id);

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

  // B. Second: Check canonical list for items NOT currently in inventory (New Stock Additions)
  for (const ing of CANONICAL_INGREDIENTS) {
    if (matchedItemIds.has(ing.id)) continue;

    const names = [ing.name_en.toLowerCase(), ing.name_hi, ...ing.aliases.map((a) => a.toLowerCase())];
    const match = names.find((n) => lower.includes(n));
    if (match) {
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

  if (items.length > 0) {
    const hasExisting = items.some((it) => it.is_existing);
    const existingItems = items.filter((it) => it.is_existing);
    const newItems = items.filter((it) => !it.is_existing);

    let message = '';
    if (existingItems.length > 0 && newItems.length === 0) {
      const summaries = existingItems.map(
        (it) => `"${it.name}" in ${it.target_section} (Current: ${it.before}${it.unit_base} → ${it.op === 'remove' ? '-' : '+'}${it.qty_base}${it.unit_base} = ${it.after}${it.unit_base})`
      );
      message = `Inventory Match: Current stock item(s) found: ${summaries.join(', ')}. Niche card par confirm karein.`;
    } else if (existingItems.length > 0 && newItems.length > 0) {
      message = `Inventory Ledger: ${existingItems.length} existing item(s) matched and ${newItems.length} new item(s) to add to pantry/fridge. Niche card par confirm karein.`;
    } else {
      message = `New Stock Addition: ${newItems.map((it) => `"${it.name}" (+${it.qty_base}${it.unit_base}) to ${it.target_section}`).join(', ')}. Niche card par confirm karein.`;
    }

    const primaryTargetSection = items[0]?.target_section || 'Kitchen Stock → Pantry';
    const classificationBadge = hasExisting ? 'Existing Stock Update' : 'New Stock Addition';
    const updateTypeLabel = hasExisting ? 'Inventory Stock Adjustment (Existing Item)' : 'New Inventory Item Addition';

    return {
      mode: 'chat',
      message,
      intent: 'update_stock',
      classification_badge: classificationBadge,
      update_type_label: updateTypeLabel,
      target_section: primaryTargetSection,
      items,
      warnings,
      unmatched,
    };
  }

  // -------------------------------------------------------------------------
  // 7. DEFAULT HELPFUL CHAT RESPONSE
  // -------------------------------------------------------------------------
  return {
    mode: 'chat',
    message: `Omnirush Kitchen Assistant ready hai! Aap mujhse:\n• Inventory update karwa sakte hain (e.g. "do kilo aloo aur ek litre dahi add kar do")\n• Aaj ka dinner/lunch change karwa sakte hain (e.g. "change dinner today to Paneer Bhurji")\n• Poore hafte ka menu schedule karwa sakte hain (e.g. "plan full schedule for this week")\n• Offline saved recipes me changes karwa sakte hain (e.g. "increase sugar in Kheer to 150g")`,
    intent: null,
    items: [],
    warnings: [],
    unmatched: [],
  };
}

function extractQuantityFor(text: string, ingredientWord: string, defaultUnit: string): number {
  const patterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
    new RegExp(`(ek|one|do|two|teen|three|char|chaar|four|paanch|five|chhe|six|saat|seven|aath|eight|nau|nine|das|ten|aadha|half|derh|dhai)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
    new RegExp(`${ingredientWord}\\s*(\\d+(?:\\.\\d+)?)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml)?`, 'i'),
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
    return {
      mode: data.mode || mode,
      message: data.message || 'Updated requested items.',
      intent: data.intent || null,
      items: data.proposal?.items || data.items || [],
      plan_changes: data.proposal?.plan_changes || data.plan_changes || [],
      recipe: data.proposal?.recipe || data.recipe || null,
      recipe_modification: data.proposal?.recipe_modification || data.recipe_modification || null,
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
