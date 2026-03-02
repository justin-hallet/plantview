import type { PlantData, PlantResult, PlantEntry, ImageAttribution } from "./types";
import { buildPlantPrompt, buildExtractPlantsPrompt } from "./prompt";
import { getCachedResult, setCachedResult, batchGetCached } from "./cache";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const WIKIPEDIA_API_URL = "https://en.wikipedia.org/api/rest_v1/page/summary";
const ALA_SPECIES_SEARCH_URL = "https://api.ala.org.au/species/search";
const ALA_IMAGE_URL = "https://images.ala.org.au/ws/image";

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
          `${ALA_IMAGE_URL}/${result.image}`
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
