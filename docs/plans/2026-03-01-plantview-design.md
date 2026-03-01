# PlantView Design

## Overview

A Vite/React client-side SPA where users type a plant name (and optional pot size) into a search bar. The app calls an LLM via OpenRouter to generate structured plant data (description, sizes, growth projections) and fetches a photo from Unsplash. Results are cached in the browser so repeat lookups are instant and free.

## Tech Stack

- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **OpenRouter API** for LLM calls (start with a free/cheap model like Gemini Flash or GPT-4o mini)
- **Unsplash API** for plant images
- **IndexedDB** (via `idb-keyval`) for caching
- **Static hosting** (Netlify, Vercel, or GitHub Pages)

## UI Layout

Simple single-page layout:

- Header with app name
- Search bar: free-text input where users type a plant name and optional pot size (e.g. "Monstera deliciosa 15cm pot")
- Result card below the search bar with:
  - Plant image (from Unsplash)
  - Common name and scientific name
  - Description
  - Recommended pot size (if user didn't specify one)
  - Size table showing four stages: current size in pot, 12-month projection, 24-month projection, fully grown mature size
- All sizes displayed in metric (cm) as min-max ranges

## Data Flow

1. User types a plant name + optional pot size and hits Enter or clicks Go
2. App parses the input to extract plant name and pot size (if present)
3. Check IndexedDB cache (keyed by normalized plant name + pot size)
4. On cache miss:
   - Call OpenRouter API with a structured prompt requesting JSON
   - Call Unsplash API with the plant's common name for an image
5. LLM returns structured JSON with: common name, scientific name, description, recommended pot size, current size, 12-month projection, 24-month projection, mature size
6. Cache the combined result in IndexedDB
7. Render the result card

## LLM Response Schema

```json
{
  "common_name": "Monstera deliciosa",
  "scientific_name": "Monstera deliciosa",
  "description": "A tropical climbing plant known for its distinctive split leaves...",
  "pot_size_cm": 20,
  "pot_size_note": "Recommended for this plant",
  "current_size": {
    "height_min_cm": 30,
    "height_max_cm": 45,
    "width_min_cm": 25,
    "width_max_cm": 35
  },
  "size_12_months": {
    "height_min_cm": 50,
    "height_max_cm": 70,
    "width_min_cm": 35,
    "width_max_cm": 50
  },
  "size_24_months": {
    "height_min_cm": 80,
    "height_max_cm": 120,
    "width_min_cm": 50,
    "width_max_cm": 70
  },
  "mature_size": {
    "height_min_cm": 200,
    "height_max_cm": 300,
    "width_min_cm": 100,
    "width_max_cm": 150,
    "context": "indoors, typical home conditions"
  },
  "confidence": "MEDIUM"
}
```

All sizes are ranges (never single numbers) to manage LLM accuracy expectations.

## API Key Management

Client-side only — API keys exposed in browser:

- **For personal/dev use:** Store keys in env vars at build time via Vite's `VITE_` prefix
- **For public deployment later:** Add a thin Vercel/Netlify serverless function to proxy API calls

## Caching Strategy

- IndexedDB via `idb-keyval` for persistence across sessions
- Key format: normalized `{plantName}:{potSizeCm}` (e.g. `monstera-deliciosa:20`)
- Cache indefinitely — plant data doesn't change
- Image URLs cached alongside the plant data

## Components

- `App` — layout wrapper
- `SearchBar` — text input + submit button, parses plant name and optional pot size from input
- `PlantCard` — displays the result (image, description, size table)
- `SizeTable` — renders the four size stages (current, 12mo, 24mo, mature)
- `LoadingState` — skeleton/spinner while fetching
- `ErrorState` — handles API errors gracefully

## External APIs

### OpenRouter (LLM)

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: Bearer token via `VITE_OPENROUTER_API_KEY`
- Model: start with `google/gemini-2.0-flash-exp:free` or `openai/gpt-4o-mini`
- Cost: essentially free with caching (~$0.0003 per unique lookup with GPT-4o mini)

### Unsplash (Images)

- Endpoint: `https://api.unsplash.com/search/photos`
- Auth: `Authorization: Client-ID {ACCESS_KEY}` via `VITE_UNSPLASH_ACCESS_KEY`
- Rate limit: 50 req/hr (demo), 5,000 req/hr (production approved)
- Cost: free with photographer attribution
