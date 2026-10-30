# Mast Meals (React)

Connecting the meal plan, recipes, and kitchen stock into one seamless loop for Indian households, with Omnirush AI assistant.

Rewritten as a React SPA on Vite, preserving the complete baseline loop, data models, design aesthetic, and security principles.

## Features

- **Weekly Meal Planner (`Plan` tab)**:
  - Weekly schedule (breakfast, lunch, dinner) with serving size scaling (1..20 servings).
  - Shortage alerts: flags missing ingredients for planned meals.
  - "Mark done": automatically deducts recipe ingredients from stock with duplicate deduction prevention.
  - "Skip": records skipped meals without stock deduction.
  - Recipe inspector: displays scaled ingredient requirements, nutrition profiles (calories, protein, carbs, fat, sodium), and diet caution guidance.

- **Kitchen Stock Inventory (`Stock` tab)**:
  - Real-time inventory with base units (`g`, `ml`, `pcs`), storage locations (`pantry`, `fridge`), and shelf-life indicators.
  - Stock adjustment interface: `add`, `remove`, and `set` operations.

- **Automated Shopping List (`Shop` tab)**:
  - Generates shopping list from plan shortages across the scheduled week.
  - Price comparison estimates (Blinkit, Zepto, Swiggy Instamart) with timestamps.
  - Swiggy Instamart cart handoff simulation (cart-only per safety spec, no automatic orders).

- **Omnirush Assistant (`Chat` tab)**:
  - Multilingual voice/text assistant supporting English, Hindi (Devanagari), and Hinglish (e.g., `"do kilo aloo aur ek litre dahi add kar do"`).
  - Modes: `chat` (inventory edits), `plan` (weekly meal suggestions), and `cart` (shopping cart proposals).
  - Strict **confirm-before-write safety**: AI proposals are rendered as interactive cards with projected stock before and after changes.
  - Injection screening and ingredient verification against canonical reference data.

- **Household Profile & Multi-Tenant Isolation**:
  - Household settings (refrigerator availability, app language).
  - Member management with age groups (kids, adults, elderly) and diet cautions (`diabetes`, `frequent upset stomach`, `heart conditions`).
  - Cross-household isolation testing (Alpha and Beta households).

## Development

```bash
npm run dev      # Starts dev server on port 3000
npm run build    # Compiles TypeScript and builds production bundle
```
