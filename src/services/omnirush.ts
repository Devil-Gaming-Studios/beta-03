import { OmnirushMode, OmnirushResponse, ProposalPayload, ProposalItemChange } from '../types';
import { store, CANONICAL_INGREDIENTS } from './store';

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
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
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

  // 3. Call Server-Side Gemini API endpoint (/api/chat)
  try {
    const serverRes = await callServerOmnirush(trimmed, mode, me, stock, recipes);
    if (serverRes) {
      return finalizeResponse(serverRes, trimmed, injectionSuspected, warnings, started);
    }
  } catch {
    // Fallback to local deterministic kitchen NLP engine
  }

  // 3. Built-in Deterministic Parser for Indian kitchen NLP
  const localParsed = parseLocally(trimmed, mode, stock, recipes, me);
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
  if (parsed.items?.length || parsed.plan_changes?.length || parsed.recipe) {
    const payload: ProposalPayload = {
      intent: parsed.intent || 'update_stock',
      items: parsed.items || [],
      plan_changes: parsed.plan_changes || [],
      recipe: parsed.recipe || null,
    };
    const pending = store.createPendingAction(payload.intent, transcript, payload);
    proposalId = pending.id;
  }

  return {
    ...parsed,
    proposal_id: proposalId,
    elapsed_ms: Date.now() - started,
    timing: {
      model: 'Omnirush Engine (llama/gemini parser)',
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

  // --- MODE: PLAN ---
  if (mode === 'plan' || lower.includes('plan meal') || lower.includes('suggest') || lower.includes('menu')) {
    const today = new Date();
    const planChanges: any[] = [];
    const stockMap = store.getStockMap();

    // Check which recipes have sufficient ingredients
    const availableRecipes = recipes.filter((r) => {
      const detail = store.getRecipeDetail(r.id, 2);
      return detail.missing.length === 0;
    });

    const chosenBreakfast =
      recipes.find((r) => r.slots.includes('breakfast')) || recipes[0];
    const chosenLunch =
      availableRecipes.find((r) => r.slots.includes('lunch')) || recipes[1] || recipes[0];
    const chosenDinner =
      availableRecipes.find((r) => r.slots.includes('dinner') && r.id !== chosenLunch.id) ||
      recipes[2] ||
      recipes[0];

    const dStr = today.toISOString().slice(0, 10);
    planChanges.push({
      meal_date: dStr,
      slot: 'breakfast',
      household_recipe_id: chosenBreakfast.id,
      servings: me.members.length || 2,
      recipe_title: chosenBreakfast.title,
    });
    planChanges.push({
      meal_date: dStr,
      slot: 'lunch',
      household_recipe_id: chosenLunch.id,
      servings: me.members.length || 2,
      recipe_title: chosenLunch.title,
    });
    planChanges.push({
      meal_date: dStr,
      slot: 'dinner',
      household_recipe_id: chosenDinner.id,
      servings: me.members.length || 2,
      recipe_title: chosenDinner.title,
    });

    // Diet cautions reminder
    const cautions = Array.from(
      new Set(me.members.flatMap((m: any) => m.cautions || []))
    );
    let cautionNote = '';
    if (cautions.length > 0) {
      cautionNote = ` (Considering diet cautions: ${cautions.join(', ')}. Note: This is general guidance, not medical advice.)`;
    }

    return {
      mode: 'plan',
      message: `Aapke kitchen stock aur ${me.members.length} members ke hisaab se proposed menu plan taiyar kiya hai: Breakfast me ${chosenBreakfast.title}, Lunch me ${chosenLunch.title}, Dinner me ${chosenDinner.title}.${cautionNote}`,
      intent: 'edit_plan',
      plan_changes: planChanges,
      items: [],
      warnings: [],
      unmatched: [],
    };
  }

  // --- MODE: CART ---
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

    const cartItems: ProposalItemChange[] = check.missing.map((m) => ({
      ingredient_id: m.ingredient_id,
      name: m.name,
      qty_base: m.short_base,
      unit_base: m.unit_base as any,
      op: 'add',
      note: 'Missing for planned meals',
    }));

    return {
      mode: 'cart',
      message: `Planned meals ke liye ${cartItems.length} missing items identify hue hain. Cart me add karne ke liye proposal taiyar hai. (Order confirmation Swiggy/Quick-commerce app me hogi).`,
      intent: 'add_to_cart',
      items: cartItems,
      plan_changes: [],
      warnings: ['Swiggy cart handoff preview: User will review and checkout on quick-commerce app.'],
      unmatched: [],
    };
  }

  // --- MODE: CHAT (Stock updates, recipe questions, etc.) ---
  const words = lower.replace(/,/g, ' ').split(/\s+/);
  const items: ProposalItemChange[] = [];
  const unmatched: { raw_name: string; reason: string }[] = [];
  const warnings: string[] = [];

  // Determine global op
  let defaultOp: 'add' | 'remove' | 'set' = 'add';
  if (lower.includes('khatam') || lower.includes('remove') || lower.includes('finish') || lower.includes('use')) {
    defaultOp = 'remove';
  } else if (lower.includes('set') || lower.includes('hai abhi') || lower.includes('sirf')) {
    defaultOp = 'set';
  }

  // Identify ingredients mentioned
  for (const ing of CANONICAL_INGREDIENTS) {
    const names = [ing.name_en.toLowerCase(), ing.name_hi, ...ing.aliases.map((a) => a.toLowerCase())];
    const match = names.find((n) => lower.includes(n));
    if (match) {
      // Find quantity near this word
      const qty = extractQuantityFor(lower, match, ing.base_unit);
      const stockMap = store.getStockMap();
      const before = stockMap[ing.id] || 0;
      const after =
        defaultOp === 'add'
          ? before + qty
          : defaultOp === 'remove'
          ? Math.max(before - qty, 0)
          : qty;

      items.push({
        ingredient_id: ing.id,
        name: ing.name_en,
        qty_base: qty,
        unit_base: ing.base_unit,
        op: defaultOp,
        before,
        after,
      });
    }
  }

  // If no canonical ingredient found, check for unrecognized food words
  if (items.length === 0) {
    const potentialWords = ['butter', 'bread', 'maggi', 'biscuit', 'pasta', 'cheese', 'mirchi', 'haldi', 'adrak', 'lassan'];
    for (const w of potentialWords) {
      if (lower.includes(w)) {
        unmatched.push({ raw_name: w, reason: 'Unknown ingredient in canonical database' });
      }
    }
  }

  if (items.length > 0) {
    const itemSummary = items
      .map((it) => `${it.op} ${it.qty_base} ${it.unit_base} ${it.name}`)
      .join(', ');
    return {
      mode: 'chat',
      message: `Maine aapki request samajh li: ${itemSummary}. Niche card par click karke confirm karein.`,
      intent: 'update_stock',
      items,
      warnings,
      unmatched,
    };
  }

  if (unmatched.length > 0) {
    return {
      mode: 'chat',
      message: `Kripya note karein: kuch items hamari canonical list me nahi mile (${unmatched.map((u) => u.raw_name).join(', ')}). Baki items add karne ke liye dobara bol sakte hain.`,
      intent: null,
      items: [],
      unmatched,
      warnings,
    };
  }

  // Generic helpful conversation
  return {
    mode: 'chat',
    message: `Omnirush ready hai! Aap stock update kar sakte hain (jaise: 'do kilo aloo aur 1 litre dahi add kar do'), meal plan pooch sakte hain, ya shopping list generate kar sakte hain.`,
    intent: null,
    items: [],
    warnings: [],
    unmatched: [],
  };
}

function extractQuantityFor(text: string, ingredientWord: string, defaultUnit: string): number {
  // Regex looks for numbers or number-words followed optionally by kg, g, l, litre, etc. near the ingredient
  // e.g. "do kilo aloo", "2 kg aloo", "500g dahi", "1 litre doodh", "ek packet"
  const patterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
    new RegExp(`(ek|do|teen|char|chaar|paanch|chhe|saat|aath|nau|das|aadha|half|derh|dhai)\\s*(kilo|kg|g|gm|grams|litre|liter|l|ml)?\\s*(?:of\\s+)?${ingredientWord}`, 'i'),
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

      // Default scale if no unit given
      if (defaultUnit === 'g' && numVal <= 10) {
        // e.g. "2 aloo" -> in standard recipe 1 aloo pc is ~120g, or if user says "2 aloo" -> 240g
        return numVal * 120;
      }
      return numVal;
    }
  }

  // Fallback default
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

    if (!res.ok) {
      console.warn('Server /api/chat responded with status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data || (!data.message && !data.items && !data.plan_changes && !data.proposal)) {
      return null;
    }

    // Adapt format if server returned nested proposal or top-level fields
    let items = data.items || [];
    let plan_changes = data.plan_changes || [];
    let intent = data.intent || null;
    let recipe = data.recipe || null;

    if (data.proposal) {
      if (!items.length && data.proposal.items) items = data.proposal.items;
      if (!plan_changes.length && data.proposal.plan_changes) plan_changes = data.proposal.plan_changes;
      if (!intent && data.proposal.intent) intent = data.proposal.intent;
      if (!recipe && data.proposal.recipe) recipe = data.proposal.recipe;
    }

    // Populate missing before/after for items if not calculated by model
    const stockMap = store.getStockMap();
    const enrichedItems = items.map((it: any) => {
      const current = stockMap[it.ingredient_id] || 0;
      const op = it.op || 'add';
      const before = it.before !== undefined ? it.before : current;
      const after =
        it.after !== undefined
          ? it.after
          : op === 'add'
          ? before + it.qty_base
          : op === 'remove'
          ? Math.max(0, before - it.qty_base)
          : it.qty_base;
      return {
        ...it,
        before,
        after,
      };
    });

    return {
      mode: data.mode || mode,
      message: data.message || 'Updated requested items.',
      intent: intent || (enrichedItems.length ? 'update_stock' : plan_changes.length ? 'edit_plan' : null),
      items: enrichedItems,
      plan_changes,
      recipe,
      warnings: data.warnings || [],
      unmatched: data.unmatched || [],
      timing: {
        model: 'Server Gemini 3.8 Flash',
        elapsed_ms: Date.now() - startCall,
      },
    };
  } catch (err) {
    console.warn('Server Omnirush API call failed, falling back to local engine:', err);
    return null;
  }
}

/**
 * Server-side SSE streaming client for Omnirush responses
 */
export async function streamServerOmnirush(
  text: string,
  mode: OmnirushMode,
  onChunk: (chunk: string) => void,
  onDone?: (fullText: string) => void
): Promise<void> {
  const me = store.getMe();
  const stock = store.getStock();
  const recipes = store.getRecipes();

  const response = await fetch('/api/chat/stream', {
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

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunkStr = decoder.decode(value, { stream: true });
    const lines = chunkStr.split('\n\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.chunk) {
            accumulated += parsed.chunk;
            onChunk(parsed.chunk);
          }
          if (parsed.done && onDone) {
            onDone(parsed.fullText || accumulated);
          }
        } catch {
          // Ignore JSON parse chunk edge cases
        }
      }
    }
  }
}

/**
 * Server-side WebSocket connection for real-time Live API voice conversation
 */
export function connectLiveVoiceWebSocket(options: {
  onAudioChunk: (base64Audio: string) => void;
  onInterrupted?: () => void;
  onError?: (err: any) => void;
  onClose?: () => void;
}) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/live`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.audio) {
        options.onAudioChunk(msg.audio);
      }
      if (msg.interrupted && options.onInterrupted) {
        options.onInterrupted();
      }
      if (msg.error && options.onError) {
        options.onError(new Error(msg.error));
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };

  ws.onerror = (err) => {
    if (options.onError) options.onError(err);
  };

  ws.onclose = () => {
    if (options.onClose) options.onClose();
  };

  return {
    sendAudioChunk: (base64Pcm16k: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ audio: base64Pcm16k }));
      }
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    isOpen: () => ws.readyState === WebSocket.OPEN,
  };
}
