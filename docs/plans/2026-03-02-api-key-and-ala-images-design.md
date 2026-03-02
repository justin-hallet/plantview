# Browser-Stored API Key & ALA Image Source

Date: 2026-03-02

## Overview

Two changes to PlantView:

1. Move the OpenRouter API key from a build-time env var to browser storage, with a UI for users to enter and manage their key.
2. Replace Unsplash image source with Atlas of Living Australia (ALA), keeping Wikipedia as fallback.

## Change 1: Browser-Stored API Key

### Storage

Use `idb-keyval` (already a dependency) with key `"openrouter-api-key"`. Add three helpers to `src/cache.ts`:

- `getStoredApiKey(): Promise<string | undefined>`
- `setStoredApiKey(key: string): Promise<void>`
- `deleteStoredApiKey(): Promise<void>`

### API Layer

`fetchPlantData` and `extractPlantsFromText` in `src/api.ts` currently read `import.meta.env.VITE_OPENROUTER_API_KEY`. Change both to accept `apiKey: string` as a parameter. Thread through `lookupPlant` and `lookupPlantBatch`.

### App State

In `src/App.tsx`:

- `useEffect` on mount calls `getStoredApiKey()`, stores in `useState<string | null>`
- `handleSearch` / `handleFileSelected`: if key is null, show modal instead of proceeding
- After key is saved, retry the pending action

### UI

**Settings button**: Gear icon in the header row, top right. Opens the API key modal.

**ApiKeyModal** (`src/components/ApiKeyModal.tsx`):

- No key stored: input field + Save button
- Key exists: masked display (e.g. `sk-or-...7f2a`) + Delete button + Replace option
- Never shows full key
- Returns key to parent via callback on save

### Files

| File | Change |
|------|--------|
| `src/cache.ts` | Add key storage helpers |
| `src/api.ts` | Remove env var reads, add `apiKey` param to exported functions |
| `src/App.tsx` | Key state, modal trigger, settings button, thread key to API |
| `src/components/ApiKeyModal.tsx` | New modal component |
| `.env.example` | Remove `VITE_OPENROUTER_API_KEY` |

## Change 2: ALA Image Source

### ALA API

Species search endpoint (no auth, CORS enabled):

```
GET https://api.ala.org.au/species/search?q={scientificName}&fq=idxtype:TAXON&pageSize=1
```

Response includes `largeImageUrl`, `thumbnailUrl`, and an `image` UUID. For attribution details, follow up with:

```
GET https://images.ala.org.au/ws/image/details?id={imageUuid}
```

Returns `creator`, `license`, `recognisedLicence`.

### New Image Fetcher

Replace `fetchUnsplashImage` with `fetchAlaImage(scientificName)`:

- Try exact scientific name, then with cultivar stripped (reuse `stripCultivar`)
- Extract `largeImageUrl` from first result
- Fetch image details for creator/license attribution

### Image Cascade

1. ALA (scientific name, with cultivar stripping)
2. Wikipedia (scientific name, with cultivar stripping)
3. Wikipedia (common name, with cultivar stripping)

### Type Changes

`ImageAttribution` in `src/types.ts`:

```ts
export interface ImageAttribution {
  source: "ala" | "wikipedia";
  photographerName?: string;  // ALA: creator
  photographerUrl?: string;
  sourceUrl: string;
  license?: string;           // ALA: e.g. "CC BY 4.0"
}
```

### Attribution Display

In `PlantCard.tsx`, replace Unsplash branch:

- ALA: "Photo by {creator} on Atlas of Living Australia ({license})"
- Wikipedia: unchanged

### Files

| File | Change |
|------|--------|
| `src/api.ts` | Remove Unsplash, add `fetchAlaImage`, update cascade |
| `src/types.ts` | Update `ImageAttribution` source union, add `license` field |
| `src/components/PlantCard.tsx` | Replace Unsplash attribution with ALA |
| `.env.example` | Remove `VITE_UNSPLASH_ACCESS_KEY` |

### Cache Compatibility

Existing cached results with `source: "unsplash"` will still render (attribution just won't match either display branch). No migration needed.
