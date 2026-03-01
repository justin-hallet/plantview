import type { PlantData, PlantResult, ImageAttribution } from "./types";
import { buildPlantPrompt } from "./prompt";
import { getCachedResult, setCachedResult } from "./cache";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UNSPLASH_URL = "https://api.unsplash.com/search/photos";
const WIKIPEDIA_API_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";

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

async function fetchUnsplashImage(
  plantName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const params = new URLSearchParams({
    query: `${plantName} mature plant`,
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

async function fetchWikipediaImage(
  plantName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  // Try scientific name first, then common name
  for (const name of [plantName]) {
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
  // Try Unsplash first
  const unsplash = await fetchUnsplashImage(commonName);
  if (unsplash) return unsplash;

  // Fall back to Wikipedia using scientific name (better match)
  const wikiScientific = await fetchWikipediaImage(scientificName);
  if (wikiScientific) return wikiScientific;

  // Try Wikipedia with common name
  const wikiCommon = await fetchWikipediaImage(commonName);
  if (wikiCommon) return wikiCommon;

  return null;
}

export async function lookupPlant(query: string): Promise<PlantResult> {
  const cached = await getCachedResult(query);
  if (cached) return cached;

  const plant = await fetchPlantData(query);
  const image = await fetchPlantImage(plant.common_name, plant.scientific_name);

  const result: PlantResult = {
    plant,
    imageUrl: image?.url ?? null,
    imageAttribution: image?.attribution ?? null,
  };

  await setCachedResult(query, result);
  return result;
}
