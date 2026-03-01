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

export interface ImageAttribution {
  source: "unsplash" | "wikipedia";
  photographerName?: string;
  photographerUrl?: string;
  sourceUrl: string;
}

export interface PlantResult {
  plant: PlantData;
  imageUrl: string | null;
  imageAttribution: ImageAttribution | null;
}

export interface PlantEntry {
  name: string;
  potSize?: string;
  qty?: number;
  notes?: string;
  section?: string;
}

export type PlantListItem =
  | { status: "pending"; entry: PlantEntry }
  | { status: "loaded"; entry: PlantEntry; result: PlantResult }
  | { status: "error"; entry: PlantEntry; error: string };
