# Mast Meals 02: Voice and Chat Assistant

## Overview

- Chat screen with voice support, in Hindi and English
- Through chat the user can edit meal plans, update inventory and add new recipes
- Every change goes through a confirm card first; nothing is written until the user confirms

### 3.1 Adding a new recipe
1. User dictates or types the recipe; the LLM extracts ingredients and quantities
2. The server cross-references it with the matching recipe in the graph DB
3. A checklist confirmation screen flags ingredients missing from the user's version
4. Each flagged item has Add or Remove, plus a manual add row
5. On confirm, the recipe is saved to the local cache and synced with the client ID

- Flags are suggestions, never auto-added; dismissed flags are remembered per recipe
- If there is no canonical match in the DB, only the extracted list is shown

### 3.2 Speech-to-text routing (local first, cloud only on low confidence)
1. Detect language: English, Hindi or Hinglish (Cactus has a Detect Language function)
2. Choose the local model by language:
   - English: Cactus Whisper
   - Hindi and Hinglish: Shruti (offline), or whichever local model scores best on the team's test set
3. Compute a confidence score for each transcript
4. If confidence is below the per-language threshold and the phone is online, fall back to the cloud: **Sarvam Saaras v3 (code-mix mode)**
5. If offline and low confidence, show the transcript as editable text and apply nothing until confirmed
6. Calibrate thresholds on about 100 recorded kitchen phrases per language (including ingredient names)
7. Seed custom vocabulary with ingredient names where supported

Other cloud options considered: Deepgram Nova-3 (multi), AssemblyAI Universal-3, Google Cloud Chirp, Gnani Prisma.
Other offline options considered: Whisper-tiny Hinglish, PolyWhisper Hinglish router, Vosk small.

---

**Mast Meals doc series:** 01 Overview and features · 02 Voice and chat · 03 Architecture · 04 Database schema · 05 Security and authorization · 06 Prompt injection defense · 07 Omnirush agent prompts · 08 .env configuration · 09 Constraints and sources
