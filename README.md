# Mast Meals - KitchenSync

Connecting weekly meal planning, Graph RAG recipes, kitchen inventory stock, and automated shopping into one seamless loop for Indian households, powered by Omnirush AI.

Available as both a responsive Progressive Web App (PWA) and a native Android WebView application with background WhatsApp/Telegram shop chat listeners.

---

## Key Features

- **Weekly Meal Planner (`Plan` tab)**:
  - 7-day breakfast, lunch, and dinner meal planning with serving size scaling (1..20 servings).
  - Shortage alerts: flags missing ingredients for planned meals.
  - "Mark done": automatically deducts recipe ingredients from stock with duplicate deduction prevention.
  - "Skip": records skipped meals without stock deduction.
  - Recipe inspector: displays scaled ingredient requirements, nutrition profiles (calories, protein, carbs, fat, sodium), and diet caution guidance.

- **Kitchen Stock Inventory (`Stock` tab)**:
  - Real-time inventory with base units (`g`, `ml`, `pcs`), storage locations (`pantry`, `fridge`), and shelf-life indicators.
  - Multi-batch tracking: distinct expiries for identical items are tracked as separate entities.
  - In-line restock buttons next to every item in the stock list.

- **Automated Shopping List & Quick Commerce (`Shop` tab)**:
  - Generates shopping list from plan shortages across the scheduled week.
  - Price comparison benchmarks (Blinkit, Zepto, Swiggy Instamart).
  - Swiggy Instamart cart handoff simulation (cart-only per safety spec, no automatic orders).

- **Shop Chat Listener & Pending Inbox**:
  - Native Android `NotificationListenerService` reads incoming grocery confirmations **only** from `com.whatsapp` and `org.telegram.messenger` matching your configured shop contact name (e.g., `"Gupta Kirana Store"`).
  - Strict privacy: all other notifications are ignored and never logged or stored.
  - Ingestion endpoint `POST /api/shop-inbox` treats chat text as untrusted data, extracts grocery items using Gemini with strict JSON schema, and places them into a pending inbox.
  - Telegram bot webhook support (`POST /api/telegram-webhook`) with secret token validation and chat-ID allowlist.
  - "Shop list" confirm-and-edit card in the web UI: review extracted items, edit quantities/units/locations, and confirm before adding to stock or shopping list.
  - `window.AndroidBridge.onShopMessage` bridge sends live notifications from native Android into the web app view.

- **Omnirush Voice & Multilingual STT (`Chat` modal)**:
  - Multilingual voice/text assistant supporting English, Hindi (Devanagari), and Hinglish (e.g., `"do kilo aloo aur ek litre dahi add kar do"`, `"dinner me paneer bhurji rakh do"`).
  - Dual Speech-to-Text engine: Browser Speech Recognition with automatic fallback to Gemini Multimodal Audio transcription (`/api/stt/transcribe`) when device speech services are unavailable.
  - Strict **confirm-before-write safety**: AI proposals are rendered as interactive cards with projected stock before and after changes.

---

## Web Development & Quick Start

```bash
# Install dependencies
npm install

# Start Express & Vite development server on http://localhost:3000
npm run dev

# Run TypeScript compilation and build production assets
npm run build
npm run start
```

---

## Native Android App (`android/`)

The native Android app is a lightweight native shell wrapping the same React/Vite web application with native hardware access and background services.

### 1. Requirements
- Android SDK (API 24+ minimum, compileSdk 34)
- JDK 17
- Android device or emulator with developer options enabled

### 2. Reverse Port Forwarding for Localhost Development
For Android device testing over USB, reverse port 3000 so the device accesses `http://localhost:3000` inside a secure context (required for `getUserMedia` microphone and camera):

```bash
adb reverse tcp:3000 tcp:3000
```

### 3. Cleartext & Network Security
Cleartext traffic (`http://`) is strictly restricted to `localhost`, `127.0.0.1`, `10.0.2.2` (Android emulator), and local LAN subnets via `android/res/xml/network_security_config.xml`.

### 4. Building the Android App

#### Option A: Gradle Build (Android Studio or CLI)
```bash
cd android
./gradlew assembleDebug
```
The resulting APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

#### Option B: Standalone Script Build (no Gradle required)
```bash
cd android
./build.sh
```
The script compiles all Java files with `javac`, packages with `d8`, links with `aapt2`, signs, and outputs `MastMeals-test.apk`.

### 5. Configuring Shop Chat Listener on Device
1. Install the APK on your device:
   ```bash
   adb install -r android/build/MastMeals-test.apk
   ```
2. Open **Mast Meals** on the device.
3. Tap the floating **⚙ (Settings)** button in the bottom right:
   - **Shop Contact Name**: Set to your shopkeeper's exact WhatsApp or Telegram contact name (e.g. `Gupta Kirana Store`).
   - **Notification Access**: Tap **Open Notification Access Settings** and toggle **ON** for Mast Meals. Verify status shows **GRANTED (Active)**.
   - **Battery Optimization**: Tap **Disable Battery Optimization** to ensure Android does not sleep the background listener when idle.
   - **Privacy & Pause Monitoring**: Toggle the pause switch at any time to temporarily stop monitoring, or tap **Clear Stored Offline Messages** to delete local cached data.
   - **Auto-Rebind & Boot Reliability**: The app registers a `BootReceiver` that automatically rebinds `ShopNotificationListenerService` and retries unsynced messages when the device reboots.
   - Configure **Server URL** (default `http://localhost:3000`).
   - Configure **User Authorization Token** (default `test_token_household_alpha`).
4. When your shopkeeper sends a WhatsApp message (`com.whatsapp` or `com.whatsapp.w4b`) or Telegram message:
   - The service extracts individual messages from grouped `MessagingStyle` notifications (`EXTRA_MESSAGES`).
   - Filters out group summaries and `"N new messages"` placeholder previews.
   - Dedupes by `(sender, timestamp, text)` in local cache.
   - Sends the message to `POST /api/shop-inbox`.
   - If offline, queues the message in local SQLite (`shop_inbox.db`) and automatically retries every 30 seconds when network reconnects.
5. In the web app **Shop tab**:
   - Review pending messages in the **Shop Chat Listener** card.
   - Edit item names, quantities, base units (`g`, `ml`, `pcs`), storage locations (`fridge`, `pantry`), or household scope (`shared`, `personal`).
   - Click **Confirm & Add to Stock** or **Add to Shop List**. Items are **never** written to inventory without your explicit manual confirmation.
   - When running on Web-only or iPhone, use the **Paste / Web Chat** button to paste copied shopkeeper messages or click **Open WhatsApp** (`wa.me`) to open the chat directly.

### 6. Automated Testing
Run the automated test suite for WhatsApp shop chat extraction schema, prompt injection defense, and 24h deduplication:
```bash
npm run test:shop-inbox
```

## Telegram Bot Ingestion Setup

To receive grocery lists and pickup confirmations via Telegram Bot:

1. Configure environment variables in `.env`:
   ```bash
   TELEGRAM_BOT_SECRET_TOKEN="your_random_secret_token"
   TELEGRAM_ALLOWED_CHAT_IDS="123456789,987654321" # comma-separated chat IDs allowed to submit orders
   ```
2. Set Telegram Webhook:
   ```bash
   curl -F "url=https://your-domain.com/api/telegram-webhook" \
        -F "secret_token=your_random_secret_token" \
        https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```
3. Incoming orders sent to the Telegram bot are validated, checked against the allowlist, parsed with Gemini, and placed into the pending shop inbox.

---

## Official Swiggy MCP Server & OAuth 2.1 Integration

KitchenSync integrates directly with Swiggy's official Model Context Protocol (MCP) server and OAuth 2.1 + PKCE authentication (`https://mcp.swiggy.com/`).

### 1. Official Authentication Flow (Phone + OTP on Swiggy Domain)
1. Open the **Shop** screen and tap **Connect Swiggy** (or **Swiggy Cart**).
2. KitchenSync initiates an OAuth 2.1 PKCE (`S256`) authorization handshake with cryptographically signed state.
3. You are redirected to Swiggy's official secure authorization page (`https://mcp.swiggy.com/auth/authorize`).
4. Enter your Swiggy-registered mobile number and receive a secure one-time password (OTP) directly from Swiggy.
5. KitchenSync **never** collects, logs, or stores your OTP or password.
6. Once approved, Swiggy returns an authorization code which KitchenSync exchanges server-side for access and refresh tokens.
7. Tokens are encrypted at rest with AES-256-GCM using backend environment keys (`TOKEN_ENCRYPTION_KEYS`) and never exposed to the client browser.

### 2. Environment Variables (.env)
```bash
SWIGGY_MCP_URL="https://mcp.swiggy.com/food"
SWIGGY_INSTAMART_MCP_URL="https://mcp.swiggy.com/im"
SWIGGY_OAUTH_REDIRECT_URI="http://localhost:3000/api/swiggy/callback"
SWIGGY_MCP_CLIENT_ID="swiggy-mcp"
TOKEN_ENCRYPTION_ACTIVE_KEY_ID="primary"
TOKEN_ENCRYPTION_KEYS='{"primary":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}'
```

### 3. Swiggy MCP Tool Discovery & Cart Safety
- **Dynamic Tool Discovery**: Discovers tools dynamically via Streamable HTTP JSON-RPC `tools/list` on `https://mcp.swiggy.com/im` and `https://mcp.swiggy.com/food`.
- **Search & Price Benchmarking**: Fetches live product names, prices, and inventory without hardcoded catalogs.
- **Explicit User Confirmation**: The application generates a cart preview for user inspection before any cart modification. KitchenSync will **never** automatically execute payment or finalize orders without explicit manual confirmation.

---

## Cloud Kitchen Mode (Commercial Kitchen Management)

KitchenSync provides a dedicated **Cloud Kitchen** operating mode alongside Home and Hostel Kitchens. Unlike household meal planners with 3 fixed meals a day, cloud kitchens cook to customer orders and owner-announced bulk batches.

### Core Architecture & Capabilities
1. **Dynamic Kitchen Display System (KDS & Prep Queue)**:
   - Live kanban pipeline across 5 stages: `New` → `Accepted (Stock Reserved)` → `Cooking / In Prep (Stock Deducted)` → `Ready / Packing` → `Delivered / Picked Up`.
   - Printable / shareable Kitchen Order Tickets (KOT) with order items, variants, and customer delivery notes.
   - Omnichannel manual order entry (walk-in, phone call, WhatsApp, Telegram, Swiggy/Zomato manual entries).

2. **Inventory That Follows The Work**:
   - **Announce What I'm Cooking**: Scales recipe ingredients to target batch portions (e.g. 40 portions of Biryani), detects shortages, requires owner confirmation, and deducts raw stock upon announcement.
   - **Order-Driven Deduction & Reservation**: Cook-to-order dishes place active reservations upon order acceptance, deduct inventory upon preparation, and cleanly restore stock if an order is cancelled.
   - **Batch vs. Cook-To-Order**: Batch items draw from the cooked portions available pool; cook-to-order items deduct recipe ingredients per order.
   - **Wastage & Spoilage**: Logs staff meals, customer returns, and spoilage with reason codes and cost impacts.
   - **Immutable Audit Ledger**: Every inventory change records who, when, change quantity, and linked order/batch.

3. **Deterministic Dietary Safety**:
   - Menu items and ingredients are strictly classified as `veg`, `egg`, or `nonveg` in code (never guessed by LLM).
   - "Pure-Veg Kitchen" toggle hides non-vegetarian dishes and ingredients kitchen-wide.

4. **Procurement & Contracted Suppliers**:
   - Automated purchase lists generated from inventory par levels and upcoming demand.
   - Full CRUD contractor directory: add and remove suppliers, modify contractor contact numbers, lead times, preferred brands, and notes.
   - Quick one-tap **Call** (`tel:`) and **WhatsApp** direct messaging links for suppliers.
   - Goods-received check-in workflow with stock increment and audit logging.

5. **Financial Reports & Performance**:
   - Real-time P&L analytics: Gross revenue, ingredient food cost, wastage cost, gross margin percentage, and top-selling dishes.
   - One-click CSV export of daily kitchen reports.

### Automated Test Suite
Run the comprehensive cloud kitchen integration test suite (unit normalization, diet tag derivation, roles, pure-veg filtering, batch deduction, order reservation/deduction/cancellation, wastage, and supplier lifecycle):
```bash
npx tsx scripts/test_cloud_kitchen.ts
```

### Out of Scope / Next Steps
- Payment gateway integrations (UPI / Razorpay / Stripe).
- Real-time live webhook ingestion from third-party delivery aggregators (Swiggy / Zomato merchant APIs).
- Automated GST invoicing & tax calculation.

