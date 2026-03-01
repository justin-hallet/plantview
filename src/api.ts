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
