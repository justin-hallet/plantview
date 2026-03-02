import type { PlantData, PlantResult, PlantEntry, ImageAttribution } from "./types";
import { buildPlantPrompt, buildExtractPlantsPrompt } from "./prompt";
import { getCachedResult, setCachedResult, batchGetCached } from "./cache";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UNSPLASH_URL = "https://api.unsplash.com/search/photos";
const WIKIPEDIA_API_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";

export async function fetchPlantData(query: string, apiKey: string): Promise<PlantData> {
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

async function fetchUnsplashImage(
  plantName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const params = new URLSearchParams({
    query: `${plantName} full plant tree potted`,
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
    attribution: {
      source: "unsplash",
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      sourceUrl: photo.links.html,
    },
  };
}

function stripCultivar(name: string): string {
  // Remove cultivar names in single quotes, e.g. "Magnolia grandiflora 'Little Gem'" -> "Magnolia grandiflora"
  return name.replace(/\s*'[^']*'$/g, "").replace(/\s*"[^"]*"$/g, "").trim();
}

async function fetchWikipediaImage(
  plantName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  // Try exact name first, then without cultivar
  const stripped = stripCultivar(plantName);
  const candidates = stripped !== plantName ? [plantName, stripped] : [plantName];
  for (const name of candidates) {
    const encoded = encodeURIComponent(name);
    try {
      const response = await fetch(`${WIKIPEDIA_API_URL}/${encoded}`);
      if (!response.ok) continue;

      const data = await response.json();
      const imageUrl = data.originalimage?.source ?? data.thumbnail?.source;
      if (!imageUrl) continue;

      return {
        url: imageUrl,
        attribution: {
          source: "wikipedia",
          sourceUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`,
        },
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchPlantImage(
  commonName: string,
  scientificName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  // Try Unsplash first (with cultivar name for specificity)
  const unsplash = await fetchUnsplashImage(commonName);
  if (unsplash) return unsplash;

  // Fall back to Wikipedia using scientific name (tries with and without cultivar)
  const wikiScientific = await fetchWikipediaImage(scientificName);
  if (wikiScientific) return wikiScientific;

  // Try Wikipedia with common name (tries with and without cultivar)
  const wikiCommon = await fetchWikipediaImage(commonName);
  if (wikiCommon) return wikiCommon;

  return null;
}

export async function extractPlantsFromText(documentText: string, apiKey: string): Promise<PlantEntry[]> {
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
      messages: [{ role: "user", content: buildExtractPlantsPrompt(documentText) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in LLM response");

  const jsonStr = content.replace(/^```json?\n?/gm, "").replace(/\n?```$/gm, "").trim();
  return JSON.parse(jsonStr) as PlantEntry[];
}

export async function lookupPlant(query: string, apiKey: string): Promise<PlantResult> {
  const cached = await getCachedResult(query);
  if (cached) return cached;

  const plant = await fetchPlantData(query, apiKey);
  const image = await fetchPlantImage(plant.common_name, plant.scientific_name);

  const result: PlantResult = {
    plant,
    imageUrl: image?.url ?? null,
    imageAttribution: image?.attribution ?? null,
  };

  await setCachedResult(query, result);
  return result;
}

export async function lookupPlantBatch(
  entries: PlantEntry[],
  apiKey: string,
  onResult: (index: number, result: PlantResult) => void,
  onError: (index: number, error: string) => void
): Promise<void> {
  const queries = entries.map((entry) =>
    entry.potSize ? `${entry.name} ${entry.potSize}` : entry.name
  );

  // Pre-check cache for all entries
  const cached = await batchGetCached(queries);

  // Fire cached results immediately
  const uncached: { index: number; query: string }[] = [];
  for (let i = 0; i < queries.length; i++) {
    const result = cached.get(queries[i]);
    if (result) {
      onResult(i, result);
    } else {
      uncached.push({ index: i, query: queries[i] });
    }
  }

  // Process uncached entries with concurrency limit of 3
  const CONCURRENCY = 3;
  let next = 0;

  async function worker(): Promise<void> {
    while (next < uncached.length) {
      const current = next++;
      const { index, query } = uncached[current];
      try {
        const result = await lookupPlant(query, apiKey);
        onResult(index, result);
      } catch (err) {
        onError(index, err instanceof Error ? err.message : "Lookup failed");
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, uncached.length) },
    () => worker()
  );
  await Promise.all(workers);
}
