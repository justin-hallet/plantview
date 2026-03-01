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
