# KitchenSync / Mast Meals: implementation review

Reviewed against `KitchenSync.md` (the final plan, sections 1 to 9).
Repo state reviewed: `main` at `089a6e1` (re-checked 31 Oct 2026, 07:51 IST). The application code is unchanged since `da5a71f`; the only later commits are the graph pipeline and this review, merged as pull request #1. The first review fast-forwarded past the older `053e01a` checkout.

**Legend:** ✅ implemented · 🟡 partial · 🎭 simulated (looks real in the UI, no real engine behind it) · ❌ not implemented · ⛔ blocked on an outside approval

## 1. What was actually verified

| Check | Result |
|---|---|
| `npx tsc --noEmit` on the React/Express app | Passes, no errors |
| Python backend `backend/smoke_test.py` (run against a fresh server) | 23 of 23 checks pass (auth, token tampering, cross-household isolation, refresh rotation and reuse detection, mark-done deduction, double-done refused) |
| Browser or end-to-end run of the React app | **Not run.** I read the code but did not click through the UI |
| Gemini, Sarvam, Swiggy calls | **Not run.** No API keys here, so those paths were read, not exercised |

## 2. The most important finding: there are two disconnected apps

| | Python backend (`backend/`) | React + Express app (`src/`, `server.ts`) |
|---|---|---|
| Storage | SQLite (`mastmeals.db`), per-household rows | **Browser `localStorage`** (`StoreService` in `src/services/store.ts`, 2,907 lines) |
| Auth | Google ID-token check, 15-minute JWT, refresh rotation and reuse detection | **None.** `getMe()` returns a hardcoded user ("Divyansh (Head Chef)", role owner) |
| Confirm-before-write | Enforced on the server (`/api/chat` then `/api/confirm`) | Proposals are created and applied **inside the browser** by the same code |
| Tests | 23 smoke checks | None |

The React app never calls the Python backend. Its only network calls are `/api/graph/*`, `/api/plan/auto-generate`, `/api/vision/scan`, `/api/stt/transcribe` and `/api/chat` on `server.ts`. So the security work (token verification, household isolation, server-side confirm) is real but is **not what the UI runs on**. Everything in section 4 below should be read with that in mind: several "implemented" items are implemented only in the Python backend that the app does not use.

**Decision needed:** pick one stack to demo. The fastest route is to keep the React UI and port the Python auth, household isolation and confirm logic into `server.ts` (or the reverse).

## 3. Architecture as built

- **UI:** React 18 + Vite + Tailwind, tabs Home / Planner / Recipes / Stock / Shop / Household, voice modal (`OmnirushVoiceModal`), scan modal, Swiggy hand-off modal.
- **Server (`server.ts`, Express 5):** Gemini calls for chat, plan generation and vision scan; Sarvam call for speech; a `/live` WebSocket that proxies Gemini Live; graph endpoints.
- **Graph RAG (`server/graphService.ts` + `scripts/convert_csv_to_graph_rag.ts`):** the 6,871-recipe CSV is parsed into an **in-memory JavaScript object** (recipes, ingredients, edges, a similarity index) and loaded from `src/data/graph_rag_seed.json` (7.5 MB). It is not a graph database and uses no embeddings.
- **Offline:** the 7.5 MB seed JSON is bundled into the client (`omnirush.ts` imports it), state is in `localStorage`, and `public/sw.js` is network-first with a cache fallback.
- **Test shell:** `android/` builds a WebView APK around the old Python backend's static page, not the React app.

## 4. Feature-by-feature status against the plan

### 2.1 Onboarding and household profile
| Item | Status | Evidence / gap |
|---|---|---|
| Google OAuth login | 🟡 | Real in Python (`/auth/google`: checks audience, issuer, `email_verified`). **None in the React app**, no sign-in screen |
| Google Calendar sync at registration | ❌ | No Calendar scopes or client anywhere |
| Required diet preference, beginner checkbox, create/join household | 🟡 | `setUserPreferences()` exists, but `App.tsx` has no onboarding gate; the stitch design `onboarding_diet_cooking_level` is not wired in |
| Invite codes (create, join, expire, revoke) | ❌ | `invite_code` is only a field in `types.ts` and the store; no flow or UI |
| Members: age group, per-member diet, weight, protein goal, cautions | ✅ | `HouseholdScreen`, `types.ts` (also adds `bp`, `cholesterol`, `digestion` cautions) |
| Fridge yes/no and cooking equipment | ✅ | Stored and passed to the agent |

### 2.2 Recipe store (graph RAG, offline)
| Item | Status | Evidence / gap |
|---|---|---|
| Server-side graph vector DB | 🟡 | In-memory JS graph with a similarity index; **no vector embeddings, no Kùzu/Neo4j** |
| "Local cache first, then server" retrieval order | ❌ | `RecipesScreen` calls `/api/graph/recipes` directly; the client bundles the whole seed instead of a per-recipe cache |
| Offline retrieval | 🟡 | Works only because the full seed ships in the bundle |
| Edit quantities, add/remove ingredients on cached recipes | ✅ | `modifyRecipeIngredient()` in the store, reachable by chat |
| Sync edits with client ID, last-write-wins | ❌ | `syncLog` is an audit stub (`id: 'item_' + Date.now()`); no sync endpoint is called; `client_id` is `'client_' + userId` |

### 2.3 Quantity calculation and stock check
| Item | Status | Evidence / gap |
|---|---|---|
| Scale quantities to servings, flag missing | ✅ | `planCheck()`, `getRecipeDetail()` |
| Ingredient parsing quality | 🟡 | `normalizeUnitAndQty` forces every quantity to at least 1, treats **every cup as 200 g** regardless of ingredient, and turns "to taste" or "a pinch" into `1 pcs`, so salt and spices can show up as short in the shopping list |

### 2.4 AI weekly meal suggestions
| Item | Status | Evidence / gap |
|---|---|---|
| Plan from stock and household, flag the rest | ✅ | `/api/plan/auto-generate` (Gemini + graph retrieval + past-diet memory); `autoFillWeekPlan()` as fallback |
| Regular vs new-dish schedule, diet-goal tags | ✅ (extra) | `UserDietMemory`, not in the plan; useful |
| Beginner filter and equipment-aware filtering | 🟡 | `is_beginner` is applied; no filter on the household's equipment list was found |

### 2.5 Inventory updates
| Item | Status | Evidence / gap |
|---|---|---|
| Receipt OCR (Gemini vision) | ✅ | `/api/vision/scan`, `ScanModal` with a confirm screen |
| Fridge photo scan | ✅ | Same endpoint; marks `is_estimate` |
| Fridge **video** scan | ❌ | Image only |
| Personal / Shared toggle per scanned item | ✅ | `ingestScannedItems`, `target_scope` |
| Upload hardening (type check by content, size cap, EXIF/GPS strip, delete raw media) | ❌ | Server trusts the declared MIME type; only a 25 MB JSON body limit; no EXIF stripping |

### 2.6 Order tracking
| Item | Status | Evidence / gap |
|---|---|---|
| Swiggy Instamart `track_order`, `get_orders`, `get_order_details` | ⛔ | No MCP client in the code; needs the Swiggy client-id approval |
| Blinkit/Zepto order emails via Gmail API | ❌ | No Gmail code |
| Stock updated on delivery | ❌ | Depends on the two items above. (Offline purchases are synced from the Shop tab to Stock manually; that is a different feature) |

### 2.7 Shopping list and ordering
| Item | Status | Evidence / gap |
|---|---|---|
| Shopping list from plan shortages | ✅ | `generateShoppingList()` |
| Shared and personal lists | 🟡 | `owner_user_id` exists on items; no UI to split lists by user was found |
| Swiggy cart-only hand-off with redirect | 🎭 | `SwiggyModal` only runs `window.open('https://www.swiggy.com/instamart')`. **No MCP, no cart items are actually added**; the modal text ("pre-filled cart") overstates it |
| Never place an order | ✅ | Nothing places orders (by absence, not by an enforced allow-list) |
| Blinkit/Zepto scrapers (price only) | ❌ | See 2.8 |

### 2.8 Price comparison
| Item | Status | Evidence / gap |
|---|---|---|
| Prices per store with "as of" time | 🎭 | `store.ts` derives `blinkit_price`, `zepto_price`, `swiggy_price` from a `basePrice` and stamps `as_of: new Date()` at generation time. **The prices are not scraped**, so the timestamp makes simulated numbers look live |

### 2.9 Brand preference ranking
❌ No brand tables, no signal ingestion, no ranking (only a `brand` mention in a header and `server.ts`).

### 2.10 Google Calendar reminders
❌ No reminders table, no Calendar client, no notifications.

### 2.11 Health tracker
| Item | Status | Evidence / gap |
|---|---|---|
| Nutrients per meal (kcal, protein, carbs, fat, sodium) | 🟡 | Estimated per recipe; `RecipesScreen` contains a hardcoded `sodium_mg: 400` fallback |
| "Too much salt / too much oil" warnings against cautions | ❌ | No such logic found |

### 2.12 Storage guide and purchase-quantity advice
| Item | Status | Evidence / gap |
|---|---|---|
| Per-item storage place and shelf life | 🟡 | `storage_place`, `shelf_life_days` on ingredients; expiring-stock list on Home |
| Storage tips surface; "buy less" advice for households without a fridge | ❌ | `has_fridge` is stored and passed to the agent but no quantity-limiting logic found |

### 2.13 Multi-user households
| Item | Status | Evidence / gap |
|---|---|---|
| Personal vs shared stock | ✅ in UI state | `owner_user_id` null or user id; `getStock('all' / 'mine' / 'shared')`; `moveToScope()` |
| Server-enforced isolation per user | 🟡 | Python backend isolates by household (tested) but has **no `owner_user_id` at all**; the React app has no server enforcement |
| Deduction order (shared first, then own personal) with a split on the confirm screen | 🟡 | Not verified in the React store; the Python mark-done has no personal-stock concept |
| Leaving a household removes personal items | ❌ | Not found |

### 2.14 Strict veg / non-veg
| Item | Status | Evidence / gap |
|---|---|---|
| Hard filter in code on ingredient data | 🟡 | `!r.isNonVeg` filters in `graphService` and the store; word-boundary keyword match, and "Eggetarian" labels are treated as non-veg (conservative, matches the plan's note) |
| **Fails open** when the client omits the preference | ❌ bug | `GET /api/graph/recipes` applies **no** filter if `diet_pref` is missing; `POST /api/graph/suggest-from-stock` defaults to **non-veg** when it is missing. `/api/chat` correctly defaults to veg |
| Preference comes from the server | ❌ | `diet_pref` is read from the request body or query, so any client can ask for non-veg |
| Re-check of model output | ❌ | No re-check of proposed recipes, plan changes or shopping items against the diners' diets |
| Veg user's recipe edit adding a non-veg ingredient is rejected | ❌ | `modifyRecipeIngredient` and `confirmProposal` have no diet check |
| Mixed households (veg base dish + optional non-veg extra) | ❌ | `diner_member_ids` exists in the types; no mixed-diner logic found |
| Switching preference re-validates planned meals | ❌ | `setUserPreferences` only writes the value |
| Hidden non-veg (gelatin, stock cubes, mayonnaise/egg) | 🟡 | `gelatin` is in the keyword list; mayonnaise is not handled |

### 2.15 Protein tracking
| Item | Status | Evidence / gap |
|---|---|---|
| Per-member goal (weight, override) | 🟡 | Fields exist; goal is typed in, not derived from age and weight |
| Auto-logging when a meal is marked done | ✅ | `markMealDone()` writes intake logs |
| Manual quick-add logging | ❌ | Not found |
| Daily/weekly view | 🟡 | Home ring only. It uses `members[0]` (not the signed-in user), a 14 g default per meal when nutrition is missing, and sets the target to `max(goal, planned protein, 60)`, so the target silently rises with the plan |
| High-protein recipe filter | ✅ | `high_protein` on `/api/graph/recipes` |
| Protein gap add-on suggestions | ❌ | Not found |
| Intake visible only to its owner | ❌ | No access control in the browser store |

### 2.16 Beginner mode
| Item | Status | Evidence / gap |
|---|---|---|
| Per-user toggle, low-effort filter | ✅ | `is_beginner_cook`, `difficulty = beginner` (176 of 6,871 recipes in the seed) |
| "Show all recipes" override | 🟡 | Not verified |
| Beginner recipe view (numbered steps, timers, glossary, katori/spoon units) | ❌ | `RecipeModal` has no timers or glossary |

### 3. Voice and chat
| Item | Status | Evidence / gap |
|---|---|---|
| Chat with voice in Hindi, English, Hinglish | ✅ | `OmnirushVoiceModal`, `ChatTab`, Hindi/Hinglish number words parsed locally |
| Confirm card before any write | 🟡 | Cards exist, **but several paths set `auto_applied: true` and write immediately** (for example "move all missing items from Shop into inventory", plan edits), against the plan's "nothing is written until confirmed" rule |
| Adding a recipe with missing-ingredient flags from the graph DB | ❌ | No cross-reference or Add/Remove checklist; no remembered dismissed flags |
| Scope shown on card (personal vs shared) | ✅ | `target_scope` |

### 3.2 Speech routing
| Item | Status | Evidence / gap |
|---|---|---|
| Language detection | 🎭 | `detectLanguage` is a script check plus a list of Hinglish words, not Cactus |
| **Shruti and Cactus Whisper (offline)** | 🎭 | **No model weights, WASM or runtime exist in the repo.** The UI labels results "Shruti (offline)" and "Cactus Whisper (offline)", but the actual speech-to-text is the browser's Web Speech API (in Chrome this sends audio to Google, so it is neither local nor private) |
| Confidence score | 🎭 | `calculateTranscriptConfidence` starts at 0.88 and adds 0.04 per matched kitchen word; it is a text heuristic, not model confidence. The 0.75 fallback threshold is therefore not calibrated against anything |
| Cloud fallback to Sarvam Saaras v3 | ✅ | `/api/stt/transcribe` (needs `SARVAM_API_KEY`) |
| Calibration on recorded kitchen phrases | ❌ | None |

## 5. Security findings (ranked)

1. **No authentication on `server.ts`.** Every endpoint, including `/api/chat`, `/api/vision/scan`, `/api/stt/transcribe` and the `/live` Gemini WebSocket, is open. Anyone who can reach the server can spend your Gemini and Sarvam quota. There is also no rate limiting, CORS policy or security headers.
2. **`POST /api/graph/rebuild` is unauthenticated and takes a file path from the request body** (`csvPath`). The server reads that file, parses it as CSV and writes the result to `public/data/graph_rag.json`, which the static server can then serve. This is an arbitrary-file read-and-expose risk. Remove the route or restrict it to a fixed path and an admin check.
3. **The model context is labelled "server-generated, trusted" but is client-supplied.** In `/api/chat`, `household`, `stock`, `recipes` and `ingredient_aliases` come straight from the request body and are placed in the "trusted" block of the prompt. A client can inject text there.
4. **Diet filter fails open and trusts the client** (see 2.14).
5. **Confirm-before-write is client-side only** and `confirmProposal` does no expiry check (`expires_at` exists but is never read), no quantity or schema validation, no household or user check, and no diet re-check.
6. **Injection screening is six English-only regexes** and only adds a warning (the message says "treated strictly as data", which is not what the code does). The plan itself calls this detection-only; it has no Hindi/Hinglish patterns.
7. **`VITE_GEMINI_API_KEY` is accepted by `.env.example` and `server.ts`.** Anything named `VITE_*` is meant to be exposed to the browser bundle. Use only `GEMINI_API_KEY` on the server and remove the `VITE_` variant.
8. **`backend/mastmeals.db` is committed**, containing 3 users and 17 refresh-token hashes. Remove it from git and add it to `.gitignore`.
9. **25 MB JSON body limit** with no per-user cap makes the scan endpoint an easy cost lever.

## 6. Plan items with no implementation at all

Google Calendar (sync and reminders), Gmail order parsing, Swiggy MCP (tracking and real cart add), real Blinkit/Zepto price scraping, brand preference ranking, salt/oil health warnings, storage-tip and no-fridge quantity advice, invite-code join flow, fridge video scan, recipe-add flow with missing-ingredient flags, protein gap suggestions and manual protein logging, beginner step-by-step view with timers, mixed-household diner logic, sync API and last-write-wins, sync of edits with client ID, server-side auth for the React app, upload hardening, rate limits, and the data export / account deletion endpoints.

## 7. Added in this session (merged into `main` via pull request #1)

`backend/graph/` and `data/graph/` hold a separate, tested pipeline that converts `IndianFoodDatasetXLS.xlsx` into graph files and loads them into Kùzu:

- `parse.py` (ingredient-line parser, diet classifier, difficulty and equipment derivation) with 13 passing unit tests.
- `build_graph_data.py` writes node and edge CSVs plus `quality_report.json` (6,871 recipes, 1,606 ingredients, 72,919 recipe-ingredient edges).
- `kuzu_load.py` loads them in about 1 second; `graph_store.py` provides diet-filtered search, stock-based "what can I cook", scaling, similar recipes, missing-ingredient flags, and a re-check for model output.
- Verified: after a fix found during testing (a recipe titled "Chicken Pies" had veg ingredients and passed the veg filter), no `veg_safe` recipe contains a non-veg, egg or possible-egg ingredient, and a veg search for "chicken" returns nothing.
- Known gaps: 572 recipes (mostly Hindi-only ingredient lists) are marked `unknown` and excluded from the veg filter; 264 recipes where the dataset's diet label disagrees with the ingredients are flagged for review; "atta" has no mapped ingredient yet; nutrient (IFCT) and shelf-life (FoodKeeper) joins are not done; there are no embeddings.
- This pipeline is **independent of the existing TypeScript graph**; wiring it into `server.ts` (for example through a small Python service) is still to do. Generated output (`data/graph/`) is git-ignored and is rebuilt with the steps in `backend/graph/README.md`.

## 8. Suggested order of work for the demo

1. **Close the holes that can cost money or leak files:** add auth to `server.ts` (or remove open routes), delete `/api/graph/rebuild`, remove `VITE_GEMINI_API_KEY`.
2. **Make the diet filter fail closed:** read the preference on the server, default to veg, and re-check every model-proposed item.
3. **Stop labelling simulated features as real:** prices, Swiggy cart and the "offline" speech engines, or build them (the Swiggy cart needs the client-id approval first).
4. **Choose one stack** (section 2) and port the auth and confirm logic.
5. **Then add the missing features** from section 6, starting with the ones the demo story depends on: onboarding gate, invite join, salt/oil warnings, recipe-add flags, and the storage guide.
