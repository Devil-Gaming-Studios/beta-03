# KitchenSync / Mast Meals — Feature List & Tech Stack

Household meal, recipe and kitchen-stock assistant for Indian households (Hackathon Problem Statement 5).
Hosted at **https://beta-03-fhk0.onrender.com/** · Repo: **Devil-Gaming-Studios/beta-03**

> Source: analysis of the GitHub repo (`main`, 60 commits). The hosted URL could not be opened from the analysis environment, so deployment details come from `render.yaml`, `server.ts` and the build config rather than from live probing. Statuses: ✅ working in the app, 🟡 partial or simulated, 🧪 built but not wired into the app.

---

## 1. What it is

One app that closes the loop **plan → cook → stock → shop**: a weekly meal plan drives ingredient needs, cooking deducts stock, shortages become a shopping list, and an AI assistant (Omnirush) edits everything by text or voice in English, Hindi and Hinglish. It runs as a **PWA** (installable from the browser), a **native Android shell** (APK) and works across devices through **account sync**.

**Kitchen modes:** Family · Bachelor flat · Hostel room · **Cloud kitchen** (order-driven).

---

## 2. Feature list

### 2.1 Accounts, households and profile
| Feature | Status |
|---|---|
| Registration with full profile (diet, goals, regions, equipment, fridge, weight, protein target, cautions, weekly "regular vs new food" schedule) | ✅ |
| Strict **veg / non-veg** preference per user and per household member | ✅ |
| Multiple household members with age group, protein target and diet cautions | ✅ |
| Beginner-cook mode (simpler recipes) | ✅ |
| Household type selection incl. Cloud kitchen; invite code to join a household | ✅ |
| Hindi / English UI toggle | ✅ |
| Real server-side login (Google OAuth) | 🟡 account login is email/mobile + password through the sync service; Google sign-in is not implemented |

### 2.2 Weekly meal planner (`Plan` tab)
- 7-day breakfast / lunch / dinner calendar with serving scaling (1–20).
- **AI auto-generate week** (`/api/plan/auto-generate`): Gemini picks meals from Graph-RAG candidates, using current stock, diet, beginner flag and past diet memory.
- Shortage flags for planned meals; "Mark done" deducts ingredients from stock (duplicate-deduction guard); "Skip" records without deducting.
- Recipe inspector with scaled quantities, calories / protein / carbs / fat / sodium and diet-caution guidance.
- Regular-vs-new-day variety schedule per weekday (diet memory) so the plan mixes familiar and new dishes.
- Protein tracking against each member's daily target (intake logs).

### 2.3 Recipes and Graph RAG (`Recipes` tab)
- **6,871 Indian recipes, ~2,700 ingredients, ~123k graph edges** seeded from the Archana's Kitchen dataset, searchable by text, cuisine, course, time, diet, difficulty and high-protein.
- "What can I cook from my stock?" suggestions with missing-ingredient counts (`/api/graph/suggest-from-stock`).
- Ingredient substitutions (`/api/graph/substitutions`).
- Editable cached recipes: change quantities, add or remove ingredients; edits are household-scoped.
- Add your own recipe through chat; the assistant checks it against the graph and flags likely-missing ingredients, with a confirm checklist (add / remove).

### 2.4 Kitchen stock (`Stock` tab)
- Pantry and fridge inventory in base units (g / ml / pcs), shared vs personal stock, location, storage guidance and shelf life.
- Multi-batch tracking (same item, different expiries), expiry warnings, in-line restock.
- Receipt / fridge photo scan (Gemini Vision, `/api/vision/scan`) with a **confirm-and-edit** screen before anything is written.
- Full audit log and stock ledger for every change.

### 2.5 Shopping (`Shop` tab)
- Shopping list generated from plan shortages.
- Price comparison view (Blinkit / Zepto / Swiggy Instamart) with "as of" timestamps — 🟡 benchmark data, no live scrapers.
- **Swiggy MCP**: OAuth 2.1 + PKCE connect, search, **cart-only** preview and confirm (never places an order) with redirect to the Swiggy cart — 🟡 requires Swiggy credentials/approval to work live.
- Preferred-brands-first ordering (from past purchases) — 🟡 basic.

### 2.6 Omnirush assistant — chat and voice
- Text and voice chat in English, Hindi and Hinglish (`/api/chat`, streaming `/api/chat/stream`, live audio WebSocket `/live`).
- Can update stock, edit the plan, modify recipes, add recipes, build carts.
- **Confirm-before-write:** every AI action becomes a proposal card showing before/after; nothing changes until the user confirms.
- Prompt-injection defences on user text and scanned/OCR text; AI output is validated server-side.
- **Speech-to-text engine chain:** browser speech → on-device engines (Shruti for Hindi/Hinglish, Cactus Whisper for English) → **Sarvam Saaras** cloud fallback only on low confidence → Gemini audio fallback. Per-language confidence thresholds.

### 2.7 Shop chat listener (auto-read the shopkeeper's messages)
- **Android:** a `NotificationListenerService` reads WhatsApp / WhatsApp Business / Telegram notifications from **only the configured shop contact**, dedupes, queues offline in SQLite, retries, and restarts after reboot. Pause switch and "clear stored messages" for privacy.
- **Telegram bot webhook** (`/api/telegram-webhook`) with secret-token check and chat-ID allow-list.
- **Web fallback:** paste a shop message, or open the chat with a `wa.me` link.
- Server extracts items with Gemini using a strict JSON schema (Hindi / English / Hinglish), stores them in a **pending inbox**; the user edits and confirms on a card before anything reaches stock or the shopping list.

### 2.8 Cloud kitchen mode
- Menu items linked to recipes, with price, portion yield, availability and variants; auto "sold out" when stock can't cover another portion.
- **Orders** with the full lifecycle: new → accepted → preparing → ready → delivered / cancelled; payment status (pending / paid / COD); kitchen-display style home.
- **Inventory follows the work:** ingredients are reserved when an order is accepted, deducted when cooked, released if cancelled; batch cooking ("making 40 portions of biryani") scales the recipe, shows shortages and asks for confirmation.
- Wastage log, stock ledger, supplier / contractor management and purchase lists, roles (owner, cook, packer, helper), pure-veg-kitchen switch.

### 2.9 Community
- Threads-style feed: post a dish photo with a caption, like posts, and attach the recipe you used; tap through to the recipe.

### 2.10 Cross-device sync
- Sign in on any phone or browser and the same data appears; changes on one device reach the others within seconds (live server notification with an 8-second poll fallback).
- Per-item sync (two devices editing different stock items never clash), tombstones for deletes, offline-tolerant retry, first-link merge where the server wins, banner to turn sync on, status badge on the profile screen.
- Passwords stored as scrypt hashes server-side; never uploaded from the app's local data.

### 2.11 Install and offline
- Installable **PWA** (manifest, service worker, icons) with an in-app Install button and platform-specific steps (Android / iOS / desktop).
- **Native Android APK** (WebView shell) downloadable from the site, with mic/camera permission handling and the shop-chat listener.
- Offline-first local state; sync resumes when the network returns.

---

## 3. Tech stack

### Frontend
| Layer | Technology |
|---|---|
| UI | React 18, TypeScript 5.7 |
| Build | Vite 6, `@vitejs/plugin-react` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), Material Symbols / Lucide icons |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`), web manifest, service worker |
| State | Custom `StoreService` (localStorage) + `syncClient` / `syncSchema` for server sync |
| Voice | Web Speech API, `MediaRecorder`, WebSocket live audio, Cactus / Shruti / Sarvam engine routing (`sttService.ts`) |

### Backend
| Layer | Technology |
|---|---|
| Server | Node 22, Express 5, `tsx`, `ws` (WebSocket) |
| AI | Google Gemini via `@google/genai` (text/agent: `gemini-3.8-flash`, audio transcription, vision scan, live audio) |
| Speech | Sarvam Saaras v3 (cloud STT fallback for Hindi / Hinglish) |
| Commerce | Swiggy MCP via `@modelcontextprotocol/sdk` + OAuth 2.1 PKCE, encrypted token store |
| Messaging | Telegram Bot API webhook, Android notification listener |
| Graph RAG | In-memory recipe/ingredient graph (`server/graphService.ts`) built from the Archana's Kitchen dataset (`scripts/convert_csv_to_graph_rag.ts`) |
| Sync store | `server/syncService.ts` — JSON file by default, **PostgreSQL (Supabase session pooler)** when `DATABASE_URL` is set (`server/syncPg.ts`, `pg`) |
| Auth / security | scrypt password hashing, HMAC-signed tokens, login rate limiting, shop-inbox token + rate limit, Telegram secret + chat allow-list, confirm-before-write, injection filters |

### Native Android
- Java shell (no Gradle needed via `android/build.sh`; Gradle also supported): `WebView`, `NotificationListenerService`, `BootReceiver`, SQLite offline queue, WorkManager-style retry, JS bridge (`AndroidNative` / `AndroidBridge`), mic + camera runtime permissions, network-security config.

### Data and tooling
- Dataset: Archana's Kitchen Indian recipes (CC BY 4.0), converted to graph JSON.
- 🧪 **Kùzu graph pipeline** (`backend/graph/`, Python): strict veg-safe classification, ingredient parsing/normalisation, similarity edges, co-occurrence — built and tested, **not yet connected** to the Express server.
- 🧪 Python FastAPI backend (`backend/app.py`, SQLite, Google ID-token login) — an earlier parallel implementation, separate from the React app.
- Tests: `test:shop-inbox`, `test:sync` (two simulated devices against a live server), cloud-kitchen, community and graph test scripts.

### Deployment
- **Render** web service (free plan): `npm install && npm run build` → `npm start` (production Express serving the built `dist/` plus the API), health check `/healthz`.
- Environment: `GEMINI_API_KEY`, `DATABASE_URL`, `SYNC_SECRET`, `SARVAM_API_KEY`, `APP_AUTH_TOKEN`, Swiggy token-encryption keys, Telegram secret and chat IDs.
- HTTPS from Render (needed for PWA install, mic and camera).

---

## 4. Architecture at a glance

```
 Phone / Browser (React PWA)           Native Android shell (WebView)
   StoreService (localStorage)  <───>   Notification listener -> /api/shop-inbox
   syncClient  ──push/pull/live──┐
                                 ▼
                    Express 5 server (Render)
   /api/sync/*   accounts + per-item documents  ──>  JSON file or PostgreSQL
   /api/chat, /live, /api/stt, /api/vision       ──>  Gemini, Sarvam
   /api/graph/*, /api/plan/auto-generate         ──>  in-memory Graph RAG (6,871 recipes)
   /api/shop-inbox, /api/telegram-webhook        ──>  pending inbox -> user confirms
   /api/swiggy/*                                 ──>  Swiggy MCP (cart-only)
```

---

## 5. Known gaps (honest list)
- Google OAuth / Calendar sync and order-email/receipt-based order tracking are not implemented.
- Price comparison and "as of" prices are benchmark data; no live Blinkit / Zepto scrapers.
- Swiggy MCP works only with valid Swiggy access; checkout is intentionally never performed.
- Sync resolves a same-item conflict between two offline devices by last write; community likes are shared as stored, not per user; two different accounts cannot yet share one household.
- The Kùzu graph and the FastAPI backend are not connected to the live app.
- Free Render plan sleeps when idle, so the first request after a pause is slow.
