import type { PlantData, PlantResult, PlantEntry, ImageAttribution } from "./types";
import { buildPlantPrompt, buildExtractPlantsPrompt } from "./prompt";
import { getCachedResult, setCachedResult, batchGetCached } from "./cache";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";

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

async function fetchINaturalistImage(
  scientificName: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  const stripped = stripCultivar(scientificName);
  const candidates = stripped !== scientificName ? [scientificName, stripped] : [scientificName];

  for (const name of candidates) {
    try {
      const params = new URLSearchParams({
        q: name,
        rank: "species",
        per_page: "1",
      });
      const response = await fetch(`${INATURALIST_TAXA_URL}?${params}`, {
        headers: { "X-Via": "PlantView" },
      });
      if (!response.ok) continue;

      const data = await response.json();
      const taxon = data.results?.[0];
      const photo = taxon?.default_photo;
      if (!photo?.medium_url) continue;

      // Use large size (1024px) instead of medium (500px)
      const imageUrl = photo.medium_url.replace("/medium.", "/large.");

      return {
        url: imageUrl,
        attribution: {
          source: "inaturalist",
          photographerName: photo.attribution || undefined,
          sourceUrl: `https://www.inaturalist.org/taxa/${taxon.id}`,
          license: photo.license_code || undefined,
        },
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchWikimediaImage(
  searchTerm: string
): Promise<{ url: string; attribution: ImageAttribution } | null> {
  const stripped = stripCultivar(searchTerm);
  const candidates = stripped !== searchTerm ? [searchTerm, stripped] : [searchTerm];

  for (const name of candidates) {
    try {
      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: `${name} plant`,
        gsrnamespace: "6",
        gsrlimit: "1",
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: "800",
        format: "json",
        origin: "*",
      });
      const response = await fetch(`${WIKIMEDIA_API_URL}?${params}`);
      if (!response.ok) continue;

      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) continue;

      const page = Object.values(pages)[0] as { imageinfo?: Array<{ thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }> };
      const info = page.imageinfo?.[0];
      if (!info?.thumburl) continue;

      const meta = info.extmetadata ?? {};
      // Strip HTML tags from artist name
      const rawArtist = meta.Artist?.value ?? "";
      const artist = rawArtist.replace(/<[^>]*>/g, "").trim() || undefined;
      const license = meta.LicenseShortName?.value || undefined;

      return {
        url: info.thumburl,
        attribution: {
          source: "wikimedia",
          photographerName: artist,
          sourceUrl: info.url ?? "",
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
  // Try iNaturalist first with scientific name
  const inat = await fetchINaturalistImage(scientificName);
  if (inat) return inat;

  // Fall back to Wikimedia Commons with scientific name
  const wikiScientific = await fetchWikimediaImage(scientificName);
  if (wikiScientific) return wikiScientific;

  // Try Wikimedia Commons with common name
  const wikiCommon = await fetchWikimediaImage(commonName);
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
