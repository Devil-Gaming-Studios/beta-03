import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load non-empty key-value pairs from .env if present (never overwrite existing env with empty strings)
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const rawVal = trimmed.slice(eqIdx + 1).split('#')[0].trim();
      if (key && rawVal) {
        process.env[key] = rawVal;
      }
    }
  }
} catch {
  // Ignore .env parse errors
}

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '25mb' }));

function getApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

function getAiClient(): GoogleGenAI {
  const key = getApiKey();
  return new GoogleGenAI({
    apiKey: key || undefined,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const agentModel = process.env.GEMINI_MODEL || process.env.GEMINI_AGENT_MODEL || 'gemini-3.8-flash';
const fallbackTextModel = 'gemini-3.8-flash';
const transcribeModel = 'gemini-3.5-transcribe';

import { graphService } from './server/graphService';
import { shopInboxService } from './server/shopInboxService';
import { swiggyOAuthService } from './server/swiggyOAuth';
import { swiggyTokenStore } from './server/swiggyTokenStore';
import { swiggyMcpClient } from './server/swiggyMcpClient';

let systemInstruction = `You are Omnirush, the assistant inside Mast Meals / KitchenSync, a household meal, recipe and kitchen-stock assistant for Indian households. You help with:
1. Updating inventory stock (e.g. add/remove/set ingredients).
2. Changing the menu or specific meal slots (e.g. change tonight's dinner to Paneer Bhurji).
3. Planning or rescheduling the full 7-day week schedule from stock.
4. Customizing offline saved recipes (e.g. increasing sugar in Kheer to 150g, reducing salt in Dal).
5. Shopping lists and dietary advice.

Return only valid JSON matching the format:
{
  "mode": "chat" | "plan" | "cart",
  "message": "helpful natural reply in Hindi, English, or Hinglish",
  "proposal": null | {
    "intent": "edit_plan" | "edit_schedule" | "update_stock" | "modify_recipe" | "add_recipe" | "add_to_cart",
    "items": [{ "ingredient_id": "...", "name": "...", "qty_base": 500, "unit_base": "g"|"ml"|"pcs", "op": "add"|"remove"|"set" }],
    "plan_changes": [{ "meal_date": "YYYY-MM-DD", "slot": "breakfast"|"lunch"|"dinner", "household_recipe_id": "...", "servings": 2, "recipe_title": "..." }],
    "recipe_modification": null | { "recipe_id": "...", "recipe_title": "...", "ingredient_name": "...", "old_qty": 100, "new_qty": 150, "unit": "g", "op": "set"|"add"|"remove" },
    "recipe": null
  },
  "unmatched": [],
  "warnings": []
}`;

try {
  const promptPath = path.resolve(__dirname, 'prompts', 'omnirush.system.txt');
  if (fs.existsSync(promptPath)) {
    systemInstruction = fs.readFileSync(promptPath, 'utf-8');
  }
} catch {
  // Use fallback systemInstruction
}

// ---------------------------------------------------------------------------
// Graph RAG API Endpoints
// ---------------------------------------------------------------------------
app.get('/api/graph/stats', (_req: Request, res: Response) => {
  return res.json(graphService.getStats());
});

app.get('/api/graph/recipes', (req: Request, res: Response) => {
  const { query, diet_pref, is_beginner, cuisine, course, max_time, high_protein, page, limit } = req.query;
  const result = graphService.searchRecipes({
    query: typeof query === 'string' ? query : undefined,
    diet_pref: diet_pref === 'nonveg' ? 'nonveg' : 'veg',
    is_beginner: is_beginner === 'true' || is_beginner === '1',
    cuisine: typeof cuisine === 'string' ? cuisine : undefined,
    course: typeof course === 'string' ? course : undefined,
    max_time: max_time ? Number(max_time) : undefined,
    high_protein: high_protein === 'true',
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
  return res.json(result);
});

app.get('/api/graph/recipes/:id', (req: Request, res: Response): any => {
  const recipe = graphService.getRecipeById(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found in Graph RAG' });
  return res.json(recipe);
});

app.post('/api/graph/suggest-from-stock', (req: Request, res: Response) => {
  const { stock, diet_pref, is_beginner, course, limit } = req.body;
  const stockList = Array.isArray(stock) ? stock : [];
  const suggestions = graphService.suggestFromStock(stockList, {
    diet_pref: diet_pref === 'nonveg' ? 'nonveg' : 'veg',
    is_beginner: Boolean(is_beginner),
    course: typeof course === 'string' ? course : undefined,
    limit: limit ? Number(limit) : 10,
  });
  return res.json(suggestions);
});

app.post('/api/graph/substitutions', (req: Request, res: Response) => {
  const { ingredient } = req.body;
  const subs = graphService.getSubstitutions(String(ingredient || ''));
  return res.json({ substitutions: subs });
});

// ---------------------------------------------------------------------------
// AI Weekly Meal Planner Endpoint: Gemini LLM + Graph RAG + Past Diet Memory
// ---------------------------------------------------------------------------
app.post('/api/plan/auto-generate', async (req: Request, res: Response): Promise<any> => {
  const {
    weekStart,
    days, // Array of { date: 'YYYY-MM-DD', dayKey: 'Mon'..'Sun', varietyMode: 'regular' | 'new' }
    stock,
    userProfile,
    dietMemory,
  } = req.body;

  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: 'days array is required for weekly meal planning' });
  }

  const dietPref: 'veg' | 'nonveg' = userProfile?.diet_pref === 'nonveg' ? 'nonveg' : 'veg';
  const isBeginner = Boolean(userProfile?.is_beginner_cook);
  const dietGoals: string[] = Array.isArray(dietMemory?.diet_goals)
    ? dietMemory.diet_goals
    : Array.isArray(userProfile?.diet_goals)
    ? userProfile.diet_goals
    : ['protein_rich'];
  const preferredRegions: string[] = Array.isArray(dietMemory?.preferred_regions)
    ? dietMemory.preferred_regions
    : ['North Indian', 'South Indian', 'Maharashtrian'];
  const pastDishes = Array.isArray(dietMemory?.past_regular_dishes) ? dietMemory.past_regular_dishes : [];
  const commonIngredients: string[] = Array.isArray(dietMemory?.common_ingredients)
    ? dietMemory.common_ingredients
    : [];
  const commonRegions: string[] = Array.isArray(dietMemory?.common_regions)
    ? dietMemory.common_regions
    : preferredRegions;

  const stockList = Array.isArray(stock) ? stock : [];
  const stockNames = stockList.map((s: any) => s.name || s.ingredient_id || String(s));

  // 1. Retrieve Graph RAG Candidates split into Regular vs. New Discovery pools
  const { regularCandidates, newDiscoveryCandidates } = graphService.getWeeklyPlanCandidates({
    stock: stockNames,
    diet_pref: dietPref,
    is_beginner: isBeginner,
    diet_goals: dietGoals,
    preferred_regions: preferredRegions,
    past_regular_dishes: pastDishes,
    common_ingredients: commonIngredients,
    common_regions: commonRegions,
  });

  // Ensure user's explicit past regular dishes from localStorage are at the top of regularCandidates
  const mergedRegularCandidates = [
    ...pastDishes.map((p: any) => ({
      id: p.recipe_id || `rec_${String(p.title || 'regular').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: p.title,
      cuisine: p.cuisine || 'North Indian',
      course: p.course || 'Main Course',
      protein_g: 15,
      kcal: 340,
      keyIngredients: p.ingredients || [],
      dietTags: dietGoals.includes('diabetes')
        ? ['Habitual Favorite', 'Diabetes-Friendly']
        : ['Habitual Favorite', 'High Protein'],
      isPastFavorite: true,
    })),
    ...regularCandidates,
  ].slice(0, 22);

  const pastDishNamesLower = new Set(
    pastDishes.map((p: any) => String(p.title || '').toLowerCase().trim()).filter(Boolean)
  );

  // Filter discovery candidates again to guarantee zero overlap with past habitual dishes
  const strictDiscoveryCandidates = newDiscoveryCandidates.filter(
    (c) => !pastDishNamesLower.has(String(c.name || '').toLowerCase().trim())
  );

  const prompt = `You are the KitchenSync AI Nutritionist & Weekly Meal Planner for an Indian household.
Plan a complete 7-day meal schedule (breakfast, lunch, dinner for each of the 7 days = 21 meals total).

USER DIETARY & HEALTH PROFILE:
- Strict Dietary Preference: ${dietPref === 'veg' ? '100% Vegetarian (NEVER suggest eggs, meat, fish, or chicken)' : 'Non-Veg Allowed'}
- Cooking Skill: ${isBeginner ? 'Beginner (prefer <= 30 min, low-effort recipes)' : 'Intermediate/Experienced'}
- Active Health & Diet Goals: ${dietGoals.length > 0 ? dietGoals.join(', ') : 'Balanced Indian Home Diet'}
  * If "protein_rich" is active: prioritize high-protein pulses, paneer, soya, chana, moong, curd, sprouts, besan, or high-protein Graph RAG dishes.
  * If "diabetes" is active: strictly choose low-GI, diabetic-friendly dishes (avoid kheer, halwa, deep-fried sweets, or white-sugar heavy items; favor whole grains, methi, palak, moong, karela, jowar/bajra, dal, paneer).
  * If "heart" or "low_oil" is active: favor steamed, roasted, or light tadka dishes.
- Preferred Regional Cuisines: ${preferredRegions.join(', ')}
- Household Cautions: ${JSON.stringify(userProfile?.cautions || [])}

CURRENT KITCHEN INVENTORY (STOCK):
${JSON.stringify(
  stockList.map((s: any) => ({
    name: s.name,
    qty: `${s.qty_base} ${s.unit_base}`,
    location: s.location,
  }))
)}

USER'S PAST HABITUAL DIET (FROM LOCALSTORAGE MULTI-WEEK HISTORY):
- Commonly Eaten Dishes: ${JSON.stringify(pastDishes.map((d: any) => ({ id: d.recipe_id, title: d.title, cuisine: d.cuisine, times_eaten: d.times_eaten })))}
- Common Staple Ingredients: ${JSON.stringify(commonIngredients)}
- Common Regions: ${JSON.stringify(commonRegions)}

7-DAY VARIETY SCHEDULE (REGULAR vs. NEW DISCOVERY DAYS):
${JSON.stringify(days)}

GRAPH RAG CANDIDATES FOR "regular" DAYS (Habitual diet + stock match):
${JSON.stringify(mergedRegularCandidates.slice(0, 16))}

GRAPH RAG CANDIDATES FOR "new" DAYS (Novel dishes NOT in user's regular history, matched via Graph RAG by region, ingredients, and health profile):
${JSON.stringify(strictDiscoveryCandidates.slice(0, 20))}

STRICT PLANNING RULES:
1. Return exactly 21 meals (breakfast, lunch, dinner for each of the 7 dates in "days").
2. For any day where varietyMode === "regular":
   - Set variety_type = "regular".
   - Pick dishes from the user's Past Habitual Diet or GRAPH RAG CANDIDATES FOR "regular" DAYS that align with what the user normally eats and their current stock.
   - In ai_reason, explain how it matches their regular habitual diet, stock ingredients, and health goal (${dietGoals.join('/')}).
3. For any day where varietyMode === "new":
   - Set variety_type = "new".
   - MUST pick novel dishes from GRAPH RAG CANDIDATES FOR "new" DAYS that the user does NOT normally eat (NEVER pick any dish from Commonly Eaten Dishes on a "new" day!).
   - Ensure the new dish still strictly respects ${dietPref} and health goals (${dietGoals.join(', ')}) and shares ingredients/regional affinity from Graph RAG.
   - In ai_reason, highlight why this is a great NEW discovery dish for their ${dietGoals.join('/')} profile and which stock/regional graph connection it uses.
4. Use the exact "id" from the Graph RAG candidate as "recipe_id" whenever picking from the candidate lists, and keep "title" clear and authentic.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: 'Brief 1-2 sentence summary of how the week was planned across Regular and New Discovery days, inventory, and health goals.',
      },
      meals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            meal_date: { type: Type.STRING, description: 'YYYY-MM-DD matching one of the 7 days' },
            day_key: { type: Type.STRING, description: 'Mon, Tue, Wed, Thu, Fri, Sat, or Sun' },
            slot: { type: Type.STRING, description: 'breakfast, lunch, or dinner' },
            recipe_id: { type: Type.STRING, description: 'Recipe ID from Graph RAG candidates or past regular dishes' },
            title: { type: Type.STRING, description: 'Full dish title' },
            cuisine: { type: Type.STRING, description: 'Regional cuisine (e.g. North Indian, South Indian, Maharashtrian, Gujarati)' },
            variety_type: { type: Type.STRING, description: 'Must be "regular" or "new" matching that day\'s varietyMode' },
            servings: { type: Type.NUMBER, description: 'Default 2' },
            protein_g: { type: Type.NUMBER, description: 'Estimated protein in grams per serving' },
            kcal: { type: Type.NUMBER, description: 'Estimated calories per serving' },
            diet_tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Short tags like "High Protein", "Diabetes-Friendly", "Stock Match", "Past Favorite", "New Discovery"',
            },
            ai_reason: {
              type: Type.STRING,
              description: 'Concise 1-sentence reason explaining stock usage, health goal fit, and Regular vs. New Discovery selection.',
            },
          },
          required: ['meal_date', 'slot', 'recipe_id', 'title', 'cuisine', 'variety_type', 'protein_g', 'kcal', 'ai_reason'],
        },
      },
    },
    required: ['summary', 'meals'],
  };

  try {
    const ai = getAiClient();
    let response;
    let usedModel = agentModel;
    try {
      response = await ai.models.generateContent({
        model: agentModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (primaryErr: any) {
      console.warn(`Primary planner model (${agentModel}) error, trying ${fallbackTextModel}:`, primaryErr?.message);
      usedModel = fallbackTextModel;
      response = await ai.models.generateContent({
        model: fallbackTextModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    }

    const rawText = (response.text || '{}').trim();
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed.meals) && parsed.meals.length > 0) {
      return res.json({
        weekStart,
        summary: parsed.summary || '7-day AI meal plan generated using Gemini + Graph RAG.',
        meals: parsed.meals,
        engine: usedModel,
        graphStats: {
          regularCandidatesCount: mergedRegularCandidates.length,
          discoveryCandidatesCount: strictDiscoveryCandidates.length,
        },
      });
    }
    throw new Error('Empty meals array from LLM');
  } catch (err: any) {
    console.warn('Gemini auto-plan fallback to deterministic Graph RAG planner:', err?.message);
    // Deterministic Graph RAG fallback that strictly honors regular vs new days and diet goals
    const slots: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];
    const fallbackMeals: any[] = [];
    let regIdx = 0;
    let newIdx = 0;

    const regPool = mergedRegularCandidates.length > 0 ? mergedRegularCandidates : strictDiscoveryCandidates;
    const discPool = strictDiscoveryCandidates.length > 0 ? strictDiscoveryCandidates : mergedRegularCandidates;

    for (const dayObj of days) {
      const isNewDay = dayObj.varietyMode === 'new';
      for (const slot of slots) {
        const chosen = isNewDay
          ? discPool[newIdx++ % Math.max(discPool.length, 1)]
          : regPool[regIdx++ % Math.max(regPool.length, 1)];

        const goalLabel = dietGoals.includes('diabetes')
          ? 'Diabetes-Friendly Low-GI'
          : dietGoals.includes('protein_rich')
          ? 'High-Protein'
          : 'Balanced';

        fallbackMeals.push({
          meal_date: dayObj.date,
          day_key: dayObj.dayKey,
          slot,
          recipe_id: chosen?.id || 'rec_dal_01',
          title: chosen?.name || 'Dal Tadka & Roti',
          cuisine: chosen?.cuisine || 'North Indian',
          variety_type: isNewDay ? 'new' : 'regular',
          servings: 2,
          protein_g: chosen?.protein_g || 14,
          kcal: chosen?.kcal || 320,
          diet_tags: isNewDay
            ? ['New Graph RAG Discovery', goalLabel]
            : ['Regular Habitual Diet', goalLabel],
          ai_reason: isNewDay
            ? `New Graph RAG discovery from ${chosen?.cuisine || 'Indian'} cuisine matching your ${goalLabel} goal and kitchen stock.`
            : `Planned from your habitual regular diet history and available kitchen stock (${goalLabel}).`,
        });
      }
    }

    return res.json({
      weekStart,
      summary: `Planned 21 meals across Regular and New Discovery days tailored to your ${dietGoals.join(' & ') || 'household'} profile and Graph RAG recipe matches.`,
      meals: fallbackMeals,
      engine: 'graph-rag-planner',
      graphStats: {
        regularCandidatesCount: mergedRegularCandidates.length,
        discoveryCandidatesCount: strictDiscoveryCandidates.length,
      },
    });
  }
});


// ---------------------------------------------------------------------------
// Vision Scanning Endpoint: Real Receipt OCR & Fridge/Pantry Scan with Gemini
// ---------------------------------------------------------------------------
app.post('/api/vision/scan', async (req: Request, res: Response): Promise<any> => {
  const { imageBase64, mimeType, kind } = req.body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      error: 'Please upload, paste, or capture an image of a receipt or fridge/pantry shelf.',
    });
  }

  const key = getApiKey();
  if (!key) {
    return res.status(500).json({
      error: 'Gemini API key is not configured on the server. Please check Settings > Secrets.',
    });
  }

  try {
    const ai = getAiClient();
    const headerMatch = imageBase64.match(/^data:([^;]+);base64,/i);
    const resolvedMimeType =
      (mimeType && typeof mimeType === 'string' && mimeType.trim()) ||
      (headerMatch ? headerMatch[1] : 'image/jpeg');
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, '').trim();

    const prompt =
      kind === 'receipt'
        ? `You are a high-precision OCR & grocery receipt parser for Indian households (Blinkit, Zepto, Swiggy Instamart, BigBasket, DMart, Reliance Smart, local kirana paper bills, or handwritten shopping lists).
Carefully read ALL visible text on the uploaded image.
1. Extract the store/merchant name (merchantOrSource), bill date (billDate), total bill amount (totalAmount), and a concise summary of the OCR text read from the image (rawTextSummary).
2. Extract every food, grocery, vegetable, dairy, spice, beverage, or kitchen item listed on the receipt.
   - Convert quantities into base units:
     * Weight in grams ("g"): e.g. 1 kg = 1000 g, 500 g = 500 g, 250 gm = 250 g, 5 kg = 5000 g. If multiple packs (e.g. 2 x 500g), multiply to get total qty_base (1000).
     * Volume in milliliters ("ml"): e.g. 1 L / 1 Litre = 1000 ml, 500 ml = 500 ml, 2 x 500 ml = 1000 ml.
     * Count in pieces ("pcs"): e.g. 6 pcs, 12 eggs, 1 bunch, 1 packet (only use "pcs" when weight/volume in g/ml is not printed).
   - Provide the Hindi name (name_hi) in Devanagari alongside the English/brand name (name).
   - Provide rawLineText with the exact text/pack size read from the receipt line, and price (e.g. "₹45.00") if visible.
   - Set location to "fridge" for dairy (milk, curd/dahi, paneer, butter, cheese), fresh vegetables/fruits/herbs (tomatoes, coriander, chillies, spinach, ginger), and eggs/meat; set "pantry" for grains, atta, rice, dal, oil, ghee, spices, sugar, salt, dry snacks, and packaged goods.
   - Set targetScope to "shared" for staple cooking ingredients (atta, rice, dal, oil, spices, onions, potatoes, tomatoes, milk) and "personal" for personal snacks, chocolates, single-serve curd/drinks, or personal items.
   - If the image is NOT a receipt or has no grocery items, still describe what text/objects you see in rawTextSummary and return items: [].`
        : `You are a computer vision kitchen inventory analyzer for Indian households.
Carefully inspect the uploaded photo of a fridge, pantry shelf, countertop, or grocery bag.
1. Set merchantOrSource to a short label of what the photo shows (e.g. "Refrigerator Shelf", "Pantry Countertop", "Vegetable Basket") and rawTextSummary to a clear description of the visible items and any readable package labels.
2. Identify every visible food ingredient, vegetable, fruit, dairy packet/tub, bottle, grain jar, or packaged grocery item:
   - Estimate the quantity in base units: grams ("g") for solid foods/vegetables/grains, milliliters ("ml") for milk/curd/oils/liquids, or pieces ("pcs") for whole countable items like eggs, lemons, packets.
   - Provide both English name (name) and Hindi name in Devanagari (name_hi).
   - Provide rawLineText describing the visual appearance or package text (e.g. "1 opened tub ~400ml", "Approx 6 medium tomatoes").
   - Set location to "fridge" for perishables/dairy/fresh produce and "pantry" for dry goods/grains/spices/oils.
   - Set targetScope to "shared" for common cooking staples/vegetables and "personal" for individual snacks/drinks.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        merchantOrSource: {
          type: Type.STRING,
          description: 'Store/platform name on the receipt or scene title for fridge/pantry photo.',
        },
        billDate: {
          type: Type.STRING,
          description: 'Date printed on the receipt if visible, otherwise empty string.',
        },
        totalAmount: {
          type: Type.STRING,
          description: 'Total bill amount printed on the receipt if visible (e.g. ₹340.00), otherwise empty string.',
        },
        rawTextSummary: {
          type: Type.STRING,
          description: 'Summary of the raw OCR text read from the receipt or visual scene description.',
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Extracted item name (e.g. Amul Taaza Milk, Chakki Atta, Desi Tomatoes).' },
              name_hi: { type: Type.STRING, description: 'Hindi name in Devanagari (e.g. दूध, आटा, टमाटर).' },
              rawLineText: { type: Type.STRING, description: 'Exact line text or pack size read from the receipt/package.' },
              price: { type: Type.STRING, description: 'Line item price if printed on the receipt (e.g. ₹64), otherwise empty string.' },
              qty_base: { type: Type.NUMBER, description: 'Total quantity converted to base unit (g, ml, or pcs).' },
              unit_base: { type: Type.STRING, description: 'Must be one of: g, ml, pcs' },
              location: { type: Type.STRING, description: 'Must be one of: fridge, pantry' },
              targetScope: { type: Type.STRING, description: 'Must be one of: shared, personal' },
              confidence: { type: Type.NUMBER, description: 'OCR/detection confidence from 0.0 to 1.0' },
              is_estimate: { type: Type.BOOLEAN, description: 'True if visual estimate, false if exact weight/volume read from text' },
            },
            required: ['name', 'qty_base', 'unit_base', 'location', 'targetScope'],
          },
        },
      },
      required: ['merchantOrSource', 'rawTextSummary', 'items'],
    };

    let response;
    let usedModel = agentModel;
    try {
      response = await ai.models.generateContent({
        model: agentModel,
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: resolvedMimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (primaryErr: any) {
      console.warn(`Primary vision model (${agentModel}) error, trying ${fallbackTextModel}:`, primaryErr?.message);
      usedModel = fallbackTextModel;
      response = await ai.models.generateContent({
        model: fallbackTextModel,
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: resolvedMimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    }

    const rawOutput = (response.text || '{}').trim();
    const cleanedJson = rawOutput.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleanedJson);

    const rawItems = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    const normalizedItems = rawItems.map((it: any) => ({
      name: String(it.name || 'Scanned Item').trim(),
      name_hi: it.name_hi ? String(it.name_hi).trim() : undefined,
      rawLineText: it.rawLineText ? String(it.rawLineText).trim() : undefined,
      price: it.price ? String(it.price).trim() : undefined,
      qty_base: Math.max(1, Number(it.qty_base) || 1),
      unit_base: ['g', 'ml', 'pcs'].includes(String(it.unit_base).toLowerCase())
        ? String(it.unit_base).toLowerCase()
        : 'g',
      location: String(it.location).toLowerCase() === 'fridge' ? 'fridge' : 'pantry',
      targetScope: String(it.targetScope).toLowerCase() === 'personal' ? 'personal' : 'shared',
      confidence: typeof it.confidence === 'number' ? it.confidence : 0.92,
      is_estimate: Boolean(it.is_estimate ?? (kind !== 'receipt')),
    }));

    return res.json({
      kind: kind || 'receipt',
      extractedAt: new Date().toISOString(),
      merchantOrSource: parsed.merchantOrSource || (kind === 'receipt' ? 'Scanned Receipt' : 'Fridge / Pantry Scan'),
      billDate: parsed.billDate || '',
      totalAmount: parsed.totalAmount || '',
      rawTextSummary: parsed.rawTextSummary || '',
      items: normalizedItems,
      engine: usedModel,
    });
  } catch (err: any) {
    console.error('Gemini vision scan failed:', err);
    return res.status(500).json({
      error: `Vision OCR analysis failed: ${err?.message || 'Unable to process image'}. Please try a clearer image.`,
    });
  }
});

// ---------------------------------------------------------------------------
// Shop Chat Listener & Telegram Bot Ingestion: /api/shop-inbox
// ---------------------------------------------------------------------------
app.post('/api/shop-inbox', async (req: Request, res: Response): Promise<any> => {
  // 1. Rate limiting (max 30 requests per minute per IP / token)
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string) || '';
  const rateKey = `${clientIp}_${String(authHeader).slice(0, 20)}`;
  if (!shopInboxService.checkRateLimit(rateKey)) {
    return res.status(429).json({ error: 'Rate limit exceeded for shop inbox submissions. Please slow down.' });
  }

  // 2. Auth token validation (Bearer token or X-Auth-Token)
  let token = '';
  if (typeof authHeader === 'string') {
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  }
  if (!token && process.env.APP_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: missing Authorization token' });
  }
  if (process.env.APP_AUTH_TOKEN && token !== process.env.APP_AUTH_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: invalid Authorization token' });
  }

  // 3. Payload validation
  const { source, sender, text, timestamp } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }
  const validSources = ['whatsapp', 'telegram', 'telegram_bot', 'manual', 'test'];
  const normalizedSource = validSources.includes(source) ? (source as any) : 'manual';

  try {
    const inboxItem = await shopInboxService.ingestShopMessage({
      source: normalizedSource,
      sender: sender || 'Shop Contact',
      text: text.trim(),
      timestamp: timestamp ? Number(timestamp) : Date.now(),
    });

    return res.status(201).json({
      success: true,
      message: 'Shop message received and stored in pending inbox for user confirmation.',
      item: inboxItem,
    });
  } catch (err: any) {
    console.error('Failed to process shop message into inbox:', err);
    return res.status(500).json({ error: `Failed to process shop message: ${err?.message || 'Internal error'}` });
  }
});

app.get('/api/shop-inbox', (req: Request, res: Response) => {
  const { status } = req.query;
  const items = status === 'all'
    ? shopInboxService.getAllItems()
    : shopInboxService.getPendingItems();
  return res.json({ items });
});

app.post('/api/shop-inbox/:id/apply', (req: Request, res: Response): any => {
  const { items } = req.body;
  const applied = shopInboxService.markApplied(req.params.id, Array.isArray(items) ? items : undefined);
  if (!applied) {
    return res.status(404).json({ error: 'Shop inbox item not found' });
  }
  return res.json({ success: true, item: applied });
});

app.delete('/api/shop-inbox/:id', (req: Request, res: Response): any => {
  const deleted = shopInboxService.deleteItem(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Shop inbox item not found' });
  }
  return res.json({ success: true, message: 'Shop inbox item removed' });
});

app.post('/api/telegram-webhook', async (req: Request, res: Response): Promise<any> => {
  // Validate secret token if sent or configured
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  const configuredSecret = process.env.TELEGRAM_BOT_SECRET_TOKEN || 'mastmeals_telegram_secret';
  if (secretHeader && secretHeader !== configuredSecret) {
    console.warn('Telegram webhook rejected: secret token mismatch');
    return res.status(403).json({ error: 'Invalid secret token' });
  }

  const update = req.body;
  const msg = update?.message || update?.edited_message || update?.channel_post;
  if (!msg || !msg.text) {
    return res.status(200).json({ ok: true, ignored: 'No text message in update' });
  }

  // Chat-ID allow-list enforcement
  const allowedChatIdsStr = process.env.TELEGRAM_ALLOWED_CHAT_IDS || '';
  if (allowedChatIdsStr && allowedChatIdsStr.trim() !== '*') {
    const allowedChatIds = allowedChatIdsStr.split(',').map((id) => id.trim());
    const chatId = String(msg.chat?.id || '');
    const senderId = String(msg.from?.id || '');
    if (!allowedChatIds.includes(chatId) && !allowedChatIds.includes(senderId)) {
      console.warn(`Telegram webhook: rejected unauthorized chat ID ${chatId} / sender ${senderId}`);
      return res.status(200).json({ ok: true, ignored: 'Chat ID not in allow-list' });
    }
  }

  const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') ||
    msg.from?.username ||
    msg.chat?.title ||
    'Telegram Shop Contact';

  try {
    const inboxItem = await shopInboxService.ingestShopMessage({
      source: 'telegram_bot',
      sender: senderName,
      text: msg.text,
      timestamp: (msg.date ? Number(msg.date) * 1000 : Date.now()),
    });

    return res.status(200).json({ ok: true, inboxId: inboxItem.id });
  } catch (err: any) {
    console.error('Telegram bot webhook processing error:', err);
    return res.status(200).json({ ok: true, error: err?.message });
  }
});

// ---------------------------------------------------------------------------
// Official Swiggy OAuth 2.1 + PKCE & MCP Integration API
// ---------------------------------------------------------------------------
function getRequestUserId(req: Request): string {
  const customId = req.headers['x-user-id'];
  if (typeof customId === 'string' && customId.trim()) {
    return customId.trim();
  }
  return 'usr_alpha';
}

// 1. GET /api/swiggy/connect - Initiates PKCE OAuth authorization flow
app.get('/api/swiggy/connect', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = getRequestUserId(req);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const clientRedirectUri = typeof req.query.redirect_uri === 'string' && req.query.redirect_uri.trim()
      ? req.query.redirect_uri.trim()
      : undefined;
    const redirectUri = swiggyOAuthService.getRedirectUri(clientRedirectUri, host, protocol);
    const { authorizationUrl, state } = await swiggyOAuthService.getAuthorizationUrl(userId, redirectUri);
    return res.json({
      success: true,
      authorizationUrl,
      state,
      redirectUri,
    });
  } catch (err: any) {
    console.error('Failed to initiate Swiggy OAuth connection:', err);
    return res.status(500).json({ error: err?.message || 'Failed to start Swiggy connection flow' });
  }
});

// 2. GET /api/swiggy/callback - Handles authorization code exchange
app.get('/api/swiggy/callback', async (req: Request, res: Response): Promise<any> => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    const desc = error_description ? String(error_description) : String(error);
    return res.send(`<!DOCTYPE html><html><head><title>Authentication Failed</title></head><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'SWIGGY_AUTH_ERROR', error: ${JSON.stringify(desc)} }, '*');
        setTimeout(function() { window.close(); }, 1500);
      } else {
        window.location.href = '/?swiggy_error=' + encodeURIComponent(${JSON.stringify(desc)});
      }
    </script><div style="font-family:sans-serif;padding:30px;text-align:center;">
      <h3 style="color:#d9534f;">Swiggy Authentication Failed</h3>
      <p>${desc}</p>
      <p style="color:#666;">This window will close automatically...</p>
    </div></body></html>`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter in OAuth callback');
  }

  try {
    await swiggyOAuthService.handleCallback(String(code), String(state));
    return res.send(`<!DOCTYPE html><html><head><title>Swiggy Connected</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#FAF9F6;">
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'SWIGGY_AUTH_SUCCESS' }, '*');
            setTimeout(function() { window.close(); }, 800);
          } else {
            window.location.href = '/?swiggy=connected';
          }
        } catch(e) {
          window.location.href = '/?swiggy=connected';
        }
      </script>
      <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <div style="font-size:32px;margin-bottom:12px;">🎉</div>
        <h3 style="color:#FC8019;margin:0 0 8px;">Swiggy Account Connected!</h3>
        <p style="color:#4B5563;font-size:14px;margin:0 0 16px;">Verifying OAuth credentials and discovering MCP tools...</p>
        <p style="color:#9CA3AF;font-size:12px;">You can now close this window if it does not close automatically.</p>
      </div>
    </body></html>`);
  } catch (err: any) {
    console.error('Swiggy OAuth callback error:', err);
    const msg = err?.message || 'Failed to complete OAuth token exchange';
    return res.status(400).send(`<!DOCTYPE html><html><head><title>Connection Error</title></head><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'SWIGGY_AUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
        setTimeout(function() { window.close(); }, 2000);
      } else {
        window.location.href = '/?swiggy_error=' + encodeURIComponent(${JSON.stringify(msg)});
      }
    </script><div style="font-family:sans-serif;padding:30px;text-align:center;">
      <h3 style="color:#d9534f;">OAuth Exchange Failed</h3>
      <p>${msg}</p>
    </div></body></html>`);
  }
});

// 3. GET /api/swiggy/status - Verifies real connection, checks expiration, lists discovered tools
app.get('/api/swiggy/status', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  const tokens = swiggyTokenStore.getTokens(userId);

  if (!tokens || !tokens.accessToken) {
    return res.json({
      isConnected: false,
      userProfile: null,
      availableTools: [],
    });
  }

  // Validate or auto-refresh token
  try {
    await swiggyOAuthService.getValidAccessToken(userId);
  } catch (err: any) {
    return res.json({
      isConnected: false,
      expired: true,
      error: 'Swiggy access token expired. Reconnect required.',
      userProfile: null,
      availableTools: [],
    });
  }

  // Query live MCP tool definitions
  let availableTools: any[] = [];
  try {
    const endpoints = await swiggyMcpClient.listTools(userId);
    availableTools = endpoints.flatMap((e) => e.tools);
  } catch (mcpErr: any) {
    console.warn('Swiggy MCP tools query notice:', mcpErr?.message);
  }

  return res.json({
    isConnected: true,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    userProfile: tokens.userProfile || { name: 'Swiggy User' },
    availableTools,
  });
});

// 4. POST /api/swiggy/disconnect - Disconnects account and revokes tokens
app.post('/api/swiggy/disconnect', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  try {
    await swiggyOAuthService.disconnect(userId);
    return res.json({ success: true, message: 'Swiggy account successfully disconnected.' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to disconnect Swiggy account' });
  }
});

// 5. GET /api/swiggy/tools - Discovered Swiggy MCP tool schemas
app.get('/api/swiggy/tools', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  try {
    const endpoints = await swiggyMcpClient.listTools(userId);
    return res.json({ success: true, endpoints });
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || 'Failed to retrieve Swiggy MCP tools' });
  }
});

// 6. POST /api/swiggy/search - Live grocery product lookup via MCP
app.post('/api/swiggy/search', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  const { query, lat, lng } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const items = await swiggyMcpClient.searchProducts(
      userId,
      query,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined
    );
    return res.json({ success: true, query, items });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to search Swiggy MCP catalog' });
  }
});

// 7. POST /api/swiggy/cart/preview - Computes cart preview with verified fees without ordering
app.post('/api/swiggy/cart/preview', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  try {
    const preview = await swiggyMcpClient.previewCart(userId, items);
    return res.json({ success: true, preview });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to preview Swiggy cart' });
  }
});

// 8. POST /api/swiggy/cart/confirm - Performs real MCP cart update with explicit user confirmation
app.post('/api/swiggy/cart/confirm', async (req: Request, res: Response): Promise<any> => {
  const userId = getRequestUserId(req);
  const { confirmed, items } = req.body;

  if (!confirmed) {
    return res.status(400).json({ error: 'Explicit user confirmation is required to modify Swiggy cart' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  try {
    const result = await swiggyMcpClient.confirmCart(userId, items);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Swiggy MCP cart modification failed' });
  }
});


// ---------------------------------------------------------------------------
// Speech-to-Text (STT) Routing API: Shruti, Cactus Whisper & Sarvam Saaras v3
// ---------------------------------------------------------------------------
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

app.post('/api/stt/transcribe', async (req: Request, res: Response): Promise<any> => {
  const { textCandidate, engine, languageHint, audioBase64, mimeType } = req.body;
  const input = (textCandidate || '').trim();

  // Detect language if not provided
  const isDevanagari = /[\u0900-\u097F]/.test(input);
  const hindiKeywords = ['aloo', 'pyaz', 'tamatar', 'adrak', 'lasun', 'dhaniya', 'paneer', 'dahi', 'atta', 'chawal', 'dal', 'mirchi', 'khatam', 'karo', 'kar do', 'banao', 'kitna', 'kilo', 'chamach'];
  const englishKeywords = ['add', 'remove', 'potato', 'onion', 'tomato', 'milk', 'bread', 'eggs', 'flour', 'suggest', 'dinner', 'lunch'];

  const lower = input.toLowerCase();
  const hasHindi = isDevanagari || hindiKeywords.some((k) => lower.includes(k));
  const hasEnglish = englishKeywords.some((k) => lower.includes(k));

  let detectedLang: 'hi' | 'en' | 'hinglish' = languageHint || 'hinglish';
  if (isDevanagari) detectedLang = 'hi';
  else if (hasHindi && hasEnglish) detectedLang = 'hinglish';
  else if (hasHindi) detectedLang = 'hi';
  else if (hasEnglish) detectedLang = 'en';

  // Determine engine
  let targetEngine = engine || (detectedLang === 'en' ? 'cactus_whisper' : 'shruti');

  // Match ingredients from Graph RAG & Indian kitchen aliases
  const allIngredients = graphService.getIngredients();
  const matchedIngredients: string[] = [];
  const commonIndianKitchenTerms = [
    'aloo', 'alu', 'pyaz', 'kanda', 'tamatar', 'adrak', 'lasun', 'lehsun', 'dhaniya',
    'paneer', 'dahi', 'atta', 'chawal', 'dal', 'tur dal', 'moong dal', 'urad dal',
    'haldi', 'mirchi', 'jeera', 'sarson', 'ghee', 'tel', 'namak', 'chini', 'doodh',
    'palak', 'gobhi', 'matar', 'bhindi', 'karela', 'baingan', 'capsicum', 'carrot',
    'potato', 'onion', 'tomato', 'ginger', 'garlic', 'curd', 'flour', 'rice', 'lentils'
  ];

  for (const term of commonIndianKitchenTerms) {
    if (lower.includes(term) && !matchedIngredients.includes(term)) {
      matchedIngredients.push(term);
    }
  }

  for (const ing of allIngredients) {
    const nameLower = ing.name.toLowerCase();
    if (nameLower.length > 2 && lower.includes(nameLower) && !matchedIngredients.includes(ing.name)) {
      matchedIngredients.push(ing.name);
    }
  }

  // Calculate confidence score (0.0 to 1.0)
  let baseScore = 0.88;
  if (matchedIngredients.length > 0) {
    baseScore = Math.min(0.98, baseScore + matchedIngredients.length * 0.04);
  } else if (input.length > 0) {
    baseScore = 0.70; // unboosted speech
  } else {
    baseScore = 0.50;
  }

  let finalTranscript = input;
  let finalEngine = targetEngine;
  let fallbackTriggered = false;

  // Cloud fallback: Sarvam Saaras v3 if confidence < 0.75 or requested
  if ((baseScore < 0.75 || targetEngine === 'sarvam_saaras' || !input) && audioBase64) {
    if (SARVAM_API_KEY) {
      try {
        // Call Sarvam AI Saaras v3 STT API if audio is supplied
        const sarvamRes = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: {
            'api-subscription-key': SARVAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'saaras:v3',
            audio: audioBase64,
            language_code: detectedLang === 'en' ? 'en-IN' : 'hi-IN',
            with_diacritics: false,
          }),
        });

        if (sarvamRes.ok) {
          const sarvamData = await sarvamRes.json();
          if (sarvamData.transcript) {
            finalTranscript = sarvamData.transcript;
            finalEngine = 'sarvam_saaras';
            fallbackTriggered = true;
            baseScore = 0.95;
          }
        }
      } catch (e: any) {
        console.warn('Sarvam API call error, falling back to local/Gemini model:', e?.message);
      }
    }

    // If Sarvam didn't return a transcript and input was blank, use Gemini audio transcription
    const key = getApiKey();
    if (!fallbackTriggered && key && (!finalTranscript || finalTranscript === input)) {
      try {
        const ai = getAiClient();
        const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/i, '').trim();
        let rawMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
        if (rawMime.includes('webm')) rawMime = 'audio/webm';
        else if (rawMime.includes('mp4') || rawMime.includes('m4a')) rawMime = 'audio/mp4';
        else if (rawMime.includes('wav')) rawMime = 'audio/wav';
        else if (rawMime.includes('ogg')) rawMime = 'audio/ogg';

        let transcribedText = '';

        // Primary: gemini-3.8-flash native multimodal audio
        try {
          const flashRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: rawMime,
                  },
                },
                {
                  text: `You are an Indian kitchen voice assistant for KitchenSync / Mast Meals.
Listen to this audio recording and transcribe the user's speech accurately into Hindi, English, or Hinglish.
Common commands include:
- Kitchen stock adjustments: e.g. "2 kilo aloo add kar do", "1 litre doodh khatam ho gaya", "dahi aur paneer khatam", "add 500g butter".
- Meal planning & cooking: e.g. "dinner me paneer bhurji rakh do", "poore hafte ka meal plan banao", "kya banayein".
- Restock & shopping: e.g. "I bought everything required", "saara zaroori samaan khareed liya", "add bread to shopping list".

CRITICAL INSTRUCTIONS:
- Return ONLY the exact words spoken.
- Do NOT add explanation, greetings, or punctuation marks around the text.
- If the audio contains only silence, static, or background noise with no audible human speech, return an empty string "".`,
                },
              ],
            },
          });
          const textOut = (flashRes.text || '').trim();
          if (textOut && !textOut.toLowerCase().includes('[silence]') && textOut !== '""' && textOut !== "''") {
            transcribedText = textOut.replace(/^["']|["']$/g, '').trim();
          }
        } catch (flashErr: any) {
          console.warn('Gemini 3.8 Flash audio transcribe error, trying transcribeModel:', flashErr?.message);
        }

        // Secondary: gemini-3.5-transcribe if primary returned empty
        if (!transcribedText) {
          try {
            const transcribeRes = await ai.models.generateContent({
              model: transcribeModel,
              contents: {
                parts: [
                  {
                    inlineData: {
                      data: cleanBase64,
                      mimeType: rawMime,
                    },
                  },
                  {
                    text: 'Transcribe this audio.',
                  },
                ],
              },
            });
            const tText = (
              transcribeRes.text ||
              (transcribeRes.candidates?.[0]?.content?.parts?.[0] as any)?.text ||
              ''
            ).trim();
            if (tText && !tText.toLowerCase().includes('silence')) {
              transcribedText = tText;
            }
          } catch (tErr: any) {
            console.warn('gemini-3.5-transcribe error:', tErr?.message);
          }
        }

        if (transcribedText) {
          finalTranscript = transcribedText;
          finalEngine = 'gemini_flash';
          baseScore = 0.96;
          fallbackTriggered = true;
        }
      } catch (geminiErr: any) {
        console.warn('Gemini audio transcription failed:', geminiErr?.message);
      }
    }
  }

  // Format response engine tag (accurate labeling: Web Speech API / Sarvam Saaras / Gemini Cloud)
  const engineLabels: Record<string, string> = {
    shruti: 'Browser Speech Recognition (Hinglish tuned)',
    cactus_whisper: 'Browser Speech Recognition (English)',
    sarvam_saaras: 'Sarvam Saaras v3 (cloud fallback)',
    gemini_flash: 'Gemini Audio Intelligence (Cloud STT)',
  };

  return res.json({
    transcript: finalTranscript,
    engine: engineLabels[finalEngine] || 'Browser Speech Recognition',
    engineId: finalEngine,
    confidence: Math.round(baseScore * 100) / 100,
    language: detectedLang,
    isOffline: false,
    lowConfidence: baseScore < 0.75,
    fallbackTriggered,
    matchedIngredients,
  });
});

// ---------------------------------------------------------------------------
// 1. Server-Side Standard Endpoint: POST /api/chat
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response): Promise<any> => {
  const { text, mode, household, stock, recipes, ingredient_aliases } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  // Graph RAG Retrieval
  const stockNames = Array.isArray(stock) ? stock.map((s: any) => s.name || s.ingredient_id) : [];
  const graphSuggestions = graphService.suggestFromStock(stockNames, {
    diet_pref: household?.diet_pref === 'nonveg' ? 'nonveg' : 'veg',
    is_beginner: Boolean(household?.is_beginner),
    limit: 4,
  });
  const searchMatches = graphService.searchRecipes({
    query: text,
    diet_pref: household?.diet_pref === 'nonveg' ? 'nonveg' : 'veg',
    is_beginner: Boolean(household?.is_beginner),
    limit: 4,
  });

  const reachableList = graphSuggestions.readyToCook.concat(graphSuggestions.missingOne).map((s) => ({
    id: s.recipe.id,
    name: s.recipe.name,
    time: s.recipe.totalTime,
    missing: s.missingItems.map((m) => m.name),
  }));

  const retrievedList = searchMatches.recipes.map((r) => ({
    id: r.id,
    name: r.name,
    servings: r.servings,
    time: r.totalTime,
    protein_g: r.nutrientsEstimated.protein_g,
    ingredients: r.ingredients.map((i) => ({ name: i.name, qty: i.qty_base, unit: i.unit_base })),
  }));

  const contextBlock = `CONTEXT (server-generated, trusted):
- mode: ${mode || 'chat'}
- language_hint: hi-en
- household: ${JSON.stringify(household || {})}
- stock: ${JSON.stringify(stock || [])}
- graph_rag_stock_recommendations: ${JSON.stringify(reachableList)}
- graph_rag_retrieved_recipes: ${JSON.stringify(retrievedList)}
- ingredient_aliases: ${JSON.stringify(ingredient_aliases || [])}
- today: ${new Date().toISOString().slice(0, 10)}`;

  const prompt = `${contextBlock}\n\nUSER_DATA_TO_PROCESS:\n<transcript confidence="0.95" engine="typed">${text}</transcript>`;

  try {
    const ai = getAiClient();
    let response;
    try {
      response = await ai.models.generateContent({
        model: agentModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (modelErr: any) {
      console.warn(`Falling back to ${fallbackTextModel} from ${agentModel}:`, modelErr?.message);
      response = await ai.models.generateContent({
        model: fallbackTextModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    }

    const outputText = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      // Clean up markdown block if present
      const clean = outputText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    }

    // Dietary re-check on model output: enforce vegetarian boundary strictly
    const isHouseholdVeg = household?.diet_pref !== 'nonveg';
    if (isHouseholdVeg && parsed && parsed.proposal) {
      const nonVegKws = [
        'chicken', 'mutton', 'fish', 'egg', 'eggs', 'meat', 'prawn', 'prawns',
        'beef', 'pork', 'bacon', 'gelatin', 'murgh', 'machli', 'keema', 'gosht',
        'shrimp', 'crab', 'ham', 'sausage'
      ];
      const isWordNonVeg = (str: string) => {
        const l = (str || '').toLowerCase();
        return nonVegKws.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(l));
      };

      if (Array.isArray(parsed.proposal.items)) {
        parsed.proposal.items = parsed.proposal.items.filter((it: any) => {
          if (isWordNonVeg(it.name) || isWordNonVeg(it.ingredient_id)) {
            parsed.warnings = parsed.warnings || [];
            parsed.warnings.push(`Blocked non-vegetarian item "${it.name}" to respect vegetarian household preference.`);
            return false;
          }
          return true;
        });
      }

      if (Array.isArray(parsed.proposal.plan_changes)) {
        parsed.proposal.plan_changes = parsed.proposal.plan_changes.filter((pc: any) => {
          if (isWordNonVeg(pc.recipe_title) || isWordNonVeg(pc.household_recipe_id)) {
            parsed.warnings = parsed.warnings || [];
            parsed.warnings.push(`Blocked non-vegetarian dish "${pc.recipe_title}" from meal plan.`);
            return false;
          }
          return true;
        });
      }

      if (parsed.proposal.recipe_modification) {
        const rm = parsed.proposal.recipe_modification;
        if (isWordNonVeg(rm.ingredient_name)) {
          parsed.warnings = parsed.warnings || [];
          parsed.warnings.push(`Rejected adding non-vegetarian ingredient "${rm.ingredient_name}" to recipe.`);
          parsed.proposal.recipe_modification = null;
        }
      }
    }

    return res.json(parsed);
  } catch (error: any) {
    console.warn('Server Gemini call unavailable or offline, generating Graph RAG response:', error?.message);
    
    // Server-side fallback grounded in Graph RAG & Intent Parser
    const lower = text.toLowerCase();

    // 1. Check for Recipe Modification (e.g., "increase sugar in Kheer to 150g")
    const isModifyRecipe =
      (lower.includes('recipe') || lower.includes('increase') || lower.includes('badha') || lower.includes('ghata') || lower.includes('reduce') || lower.includes('decrease') || lower.includes('sugar') || lower.includes('chini') || lower.includes('namak') || lower.includes('salt')) &&
      (lower.includes('kheer') || lower.includes('sugar') || lower.includes('chini') || lower.includes('recipe') || lower.includes('poha') || lower.includes('dal'));

    if (isModifyRecipe) {
      const recTitle = 'Rice Kheer (चावल की खीर)';
      let ingName = 'Sugar / Chini';
      let oldQty = 100;
      let newQty = 150;
      const unit = 'g';

      if (lower.includes('salt') || lower.includes('namak')) {
        ingName = 'Salt / Namak';
        oldQty = 10;
        newQty = 15;
      }
      const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(g|gm|grams|ml|pcs|kilo|kg)?/);
      if (qtyMatch) {
        newQty = parseFloat(qtyMatch[1]) || 150;
        if (qtyMatch[2] && (qtyMatch[2] === 'kg' || qtyMatch[2] === 'kilo')) newQty *= 1000;
      }

      return res.json({
        mode: mode || 'chat',
        message: `Offline recipe "${recTitle}" me "${ingName}" quantity ${oldQty}${unit} se badha kar ${newQty}${unit} karne ka proposal taiyar hai. Confirm karne par recipe update ho jayegi.`,
        proposal: {
          intent: 'modify_recipe',
          items: [],
          plan_changes: [],
          recipe: null,
          recipe_modification: {
            recipe_id: 'rec_kheer_01',
            recipe_title: recTitle,
            ingredient_name: ingName,
            old_qty: oldQty,
            new_qty: newQty,
            unit,
            op: 'set',
            reason: `Recipe customization requested via chat (${text})`,
          },
        },
        unmatched: [],
        warnings: ['Offline Graph RAG mode active'],
      });
    }

    // 2. Check for Stock Update (e.g. "do kilo aloo add kar do", "atta khatam ho gaya")
    const isStockOp =
      lower.includes('add') ||
      lower.includes('khatam') ||
      lower.includes('kilo') ||
      lower.includes('kg') ||
      lower.includes('gram') ||
      lower.includes('gm') ||
      lower.includes('litre') ||
      lower.includes('liter') ||
      lower.includes('dal diya') ||
      lower.includes('dala') ||
      lower.includes('le aaye') ||
      lower.includes('khareeda') ||
      lower.includes('loo') ||
      lower.includes('atta') ||
      lower.includes('pyaz') ||
      lower.includes('dahi') ||
      lower.includes('paneer') ||
      lower.includes('doodh') ||
      lower.includes('tamatar') ||
      lower.includes('oil') ||
      lower.includes('tel');

    if (isStockOp && !lower.includes('kya banau') && !lower.includes('recipe')) {
      let op: 'add' | 'remove' | 'set' = 'add';
      if (lower.includes('khatam') || lower.includes('remove') || lower.includes('kam ho gaya') || lower.includes('fenk')) {
        op = 'remove';
      }

      let qty = 1000;
      let unit = 'g';
      if (lower.includes('do kilo') || lower.includes('2 kilo') || lower.includes('2 kg') || lower.includes('2kg') || lower.includes('2000')) {
        qty = 2000;
      } else if (lower.includes('aadha') || lower.includes('half') || lower.includes('500g') || lower.includes('500 gm') || lower.includes('500')) {
        qty = 500;
      } else if (lower.includes('ek kilo') || lower.includes('1 kilo') || lower.includes('1 kg') || lower.includes('1000')) {
        qty = 1000;
      } else if (lower.includes('litre') || lower.includes('liter') || lower.includes('l')) {
        unit = 'ml';
        qty = 1000;
      }

      const currentStockList = Array.isArray(stock) ? stock : [];
      const matchedStockItem = currentStockList.find((s: any) => {
        const sName = (s.name || '').toLowerCase();
        const sId = (s.ingredient_id || '').toLowerCase();
        return (
          (lower.includes('aloo') && (sName.includes('aloo') || sId.includes('aloo'))) ||
          (lower.includes('atta') && (sName.includes('atta') || sId.includes('atta'))) ||
          (lower.includes('doodh') && (sName.includes('doodh') || sName.includes('milk') || sId.includes('doodh'))) ||
          (lower.includes('dahi') && (sName.includes('dahi') || sName.includes('curd') || sId.includes('dahi'))) ||
          (lower.includes('paneer') && (sName.includes('paneer') || sId.includes('paneer'))) ||
          (lower.includes('tamatar') && (sName.includes('tamatar') || sName.includes('tomato') || sId.includes('tamatar'))) ||
          (lower.includes('chawal') && (sName.includes('chawal') || sName.includes('rice') || sId.includes('chawal'))) ||
          (lower.includes('pyaz') && (sName.includes('pyaz') || sName.includes('onion') || sId.includes('pyaz'))) ||
          (lower.includes('oil') && (sName.includes('oil') || sName.includes('tel') || sId.includes('oil'))) ||
          (sName.length > 2 && lower.includes(sName))
        );
      });

      let itemName = matchedStockItem ? matchedStockItem.name : 'Aloo (Potatoes)';
      let ingId = matchedStockItem ? matchedStockItem.ingredient_id : 'ing_aloo';
      if (!matchedStockItem) {
        if (lower.includes('atta') || lower.includes('wheat') || lower.includes('gehu')) {
          itemName = 'Whole Wheat Atta';
          ingId = 'ing_atta';
        } else if (lower.includes('pyaz') || lower.includes('onion')) {
          itemName = 'Pyaz (Onions)';
          ingId = 'ing_pyaz';
        } else if (lower.includes('dahi') || lower.includes('curd')) {
          itemName = 'Fresh Dahi';
          ingId = 'ing_dahi';
          unit = 'ml';
        } else if (lower.includes('doodh') || lower.includes('milk')) {
          itemName = 'Fresh Doodh / Milk';
          ingId = 'ing_doodh';
          unit = 'ml';
        } else if (lower.includes('paneer')) {
          itemName = 'Paneer Block';
          ingId = 'ing_paneer';
        } else if (lower.includes('tamatar') || lower.includes('tomato')) {
          itemName = 'Fresh Tamatar';
          ingId = 'ing_tamatar';
        }
      }

      const isExisting = Boolean(matchedStockItem);
      const before = matchedStockItem ? matchedStockItem.qty_base || 0 : 0;
      const after = op === 'add' ? before + qty : op === 'remove' ? Math.max(0, before - qty) : qty;
      const location = matchedStockItem?.location || (unit === 'ml' || lower.includes('paneer') || lower.includes('tamatar') ? 'fridge' : 'pantry');
      const targetScope = matchedStockItem?.owner_user_id ? 'personal' : 'shared';
      const targetSection = `Kitchen Stock → ${location === 'fridge' ? 'Fridge' : 'Pantry'} (${targetScope === 'personal' ? 'Personal' : 'Shared'})`;

      const msg = isExisting
        ? `Matched existing inventory item: "${itemName}" in ${targetSection}. Current stock: ${before} ${unit} → Proposing ${op === 'remove' ? '-' : '+'}${qty} ${unit} (New level: ${after} ${unit}). Niche card par confirm karein.`
        : `New item to add: "${itemName}" (+${qty} ${unit}) in ${targetSection}. Niche card par confirm karein.`;

      return res.json({
        mode: mode || 'chat',
        message: msg,
        classification_badge: isExisting ? 'Existing Stock Update' : 'New Stock Addition',
        update_type_label: isExisting ? 'Inventory Stock Adjustment (Existing Item)' : 'New Inventory Item Addition',
        target_section: targetSection,
        proposal: {
          intent: 'update_stock',
          classification_badge: isExisting ? 'Existing Stock Update' : 'New Stock Addition',
          update_type_label: isExisting ? 'Inventory Stock Adjustment (Existing Item)' : 'New Inventory Item Addition',
          target_section: targetSection,
          items: [
            {
              ingredient_id: ingId,
              name: itemName,
              qty_base: qty,
              unit_base: unit,
              op: op,
              before,
              after,
              stock_id: matchedStockItem?.id || null,
              is_existing: isExisting,
              location,
              target_scope: targetScope,
              target_section: targetSection,
              classification: isExisting ? 'Existing Stock Adjustment' : 'New Item Addition',
              note: `Direct stock adjustment via chat: ${text}`,
            },
          ],
          plan_changes: [],
          recipe: null,
        },
        unmatched: [],
        warnings: ['Offline Graph RAG mode active'],
      });
    }

    // 3. Check for Full 7-Day Schedule Planning
    const isSchedulePlan =
      lower.includes('full schedule') ||
      lower.includes('week schedule') ||
      lower.includes('weekly') ||
      lower.includes('hafta plan') ||
      lower.includes('poore hafte') ||
      lower.includes('auto plan') ||
      lower.includes('whole week');

    if (isSchedulePlan) {
      const scheduleChanges: any[] = [];
      const candidateRecipes = reachableList.length > 0 ? reachableList : retrievedList;
      const today = new Date();

      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const lunchRec = candidateRecipes[i % candidateRecipes.length] || { id: 'rec_dal_01', name: 'Dal Tadka' };
        const dinnerRec = candidateRecipes[(i + 1) % candidateRecipes.length] || { id: 'rec_paneer_01', name: 'Paneer Bhurji' };

        scheduleChanges.push({
          meal_date: dateStr,
          slot: 'lunch',
          household_recipe_id: lunchRec.id,
          recipe_title: lunchRec.name,
          servings: 2,
        });
        scheduleChanges.push({
          meal_date: dateStr,
          slot: 'dinner',
          household_recipe_id: dinnerRec.id,
          recipe_title: dinnerRec.name,
          servings: 2,
        });
      }

      return res.json({
        mode: mode || 'plan',
        message: 'Agale 7 dino ke liye aapke kitchen stock aur dietary preferences ke hisaab se pura weekly meal schedule plan kar diya hai.',
        proposal: {
          intent: 'edit_schedule',
          items: [],
          plan_changes: scheduleChanges,
          recipe: null,
        },
        unmatched: [],
        warnings: ['Offline Graph RAG mode active'],
      });
    }

    // 4. Fallback for meal queries or general recommendations
    const topSuggestion = reachableList[0] || retrievedList[0];
    const isDinner = lower.includes('dinner') || lower.includes('raat');
    const slot = isDinner ? 'dinner' : 'lunch';

    const fallbackResponse = {
      mode: mode || 'chat',
      message: topSuggestion
        ? `Aapke kitchen stock ke hisaab se Graph RAG recommend karta hai: "${topSuggestion.name}" (~${topSuggestion.time || 25} min). Kya ise ${slot} me add karein?`
        : `Omnirush assistant: Kitchen inventory processed for "${text}".`,
      proposal: topSuggestion
        ? {
            intent: 'edit_plan',
            items: [],
            plan_changes: [
              {
                meal_date: new Date().toISOString().slice(0, 10),
                slot: slot,
                household_recipe_id: topSuggestion.id,
                servings: 2,
                recipe_title: topSuggestion.name,
              },
            ],
            recipe: null,
          }
        : null,
      unmatched: [],
      warnings: ['Offline Graph RAG mode active'],
    };

    return res.json(fallbackResponse);
  }
});

// ---------------------------------------------------------------------------
// 2. Server-Side Streaming Endpoint: POST /api/chat/stream
// ---------------------------------------------------------------------------
app.post('/api/chat/stream', async (req: Request, res: Response): Promise<any> => {
  const { text, mode, household, stock, recipes, ingredient_aliases } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const contextBlock = `CONTEXT (server-generated, trusted):
- mode: ${mode || 'chat'}
- language_hint: hi-en
- household: ${JSON.stringify(household || {})}
- stock: ${JSON.stringify(stock || [])}
- recipes: ${JSON.stringify(recipes || [])}
- ingredient_aliases: ${JSON.stringify(ingredient_aliases || [])}
- today: ${new Date().toISOString().slice(0, 10)}`;

  const prompt = `${contextBlock}\n\nUSER_DATA_TO_PROCESS:\n<transcript confidence="0.95" engine="typed">${text}</transcript>`;

  try {
    const ai = getAiClient();
    const stream = await ai.models.generateContentStream({
      model: agentModel,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    let fullText = '';
    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Server Gemini Stream Error in /api/chat/stream:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
    res.end();
  }
});

// ---------------------------------------------------------------------------
// 3. Server-Side Live API: WebSocket Server on /live
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/live') {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    }
  } catch (err) {
    console.error('Error during websocket upgrade:', err);
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected to /live WebSocket');

  try {
    const ai = getAiClient();
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: systemInstruction,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
        },
      },
    });

    clientWs.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('Error forwarding client audio to Live API:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client disconnected from /live');
    });
  } catch (liveError: any) {
    console.error('Live API Session Connection Error:', liveError);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: liveError.message || 'Live session failed' }));
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Vite Mounting and Server Start
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`KitchenSync / Mast Meals Server running at http://${HOST}:${PORT}`);
  });
}

startServer();
