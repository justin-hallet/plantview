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

export async function batchGetCached(
  queries: string[]
): Promise<Map<string, PlantResult>> {
  const results = await Promise.all(
    queries.map(async (query) => {
      const result = await getCachedResult(query);
      return [query, result] as const;
    })
  );
  const map = new Map<string, PlantResult>();
  for (const [query, result] of results) {
    if (result) map.set(query, result);
  }
  return map;
}
