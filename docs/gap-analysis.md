# Gap analysis: project vs the Mast Meals spec

Audit of this repo against `Mast Meals (1).md` (the combined spec: sections 1 to 9).
Status values: **Built** (works and is verified), **Partial** (some of it works),
**Missing** (not started), **Blocked** (needs an external approval, key or toolchain).

Verified by `backend/smoke_test.py` (23 checks) plus manual HTTP and browser runs on 30 Oct 2026.

## Section 1: baseline loop

| Requirement | Status | Where / what remains |
|---|---|---|
| Weekly planner, breakfast/lunch/dinner | Built | `meal_plans` + `planned_meals`; `GET/POST /api/plan*`, Plan tab |
| AI suggestions from available stock | Partial | Agent runs in `plan` mode with stock in CONTEXT, but nothing persists a whole suggested week; suggestions are chat-only |
| Recipe library scaled to household size | Built | `recipe_requirements()` scales by `servings / base_servings`; verified 180 g chawal becomes 360 g at 4 servings |
| Stock with unit handling | Built | Base units only (`g`, `ml`, `pcs`), `CHECK (qty_base >= 0)`; unit conversion table (`units`) missing, so display units are not converted |
| Stock check and missing alerts | Partial | `GET /api/plan/check` returns per-week shortages; no "today" view and no push notifications |
| Mark meal done, deduct stock | Built | `POST /api/plan/meals/{id}/done`, writes `stock_events` (reason `meal_done`), increments `times_cooked`; double-done returns 409 |
| Missing items become a shopping list | Partial | `POST /api/shopping-list/generate` + Shop tab; no quick-commerce handoff |

## Section 2: features

| Feature | Status | Notes |
|---|---|---|
| 2.1 Onboarding and household profile | Partial | Members (age groups), cautions and `has_fridge` are stored and served. Google sign-in exists server-side only; no app consent screen. Calendar sync missing |
| 2.2 Recipe store (graph RAG, offline) | Partial | Canonical recipes live in SQL with a `graph_node_id`; no graph/vector DB, no phone cache, no dismissed-flag memory, no last-write-wins merge on push |
| 2.3 Quantity calculation and stock check | Built | Scaling, per-recipe `enough` flags, `missing` list |
| 2.4 AI weekly suggestions | Partial | Prompt supports it; no endpoint that stores a suggested week |
| 2.5 Inventory updates (receipt OCR, fridge scan) | Missing | No Gemini calls, no upload endpoint, no `captures` tables. Manual single-item adjust is built (`POST /api/stock/adjust`) |
| 2.6 Order tracking (Swiggy MCP, Gmail) | Blocked / Missing | Needs the Swiggy client-id allowlist and Gmail test users; nothing implemented |
| 2.7 Shopping list and ordering | Partial | List built; Swiggy cart handoff absent (no MCP client), no checkout by design |
| 2.8 Price comparison (scrapers) | Missing | No background worker, no `price_snapshots` |
| 2.9 Brand preference ranking | Missing | No `brands` / `brand_preferences`, no signal ingestion |
| 2.10 Google Calendar reminders | Missing | No `reminders` table, no Calendar client |
| 2.11 Health tracker | Partial | Per-meal nutrients are computed from `nutrients_per_100` and stored on the meal; no caution checks ("too much salt") and no UI |
| 2.12 Storage guide and quantity advice | Partial | `storage_place` and `shelf_life_days` exist per ingredient; no advice surface and no no-fridge quantity logic |

## Section 3: voice and chat

| Requirement | Status | Notes |
|---|---|---|
| Chat edits with confirm card | Built | `POST /api/chat` returns a proposal, `POST /api/confirm` applies it; UI shows projected stock per row |
| 3.1 Adding a recipe | Partial | `add_recipe` proposals create a `household_recipes` row; no canonical cross-reference, no checklist screen, no dismissed flags |
| 3.2 STT routing (Cactus/Shruti, Sarvam fallback) | Missing | Entirely on-device in Flutter, which is not installed. `/api/chat` accepts `stt_engine` and `stt_confidence` so the routing decision can be passed in |
| Voice input | Missing | Typed only |

## Section 4: architecture

| Requirement | Status | Notes |
|---|---|---|
| 4.1 Flutter app | Missing | Flutter is not installed on this machine. `MastMeals-test.apk` is a WebView shell that loads the backend UI; it is a test harness, not the product client |
| 4.2 FastAPI backend | Partial | REST with tokens; no scrapers worker, no Gemini/Sarvam/Swiggy/Gmail calls |
| 4.3 Sync-compatible schema | Partial | UUID keys, `version`/`updated_at`/`updated_by_client`/`deleted_at`, `sync_log` sequence and `GET /api/sync` delta pull. No push endpoint and no conflict resolution |
| 4.4 Sync API contract | Partial | Pull side implemented; push side (`POST /api/sync`) not written |

## Section 5: database

Partial. 20 of the spec's tables exist, in SQLite at `backend/mastmeals.db`, with the spec's
column names and constraints. Missing tables: `units`, `brands`, `recipe_families`,
`dismissed_recipe_flags`, `price_snapshots`, `orders`, `order_items`, `captures`,
`capture_items`, `brand_preferences`, `reminders`, `integrations`.

SQLite stands in because no Postgres server is installed here. `pgcrypto`, `BIGSERIAL` and
`BYTEA` details from section 5 are therefore unimplemented; `DATABASE_URL` is unused.

## Section 6: security

| Requirement | Status | Notes |
|---|---|---|
| 6.1 Login and tokens | Partial | Access token 15 min (HS256, fixed alg, iss/aud/exp/iat checked); refresh 30 days, opaque, hashed with a pepper, single-use rotation; reuse revokes the whole family and writes an audit row; logout revokes the device. Google ID token verified via Google's `tokeninfo` when client ids are set. Missing: a Flutter client, and the WebView harness keeps tokens in `localStorage`, which the spec forbids |
| 6.2 Authorization | Built | Household and client come from the token only; membership rechecked per request; another household's rows return the same 404 as missing rows (tested) |
| 6.3 AI-driven change rules | Built | `pending_actions` (TTL 20 min, bound to household + client), writes only from a confirmed id, ids/quantities/units validated, no order-placing tool exists |
| 6.4 Prompt injection defense | Partial | Layer 1 partly (confirm gate, kill switches in env, no checkout); Layer 3 (length cap, NFKC, phrase screen, zero-width/tag strip, flag-not-block); Layer 5 (link/markdown strip, length cap). Missing: UTS-39 confusables, Base64/hex decode-for-inspection, fuzzy matching, guardrail model, alerting, attack harness |
| 6.5 Third-party connections | Missing | No Gmail/Calendar/Swiggy OAuth, no encrypted token storage (`integrations`), no disconnect flow |
| 6.6 Uploads | Missing | No upload endpoints, no EXIF stripping, no media retention |
| 6.7 Abuse and cost | Partial | Per-household 20/min cap on `/api/chat`; no per-IP limits, no daily cap, no request-body limit |
| 6.8 Server and network | Missing | Plain HTTP, docs enabled, no HSTS/CORS/host allow-list. Acceptable only for a LAN test |
| 6.9 Database and secrets | Partial | `.env` gitignored; secrets read from env; no least-privilege DB user, no KMS, no migrations, no rotation procedure |
| 6.10 Flutter hardening | Blocked | No Flutter app to harden |
| 6.11 Privacy and data handling | Missing | No consent screens, no export or account-deletion endpoints |
| 6.12 Logging and monitoring | Partial | `audit_log` covers login, proposal created/confirmed, member changes, meal done; no alerts, no retention job, no separation from app logs |
| 6.13 Testing | Partial | 23-check smoke test; no upload tests, no injection attack/benign suite, no dependency scanning |
| 6.14 Priority order | 1 partial, 2 built, 3 built, 4 built, 5 partial, 6 partial (rotation yes, third-party token encryption no), 7 partial (audit yes, deletion and consent no) |

## Section 7 constraints (unchanged, not code)

Swiggy allowlist, Gmail test users, fragile scrapers, STT accuracy and fridge-scan approximation
all still apply. Section 8 (smart fridge) stays parked.

## What blocks the rest

- **Swiggy MCP**: builder approval / client-id allowlist. Cart and tracking cannot be built before that.
- **Google Gmail and Calendar scopes**: sensitive-scope verification; test users only.
- **Gemini and Sarvam keys**: receipt OCR and cloud speech fallback need `GEMINI_API_KEY` and `SARVAM_API_KEY`.
- **Postgres**: schema is SQLite-only here; `DATABASE_URL` is unused.
- **Flutter SDK**: the product client, STT routing and secure token storage all depend on it.

## Suggested build order from here

1. Sync push endpoint with last-write-wins and conflict tests (`POST /api/sync`), closing 4.3/4.4.
2. Upload + receipt OCR pipeline with the confirm-and-edit screen (2.5, 6.6), using the quarantined prompt already in `prompts/companion-extractions.txt`.
3. Plan generation that persists a suggested week from stock (1, 2.4).
4. Health caution checks and storage advice over existing nutrient/storage columns (2.11, 2.12).
5. Injection attack harness and guardrail layer for the approval-flow paths (6.4, 6.13).
