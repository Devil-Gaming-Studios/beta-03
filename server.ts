import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Initialize Google GenAI on the server
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const agentModel = process.env.GEMINI_AGENT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ai = new GoogleGenAI({
  apiKey: apiKey || undefined,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

import { graphService } from './server/graphService';

// Read system prompt from prompts/omnirush.system.txt if available
let systemInstruction = `You are Omnirush, the assistant inside Mast Meals, a household meal, recipe and kitchen-stock app for Indian households. You help with meal plans, recipes, stock and shopping lists.
Return only valid JSON matching the format:
{
  "mode": "chat" | "plan" | "cart",
  "message": "short plain-text reply in Hindi/English/Hinglish",
  "proposal": null | {
    "intent": "edit_plan" | "update_stock" | "add_recipe" | "set_category" | "add_to_cart",
    "items": [{ "ingredient_id": "...", "qty_base": 500, "unit_base": "g"|"ml"|"pcs", "op": "add"|"remove"|"set" }],
    "plan_changes": [{ "meal_date": "YYYY-MM-DD", "slot": "breakfast"|"lunch"|"dinner", "household_recipe_id": "...", "servings": 2, "recipe_title": "..." }],
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
    diet_pref: diet_pref === 'veg' ? 'veg' : diet_pref === 'nonveg' ? 'nonveg' : undefined,
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
    diet_pref: diet_pref === 'veg' ? 'veg' : 'nonveg',
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

app.post('/api/graph/rebuild', (req: Request, res: Response) => {
  try {
    const stats = graphService.rebuild(req.body.csvPath);
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to rebuild graph' });
  }
});

// ---------------------------------------------------------------------------
// Vision Scanning Endpoint: Receipt OCR & Fridge Scan with Gemini
// ---------------------------------------------------------------------------
app.post('/api/vision/scan', async (req: Request, res: Response): Promise<any> => {
  const { imageBase64, mimeType, kind } = req.body;

  // Fallback defaults if no Gemini key or processing sample
  const defaultItems = kind === 'receipt'
    ? [
        { name: 'Fresh Dahi (Amul Masti)', qty_base: 500, unit_base: 'ml', location: 'fridge', targetScope: 'personal', confidence: 0.96 },
        { name: 'Aloo (Baby Potatoes)', qty_base: 1500, unit_base: 'g', location: 'pantry', targetScope: 'shared', confidence: 0.94 },
        { name: 'Chakki Atta (Whole Wheat)', qty_base: 5000, unit_base: 'g', location: 'pantry', targetScope: 'shared', confidence: 0.98 },
        { name: 'Fresh Paneer Block', qty_base: 200, unit_base: 'g', location: 'fridge', targetScope: 'personal', confidence: 0.92 },
      ]
    : [
        { name: 'Fresh Milk / Doodh', qty_base: 1000, unit_base: 'ml', location: 'fridge', targetScope: 'shared', is_estimate: true, confidence: 0.9 },
        { name: 'Tomatoes / Tamatar', qty_base: 500, unit_base: 'g', location: 'fridge', targetScope: 'shared', is_estimate: true, confidence: 0.85 },
        { name: 'Green Chillies & Ginger', qty_base: 100, unit_base: 'g', location: 'fridge', targetScope: 'shared', is_estimate: true, confidence: 0.88 },
        { name: 'Curd / Dahi', qty_base: 400, unit_base: 'ml', location: 'fridge', targetScope: 'personal', is_estimate: true, confidence: 0.82 },
      ];

  if (!apiKey || !imageBase64) {
    return res.json({
      kind: kind || 'fridge_scan',
      extractedAt: new Date().toISOString(),
      items: defaultItems,
      engine: 'simulated_ocr_vision'
    });
  }

  try {
    const prompt = kind === 'receipt'
      ? `You are an Indian grocery receipt OCR engine for KitchenSync. Extract food and pantry items as structured JSON:
        [
          { "name": "Item Name", "qty_base": 500, "unit_base": "g"|"ml"|"pcs", "location": "pantry"|"fridge", "targetScope": "personal"|"shared", "confidence": 0.95 }
        ]
        Rule: common staple grains/oils default to "shared"; personal snacks/dahi/chocolates default to "personal". Return only JSON.`
      : `You are an Indian kitchen fridge/pantry scan estimator for KitchenSync. Estimate all visible food ingredients:
        [
          { "name": "Item Name", "qty_base": 500, "unit_base": "g"|"ml"|"pcs", "location": "fridge"|"pantry", "targetScope": "shared"|"personal", "is_estimate": true, "confidence": 0.88 }
        ]
        Return only JSON array.`;

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: agentModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({
      kind: kind || 'vision_scan',
      extractedAt: new Date().toISOString(),
      items: Array.isArray(parsed) ? parsed : defaultItems,
      engine: 'gemini_multimodal_vision'
    });
  } catch (err: any) {
    console.warn('Gemini vision scan failed, using fallback:', err?.message);
    return res.json({
      kind: kind || 'vision_scan',
      extractedAt: new Date().toISOString(),
      items: defaultItems,
      engine: 'fallback_ocr'
    });
  }
});

// ---------------------------------------------------------------------------
// Speech-to-Text (STT) Routing API: Shruti, Cactus Whisper & Sarvam Saaras v3
// ---------------------------------------------------------------------------
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

app.post('/api/stt/transcribe', async (req: Request, res: Response): Promise<any> => {
  const { textCandidate, engine, languageHint, audioBase64 } = req.body;
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
  if ((baseScore < 0.75 || targetEngine === 'sarvam_saaras') && SARVAM_API_KEY && audioBase64) {
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
      console.warn('Sarvam API call error, falling back to local model:', e?.message);
    }
  }

  // Format response engine tag
  const engineLabels: Record<string, 'Shruti (offline)' | 'Cactus Whisper (offline)' | 'Sarvam Saaras v3 (cloud fallback)'> = {
    shruti: 'Shruti (offline)',
    cactus_whisper: 'Cactus Whisper (offline)',
    sarvam_saaras: 'Sarvam Saaras v3 (cloud fallback)',
  };

  return res.json({
    transcript: finalTranscript,
    engine: engineLabels[finalEngine] || 'Shruti (offline)',
    engineId: finalEngine,
    confidence: Math.round(baseScore * 100) / 100,
    language: detectedLang,
    isOffline: finalEngine !== 'sarvam_saaras',
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
    let response;
    try {
      response = await ai.models.generateContent({
        model: agentModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });
    } catch (modelErr: any) {
      if (agentModel !== 'gemini-2.5-flash') {
        console.warn(`Falling back to gemini-2.5-flash from ${agentModel}:`, modelErr?.message);
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });
      } else {
        throw modelErr;
      }
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

    return res.json(parsed);
  } catch (error: any) {
    console.error('Server Gemini Error in /api/chat:', error);
    return res.status(500).json({
      error: 'gemini_server_error',
      message: error.message || 'Failed to generate response on server',
    });
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
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected to /live WebSocket');

  try {
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
      server: { middlewareMode: true },
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
