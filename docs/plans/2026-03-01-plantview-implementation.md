# PlantView Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vite/React SPA that looks up plants by name and pot size, showing an image, description, and size projections via LLM-generated data.

**Architecture:** Client-side only Vite/React/TypeScript app. Calls OpenRouter API for structured plant data and Unsplash API for images. Results cached in IndexedDB via `idb-keyval`. No backend.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, idb-keyval, OpenRouter API, Unsplash API

---

### Task 1: Scaffold Vite/React/TypeScript project

**Files:**
- Create: project scaffold via `npm create vite@latest`
- Modify: `package.json` (add dependencies)
- Create: `.env.example`
- Create: `.gitignore` (ensure `.env` excluded)

**Step 1: Scaffold the project**

Run from `/Users/halletj/git/plantview`:

```bash
npm create vite@latest . -- --template react-ts
```

Select the current directory. This creates `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `index.html`, etc.

**Step 2: Install dependencies**

```bash
npm install
npm install idb-keyval
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: Configure Tailwind with Vite**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

**Step 4: Create `.env.example`**

```
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

**Step 5: Ensure `.gitignore` includes `.env`**

Check the generated `.gitignore` — it should already have `.env` entries from the Vite template. If not, add:

```
.env
.env.local
```

**Step 6: Clean up starter files**

- Delete `src/App.css`
- Replace `src/App.tsx` with a minimal placeholder:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold text-center py-8">PlantView</h1>
    </div>
  );
}

export default App;
```

- Update `src/main.tsx` to import `index.css` (should already be there from scaffold).

**Step 7: Verify it runs**

```bash
npm run dev
```

Expected: Dev server starts, browser shows "PlantView" heading with Tailwind styles applied.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite/React/TypeScript project with Tailwind CSS"
```

---

### Task 2: Define TypeScript types and LLM prompt

**Files:**
- Create: `src/types.ts`
- Create: `src/prompt.ts`

**Step 1: Create types file**

Create `src/types.ts`:

```ts
export interface SizeRange {
  height_min_cm: number;
  height_max_cm: number;
  width_min_cm: number;
  width_max_cm: number;
}

export interface PlantData {
  common_name: string;
  scientific_name: string;
  description: string;
  pot_size_cm: number;
  pot_size_note: string;
  current_size: SizeRange;
  size_12_months: SizeRange;
  size_24_months: SizeRange;
  mature_size: SizeRange & { context: string };
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface PlantResult {
  plant: PlantData;
  imageUrl: string | null;
  imageAttribution: {
    photographerName: string;
    photographerUrl: string;
    unsplashUrl: string;
  } | null;
}
```

**Step 2: Create prompt file**

Create `src/prompt.ts`:

```ts
export function buildPlantPrompt(query: string): string {
  return `You are a horticultural data assistant. Given a plant query, return ONLY valid JSON matching the schema below. No markdown, no explanation, just JSON.

The user query is: "${query}"

Parse the query to identify the plant name and optional pot size. If no pot size is given, recommend the most common/appropriate pot size for this plant.

Return JSON matching this exact schema:
{
  "common_name": "string",
  "scientific_name": "string",
  "description": "string (2-3 sentences about the plant)",
  "pot_size_cm": number,
  "pot_size_note": "string (e.g. 'Specified by user' or 'Recommended for this plant')",
  "current_size": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "size_12_months": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "size_24_months": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "mature_size": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number,
    "context": "string (e.g. 'indoors, typical home conditions')"
  },
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

Rules:
- All sizes are ranges (min and max), never single values
- All measurements in centimetres
- Size estimates assume typical indoor growing conditions unless the plant is primarily outdoor
- Growth projections assume the plant stays in the specified pot size
- Confidence reflects how well-documented this plant's size data is
- If you don't recognize the plant, return JSON with common_name set to "Unknown" and confidence "LOW"`;
}
```

**Step 3: Commit**

```bash
git add src/types.ts src/prompt.ts
git commit -m "feat: add TypeScript types and LLM prompt template"
```

---

### Task 3: Build API service layer

**Files:**
- Create: `src/api.ts`

**Step 1: Create the API service**

Create `src/api.ts`:

```ts
import type { PlantData, PlantResult } from "./types";
import { buildPlantPrompt } from "./prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UNSPLASH_URL = "https://api.unsplash.com/search/photos";

export async function fetchPlantData(query: string): Promise<PlantData> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_OPENROUTER_API_KEY environment variable");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-OpenRouter-Title": "PlantView",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: buildPlantPrompt(query) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in LLM response");

  // Strip markdown code fences if present
  const jsonStr = content.replace(/^```json?\n?/gm, "").replace(/\n?```$/gm, "").trim();
  return JSON.parse(jsonStr) as PlantData;
}

export async function fetchPlantImage(
  plantName: string
): Promise<{ url: string; photographerName: string; photographerUrl: string; unsplashUrl: string } | null> {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const params = new URLSearchParams({
    query: `${plantName} plant`,
    per_page: "1",
    orientation: "squarish",
  });

  const response = await fetch(`${UNSPLASH_URL}?${params}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const photo = data.results?.[0];
  if (!photo) return null;

  return {
    url: photo.urls.regular,
    photographerName: photo.user.name,
    photographerUrl: photo.user.links.html,
    unsplashUrl: photo.links.html,
  };
}

export async function lookupPlant(query: string): Promise<PlantResult> {
  const plant = await fetchPlantData(query);

  const image = await fetchPlantImage(plant.common_name);

  return {
    plant,
    imageUrl: image?.url ?? null,
    imageAttribution: image
      ? {
          photographerName: image.photographerName,
          photographerUrl: image.photographerUrl,
          unsplashUrl: image.unsplashUrl,
        }
      : null,
  };
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: add OpenRouter and Unsplash API service layer"
```

---

### Task 4: Add IndexedDB caching layer

**Files:**
- Create: `src/cache.ts`
- Modify: `src/api.ts` (wrap `lookupPlant` with cache)

**Step 1: Create cache module**

Create `src/cache.ts`:

```ts
import { get, set } from "idb-keyval";
import type { PlantResult } from "./types";

function normalizeKey(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function getCachedResult(query: string): Promise<PlantResult | undefined> {
  const key = `plant:${normalizeKey(query)}`;
  return get<PlantResult>(key);
}

export async function setCachedResult(query: string, result: PlantResult): Promise<void> {
  const key = `plant:${normalizeKey(query)}`;
  await set(key, result);
}
```

**Step 2: Integrate cache into api.ts**

Add cache check to `lookupPlant` in `src/api.ts`. Replace the `lookupPlant` function:

```ts
import { getCachedResult, setCachedResult } from "./cache";

export async function lookupPlant(query: string): Promise<PlantResult> {
  const cached = await getCachedResult(query);
  if (cached) return cached;

  const plant = await fetchPlantData(query);
  const image = await fetchPlantImage(plant.common_name);

  const result: PlantResult = {
    plant,
    imageUrl: image?.url ?? null,
    imageAttribution: image
      ? {
          photographerName: image.photographerName,
          photographerUrl: image.photographerUrl,
          unsplashUrl: image.unsplashUrl,
        }
      : null,
  };

  await setCachedResult(query, result);
  return result;
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 4: Commit**

```bash
git add src/cache.ts src/api.ts
git commit -m "feat: add IndexedDB caching for plant lookups"
```

---

### Task 5: Build SearchBar component

**Files:**
- Create: `src/components/SearchBar.tsx`

**Step 1: Create the component**

Create `src/components/SearchBar.tsx`:

```tsx
import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='e.g. "Monstera deliciosa 15cm pot"'
        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Looking up..." : "Go"}
      </button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SearchBar.tsx
git commit -m "feat: add SearchBar component"
```

---

### Task 6: Build SizeTable component

**Files:**
- Create: `src/components/SizeTable.tsx`

**Step 1: Create the component**

Create `src/components/SizeTable.tsx`:

```tsx
import type { SizeRange } from "../types";

interface SizeStage {
  label: string;
  size: SizeRange;
}

interface SizeTableProps {
  stages: SizeStage[];
}

function formatRange(min: number, max: number): string {
  if (min === max) return `${min}cm`;
  return `${min}–${max}cm`;
}

export function SizeTable({ stages }: SizeTableProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stages.map((stage) => (
        <div key={stage.label} className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
            {stage.label}
          </div>
          <div className="text-sm text-gray-700">
            <div>H: {formatRange(stage.size.height_min_cm, stage.size.height_max_cm)}</div>
            <div>W: {formatRange(stage.size.width_min_cm, stage.size.width_max_cm)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SizeTable.tsx
git commit -m "feat: add SizeTable component"
```

---

### Task 7: Build PlantCard component

**Files:**
- Create: `src/components/PlantCard.tsx`

**Step 1: Create the component**

Create `src/components/PlantCard.tsx`:

```tsx
import type { PlantResult } from "../types";
import { SizeTable } from "./SizeTable";

interface PlantCardProps {
  result: PlantResult;
}

export function PlantCard({ result }: PlantCardProps) {
  const { plant, imageUrl, imageAttribution } = result;

  const stages = [
    { label: "Now", size: plant.current_size },
    { label: "12 Months", size: plant.size_12_months },
    { label: "24 Months", size: plant.size_24_months },
    { label: "Fully Grown", size: plant.mature_size },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <div className="sm:flex">
        {imageUrl && (
          <div className="sm:w-48 sm:flex-shrink-0">
            <img
              src={imageUrl}
              alt={plant.common_name}
              className="w-full h-48 sm:h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 flex-1">
          <h2 className="text-xl font-bold text-gray-900">{plant.common_name}</h2>
          <p className="text-sm text-gray-500 italic">{plant.scientific_name}</p>
          <p className="mt-2 text-sm text-gray-700">{plant.description}</p>
          <p className="mt-2 text-xs text-green-700 font-medium">
            Pot: {plant.pot_size_cm}cm — {plant.pot_size_note}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Growth Projections</h3>
        <SizeTable stages={stages} />
        {plant.mature_size.context && (
          <p className="text-xs text-gray-400 mt-2 text-center">{plant.mature_size.context}</p>
        )}
        <p className="text-xs text-gray-400 mt-1 text-center">
          Confidence: {plant.confidence}
        </p>
      </div>

      {imageAttribution && (
        <div className="px-5 pb-3 text-xs text-gray-400">
          Photo by{" "}
          <a href={imageAttribution.photographerUrl} className="underline" target="_blank" rel="noopener noreferrer">
            {imageAttribution.photographerName}
          </a>{" "}
          on{" "}
          <a href={imageAttribution.unsplashUrl} className="underline" target="_blank" rel="noopener noreferrer">
            Unsplash
          </a>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/PlantCard.tsx
git commit -m "feat: add PlantCard component with image and attribution"
```

---

### Task 8: Wire everything together in App

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update App.tsx**

Replace `src/App.tsx`:

```tsx
import { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { PlantCard } from "./components/PlantCard";
import { lookupPlant } from "./api";
import type { PlantResult } from "./types";

function App() {
  const [result, setResult] = useState<PlantResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(query: string) {
    setIsLoading(true);
    setError(null);
    try {
      const plantResult = await lookupPlant(query);
      setResult(plantResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">PlantView</h1>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

      <div className="mt-8">
        {isLoading && (
          <div className="text-center text-gray-500">
            <div className="animate-pulse text-lg">Looking up plant...</div>
          </div>
        )}

        {error && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && !isLoading && <PlantCard result={result} />}
      </div>
    </div>
  );
}

export default App;
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up App with search, loading, error, and result display"
```

---

### Task 9: Manual integration test

**Files:** None (manual verification)

**Step 1: Create `.env` file with real API keys**

```bash
cp .env.example .env
```

Then edit `.env` and add your real OpenRouter and Unsplash API keys.

**Step 2: Start the dev server**

```bash
npm run dev
```

**Step 3: Test in browser**

1. Open the dev server URL (usually `http://localhost:5173`)
2. Type "Monstera deliciosa" and click Go
3. Verify: loading state appears, then a card with image, description, and size table
4. Type "Fiddle Leaf Fig 20cm pot" and click Go
5. Verify: card shows with pot size 20cm and "Specified by user" note
6. Search "Monstera deliciosa" again
7. Verify: result appears instantly (from cache, no network requests in devtools)

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

### Task 10: Clean up and final polish

**Files:**
- Modify: `index.html` (update title)
- Delete: `src/assets/react.svg`, `public/vite.svg` (unused scaffold files)

**Step 1: Update index.html title**

In `index.html`, change `<title>Vite + React + TS</title>` to `<title>PlantView</title>`.

**Step 2: Remove unused scaffold files**

```bash
rm -f src/assets/react.svg public/vite.svg
```

**Step 3: Verify the app still runs**

```bash
npm run dev
```

Expected: No errors, app works.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up scaffold files and update page title"
```
