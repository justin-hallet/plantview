export function buildExtractPlantsPrompt(documentText: string): string {
  return `You are a horticultural data assistant. Extract all unique plant names and their pot/container sizes from this document. Return ONLY valid JSON, no markdown, no explanation.

Return a JSON array matching this schema:
[
  { "name": "Plant Name or cultivar", "potSize": "size string or null" }
]

Rules:
- Extract every plant mentioned in the document
- Deduplicate: if the same plant appears multiple times, include it only once
- For potSize, include whatever size info is given (e.g. "200mm", "100L", "300mm", "45L") or null if not specified
- Keep cultivar names (e.g. "Magnolia 'Little Gem'" not just "Magnolia")
- If the document is a table/CSV, look for name and size columns
- Ignore non-plant content (headers, notes, addresses, quantities, spacing info)

Document content:
${documentText}`;
}

export function buildPlantPrompt(query: string): string {
  return `You are a horticultural data assistant. Given a plant query, return ONLY valid JSON matching the schema below. No markdown, no explanation, just JSON.

The user query is: "${query}"

Parse the query to identify the plant name and optional pot size. If no pot size is given, recommend the most common/appropriate pot size for this plant.

Return JSON matching this exact schema:
{
  "common_name": "string",
  "scientific_name": "string",
  "description": "string (2-3 sentences about the plant)",
  "pot_size_cm": number,
  "pot_size_note": "string (e.g. 'Specified by user' or 'Recommended for this plant')",
  "current_size": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "size_12_months": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "size_24_months": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number
  },
  "mature_size": {
    "height_min_cm": number,
    "height_max_cm": number,
    "width_min_cm": number,
    "width_max_cm": number,
    "context": "string (e.g. 'indoors, typical home conditions')"
  },
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}

Rules:
- All sizes are ranges (min and max), never single values
- All measurements in centimetres
- Size estimates assume typical indoor growing conditions unless the plant is primarily outdoor
- Growth projections assume the plant stays in the specified pot size
- Confidence reflects how well-documented this plant's size data is
- If you don't recognize the plant, return JSON with common_name set to "Unknown" and confidence "LOW"`;
}
