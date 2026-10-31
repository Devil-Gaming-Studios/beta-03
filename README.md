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
   - Set **Shop Contact Name** to your shopkeeper's exact WhatsApp or Telegram contact name (e.g. `Gupta Kirana Store`).
   - Tap **Open Notification Access Settings** and toggle **ON** for Mast Meals.
   - Verify status shows **GRANTED (Active)**.
   - Configure **Server URL** (default `http://localhost:3000`).
   - Configure **User Authorization Token** (default `test_token_household_alpha`).
4. When your shopkeeper sends a message like `"Bhaiya 5kg atta aur 1L doodh pack ho gaya"`, it is automatically received, queued offline if disconnected, and sent to `/api/shop-inbox`.
5. Review and confirm the items in the **Shop tab** under **Shop Chat Listener**.

---

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
