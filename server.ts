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
// 1. Server-Side Standard Endpoint: POST /api/chat
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response): Promise<any> => {
  const { text, mode, household, stock, recipes, ingredient_aliases } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

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
