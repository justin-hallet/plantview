# Browser-Stored API Key & ALA Images — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the OpenRouter API key from build-time env var to browser storage with a settings UI, and replace Unsplash image source with Atlas of Living Australia (ALA).

**Architecture:** Client-side React SPA. API key stored in IndexedDB via `idb-keyval`. ALA species search API (no auth) replaces Unsplash for plant images, with Wikipedia as fallback. All changes are in the browser — no backend.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, idb-keyval

**Note:** This project has no test framework. Verification uses `tsc -b` for type checking and `npm run build` for build validation.

---

## Task 1: Add API Key Storage Helpers

**Files:**
- Modify: `src/cache.ts`

**Step 1: Add the three key storage functions to `src/cache.ts`**

Append to the end of `src/cache.ts`:

```ts
const API_KEY_STORE_KEY = "openrouter-api-key";

export async function getStoredApiKey(): Promise<string | undefined> {
  return get<string>(API_KEY_STORE_KEY);
}

export async function setStoredApiKey(key: string): Promise<void> {
  await set(API_KEY_STORE_KEY, key);
}

export async function deleteStoredApiKey(): Promise<void> {
  await del(API_KEY_STORE_KEY);
}
```

Note: `del` must be imported from `idb-keyval` alongside the existing `get` and `set`.

**Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: No errors

**Step 3: Commit**

```bash
git add src/cache.ts
git commit -m "feat: add API key storage helpers using idb-keyval"
```

---

## Task 2: Thread API Key Through API Functions

**Files:**
- Modify: `src/api.ts`

**Step 1: Change `fetchPlantData` to accept `apiKey` parameter**

In `src/api.ts`, change the function signature and remove the env var read:

```ts
export async function fetchPlantData(query: string, apiKey: string): Promise<PlantData> {
```

Remove lines 10-11 (the `import.meta.env` read and error throw). The `apiKey` comes from the parameter now.

**Step 2: Change `extractPlantsFromText` to accept `apiKey` parameter**

Same pattern:

```ts
export async function extractPlantsFromText(documentText: string, apiKey: string): Promise<PlantEntry[]> {
```

Remove lines 128-129 (the `import.meta.env` read and error throw inside this function).

**Step 3: Change `lookupPlant` to accept and thread `apiKey`**

```ts
export async function lookupPlant(query: string, apiKey: string): Promise<PlantResult> {
  const cached = await getCachedResult(query);
  if (cached) return cached;

  const plant = await fetchPlantData(query, apiKey);
  const image = await fetchPlantImage(plant.common_name, plant.scientific_name);
  // rest unchanged
```

**Step 4: Change `lookupPlantBatch` to accept and thread `apiKey`**

```ts
export async function lookupPlantBatch(
  entries: PlantEntry[],
  apiKey: string,
  onResult: (index: number, result: PlantResult) => void,
  onError: (index: number, error: string) => void
): Promise<void> {
```

Inside the `worker` function, change the call:
```ts
const result = await lookupPlant(query, apiKey);
```

**Step 5: Verify types compile**

Run: `npx tsc -b`
Expected: Errors in `src/App.tsx` because callers haven't been updated yet. That's expected — we fix those in Task 4.

**Step 6: Commit**

```bash
git add src/api.ts
git commit -m "refactor: thread apiKey parameter through API functions"
```

---

## Task 3: Create ApiKeyModal Component

**Files:**
- Create: `src/components/ApiKeyModal.tsx`

**Step 1: Create the modal component**

Create `src/components/ApiKeyModal.tsx`:

```tsx
import { useState } from "react";

interface ApiKeyModalProps {
  currentKeyHint: string | null; // masked key like "sk-or-...7f2a", or null if none
  onSave: (key: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ApiKeyModal({ currentKeyHint, onSave, onDelete, onClose }: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState("");
  const hasExistingKey = currentKeyHint !== null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">OpenRouter API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your key is stored locally in this browser and never sent to any server other than OpenRouter.
        </p>

        {hasExistingKey && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <code className="text-sm text-gray-600">{currentKeyHint}</code>
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-800 font-medium ml-3"
            >
              Delete
            </button>
          </div>
        )}

        <form onSubmit={handleSave}>
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={hasExistingKey ? "Enter new key to replace..." : "Enter your OpenRouter API key..."}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: No new errors from this file (App.tsx errors from Task 2 still expected)

**Step 3: Commit**

```bash
git add src/components/ApiKeyModal.tsx
git commit -m "feat: add ApiKeyModal component"
```

---

## Task 4: Wire Up API Key in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add imports, state, and key loading**

Add imports at top of `src/App.tsx`:

```ts
import { useState, useEffect } from "react";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { getStoredApiKey, setStoredApiKey, deleteStoredApiKey } from "./cache";
```

Add state variables inside `App()`:

```ts
const [apiKey, setApiKey] = useState<string | null>(null);
const [showApiKeyModal, setShowApiKeyModal] = useState(false);
const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
```

Add useEffect for key loading:

```ts
useEffect(() => {
  getStoredApiKey().then((key) => {
    if (key) setApiKey(key);
  });
}, []);
```

**Step 2: Add key helper and masking function**

```ts
function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 5) + "•••" + key.slice(-4);
}

async function handleSaveKey(key: string) {
  await setStoredApiKey(key);
  setApiKey(key);
  setShowApiKeyModal(false);
  if (pendingAction) {
    pendingAction();
    setPendingAction(null);
  }
}

async function handleDeleteKey() {
  await deleteStoredApiKey();
  setApiKey(null);
  setShowApiKeyModal(false);
}
```

**Step 3: Update `handleSearch` to check for key**

```ts
async function handleSearch(query: string) {
  if (!apiKey) {
    setPendingAction(() => () => handleSearch(query));
    setShowApiKeyModal(true);
    return;
  }
  setMode("single");
  setBatchItems([]);
  setIsLoading(true);
  setError(null);
  try {
    const plantResult = await lookupPlant(query, apiKey);
    setResult(plantResult);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong");
    setResult(null);
  } finally {
    setIsLoading(false);
  }
}
```

**Step 4: Update `handleFileSelected` to check for key**

Same pattern — check `apiKey` at the top, show modal if missing with `setPendingAction(() => () => handleFileSelected(file))`. Thread `apiKey` to `extractPlantsFromText(text, apiKey)` and `lookupPlantBatch(entries, apiKey, ...)`.

**Step 5: Add settings button and modal to JSX**

In the return JSX, add a settings gear button next to the title and render the modal:

```tsx
<div className="min-h-screen bg-gray-50 px-4 py-8">
  <div className="flex items-center justify-center mb-6 relative">
    <h1 className="text-3xl font-bold text-center text-green-800">PlantView</h1>
    <button
      type="button"
      onClick={() => setShowApiKeyModal(true)}
      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors no-print"
      title="Settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.07c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
      </svg>
    </button>
  </div>

  {/* ... rest of existing JSX ... */}

  {showApiKeyModal && (
    <ApiKeyModal
      currentKeyHint={apiKey ? maskKey(apiKey) : null}
      onSave={handleSaveKey}
      onDelete={handleDeleteKey}
      onClose={() => {
        setShowApiKeyModal(false);
        setPendingAction(null);
      }}
    />
  )}
</div>
```

**Step 6: Verify types compile and build passes**

Run: `npx tsc -b && npm run build`
Expected: Clean build, no errors

**Step 7: Manual verification**

Run: `npm run dev`
- Visit app in browser
- Click "Go" without entering a key — modal should appear
- Enter a key, click Save — search should proceed
- Reload page — key should persist (from IndexedDB)
- Click gear icon — modal shows masked key with Delete option

**Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up browser-stored API key with settings UI"
```

---

## Task 5: Clean Up Env Vars

**Files:**
- Modify: `.env.example`

**Step 1: Remove the OpenRouter key from `.env.example`**

The file currently has two lines. Remove the `VITE_OPENROUTER_API_KEY` line. Keep only `VITE_UNSPLASH_ACCESS_KEY` for now (it gets removed in Task 8).

Actually — since we're removing Unsplash in this same plan, and the OpenRouter key is being removed too, `.env.example` will be empty after Task 8. For now just remove the OpenRouter line.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: remove VITE_OPENROUTER_API_KEY from env example"
```

---

## Task 6: Update ImageAttribution Type

**Files:**
- Modify: `src/types.ts`

**Step 1: Update the `ImageAttribution` interface**

Change the source union and add the license field:

```ts
export interface ImageAttribution {
  source: "ala" | "wikipedia";
  photographerName?: string;
  photographerUrl?: string;
  sourceUrl: string;
  license?: string;
}
```

**Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: Errors in `PlantCard.tsx` where the old `"unsplash"` branch is referenced. That's expected — we fix it in Task 7.

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: update ImageAttribution for ALA source"
```

---

## Task 7: Update PlantCard Attribution Display

**Files:**
- Modify: `src/components/PlantCard.tsx`

**Step 1: Replace the Unsplash attribution branch with ALA**

In `PlantCardLoaded`, replace the attribution section (lines 124-156) with:

```tsx
<div className="px-5 pb-3 text-xs text-gray-400 flex justify-between">
  <span>
    {imageAttribution && (
      imageAttribution.source === "ala" ? (
        <>
          {imageAttribution.photographerName && (
            <>Photo by {imageAttribution.photographerName} on{" "}</>
          )}
          <a href={imageAttribution.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
            Atlas of Living Australia
          </a>
          {imageAttribution.license && (
            <> ({imageAttribution.license})</>
          )}
        </>
      ) : (
        <>
          Image from{" "}
          <a href={imageAttribution.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
            Wikipedia
          </a>
        </>
      )
    )}
  </span>
  <a
    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(plant.scientific_name)}`}
    className="underline"
    target="_blank"
    rel="noopener noreferrer"
  >
    Wikipedia
  </a>
</div>
```

**Step 2: Verify types compile**

Run: `npx tsc -b`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PlantCard.tsx
git commit -m "feat: update attribution display for ALA images"
```

---

## Task 8: Replace Unsplash with ALA Image Fetching

**Files:**
- Modify: `src/api.ts`
- Modify: `.env.example`

**Step 1: Remove Unsplash code and add ALA constants**

In `src/api.ts`:
- Remove the `UNSPLASH_URL` constant
- Remove the entire `fetchUnsplashImage` function
- Add ALA constants:

```ts
const ALA_SPECIES_SEARCH_URL = "https://api.ala.org.au/species/search";
const ALA_IMAGE_DETAILS_URL = "https://images.ala.org.au/ws/image/details";
```

**Step 2: Add `fetchAlaImage` function**

Add after the ALA constants:

```ts
async function fetchAlaImage(
  scientificName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  const stripped = stripCultivar(scientificName);
  const candidates = stripped !== scientificName ? [scientificName, stripped] : [scientificName];

  for (const name of candidates) {
    const params = new URLSearchParams({
      q: name,
      fq: "idxtype:TAXON",
      pageSize: "1",
    });

    try {
      const response = await fetch(`${ALA_SPECIES_SEARCH_URL}?${params}`);
      if (!response.ok) continue;

      const data = await response.json();
      const result = data.searchResults?.results?.[0];
      if (!result?.largeImageUrl || !result?.image) continue;

      // Fetch image details for attribution
      let creator: string | undefined;
      let license: string | undefined;
      try {
        const detailsResponse = await fetch(
          `${ALA_IMAGE_DETAILS_URL}?id=${result.image}`
        );
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          creator = details.creator || undefined;
          license = details.recognisedLicence?.acronym || undefined;
        }
      } catch {
        // Attribution is best-effort; continue without it
      }

      return {
        url: result.largeImageUrl,
        attribution: {
          source: "ala",
          photographerName: creator,
          sourceUrl: `https://bie.ala.org.au/species/${encodeURIComponent(result.guid)}`,
          license,
        },
      };
    } catch {
      continue;
    }
  }
  return null;
}
```

**Step 3: Update `fetchPlantImage` cascade**

Replace the current function body:

```ts
export async function fetchPlantImage(
  commonName: string,
  scientificName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  // Try ALA first with scientific name (tries with and without cultivar)
  const ala = await fetchAlaImage(scientificName);
  if (ala) return ala;

  // Fall back to Wikipedia using scientific name (tries with and without cultivar)
  const wikiScientific = await fetchWikipediaImage(scientificName);
  if (wikiScientific) return wikiScientific;

  // Try Wikipedia with common name (tries with and without cultivar)
  const wikiCommon = await fetchWikipediaImage(commonName);
  if (wikiCommon) return wikiCommon;

  return null;
}
```

**Step 4: Remove Unsplash from `.env.example`**

The file should now be empty (or can be deleted). Remove the `VITE_UNSPLASH_ACCESS_KEY` line.

**Step 5: Verify build**

Run: `npx tsc -b && npm run build`
Expected: Clean build

**Step 6: Manual verification**

Run: `npm run dev`
- Search for an Australian plant (e.g., "Grevillea robusta") — should show ALA image with attribution
- Search for a common plant (e.g., "Monstera deliciosa") — should show ALA or Wikipedia image
- Check attribution text shows "Atlas of Living Australia" with license

**Step 7: Commit**

```bash
git add src/api.ts .env.example
git commit -m "feat: replace Unsplash with ALA for plant images"
```

---

## Task 9: Final Build Verification

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no warnings

**Step 2: Lint**

Run: `npm run lint`
Expected: No errors

**Step 3: End-to-end manual smoke test**

Run: `npm run dev`
1. Open app — no key set, gear icon visible in top right
2. Type a plant name, click Go — modal appears asking for key
3. Enter OpenRouter key, Save — search proceeds, plant card with ALA image appears
4. Reload page — key persists, search works without re-entering
5. Click gear icon — see masked key, can delete
6. Test file upload flow with a plant list

**Step 4: Commit any final fixes, if needed**
