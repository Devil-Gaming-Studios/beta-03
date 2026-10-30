# KitchenSync 01: Overview and Features

**Problem Statement 5.** A phone app that connects the meal plan, recipes and kitchen stock into one loop for Indian households.

## Baseline loop (from the problem statement)

- Weekly meal planner (breakfast, lunch, dinner), with AI suggestions from available stock
- Recipe library with ingredient quantities scaled to household size
- Kitchen stock with proper unit handling
- Stock check and missing-item alerts for today and the week
- Mark meal done; used quantities are deducted from stock automatically
- Missing items become a shopping list handed off to quick commerce

---

## Features

### 2.1 Onboarding and household profile
- Google OAuth login, with an option to sync Google Calendar on the registration page
- Household profile:
  - Number of members and their age groups (kids / adults / elderly)
  - Diet cautions: diabetes, frequent upset stomach, heart conditions
  - Whether the household has a fridge

### 2.2 Recipe store (graph RAG, offline-capable)
- Graph vector DB for recipes, **hosted server-side**
- Retrieval order: local cache first, then server; if neither has it, nothing is returned
- Changes allowed only on recipes already cached locally (change quantities, add/remove ingredients)
- Edits are saved in the local cache and synced to the server along with the client ID
- Offline retrieval from cached recipes
- Conflict rule for the same recipe edited on two phones: per-household last-write-wins

### 2.3 Quantity calculation and stock check
- Calculate ingredient quantities for the selected meal and household size
- Check against stock and flag available vs missing items

### 2.4 AI weekly meal suggestions
- Suggest meals for the week from stock and household members
- Where stock is short, suggest as far as stock allows and flag the rest

### 2.5 Inventory updates
- **Receipt OCR:** vision model with structured JSON output (e.g. Gemini) maps receipt items to stock
- **Fridge photo or video scan:** estimates available items
  - Always shows a **confirm-and-edit screen**
  - User can also state the full inventory, or update one item at a time
- Suggestions based on current stock

### 2.6 Order tracking
- **Swiggy Instamart (official MCP):** `track_order`, `get_orders`, `get_order_details`
  - Some tools are rolled out per account, so use only the tools the server lists
- **Blinkit and Zepto (no official API):** read-only Gmail API parsing of order confirmation emails
- Stock is updated when an order is delivered

### 2.7 Shopping list and ordering
- Missing items become a shopping list
- **Swiggy Instamart MCP, cart only:**
  - Add items to the Swiggy cart, **never place the order**
  - Redirect button to the Swiggy cart so the user confirms there
  - No checkout tool is exposed
  - Connect with a single Allow/Login tap (OAuth 2.1 with PKCE); Swiggy login is OTP-based
- Suggested items have a one-tap "Add to Swiggy cart" jump
- **Blinkit and Zepto:** scrapers for price and availability only, no auto cart-adders

### 2.8 Price comparison
- Show where each missing item is cheapest (Blinkit and Zepto scrapers)
- Every price shows an **"as of" timestamp**

### 2.9 Brand preference ranking
- Preferred brands, learned from previous orders and receipts, appear **first** in suggestion lists
- Signals: receipt OCR, parsed Gmail orders, Swiggy order history

### 2.10 Google Calendar reminders
- Option to add reminders (restock day, thawing, expiry) to Google Calendar

### 2.11 Health tracker
- Estimates nutrients per meal from recipe ingredients
- Gives suggestions such as "too much salt" or "too much oil", checked against household diet cautions
- Guidance only, not medical advice

### 2.12 Storage guide and purchase quantity advice
- Storage guidance per purchased item (cold place, fridge)
- For households without a fridge, suggest quantities that will not go stale or spoil

---

**KitchenSync doc series:** 01 Overview and features · 02 Voice and chat · 03 Architecture · 04 Database schema · 05 Security and authorization · 06 Prompt injection defense · 07 Omnirush agent prompts · 08 .env configuration · 09 Constraints and sources
