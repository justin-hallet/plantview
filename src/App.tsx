import { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { PlantCard } from "./components/PlantCard";
import { PlantList } from "./components/PlantList";
import { lookupPlant, extractPlantsFromText } from "./api";
import { extractTextFromFile } from "./fileParser";
import type { PlantResult } from "./types";

function App() {
  const [result, setResult] = useState<PlantResult | null>(null);
  const [batchResults, setBatchResults] = useState<PlantResult[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "batch">("single");

  async function handleSearch(query: string) {
    setMode("single");
    setBatchResults([]);
    setIsLoading(true);
    setError(null);
    try {
      const plantResult = await lookupPlant(query);
      setResult(plantResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileSelected(file: File) {
    setMode("batch");
    setResult(null);
    setBatchResults([]);
    setIsLoading(true);
    setError(null);

    try {
      const text = await extractTextFromFile(file);
      const entries = await extractPlantsFromText(text);

      if (entries.length === 0) {
        setError("No plants found in the uploaded file.");
        setIsLoading(false);
        return;
      }

      setBatchTotal(entries.length);

      for (const entry of entries) {
        try {
          const query = entry.potSize
            ? `${entry.name} ${entry.potSize}`
            : entry.name;
          const plantResult = await lookupPlant(query);
          setBatchResults((prev) => [...prev, plantResult]);
        } catch {
          // Skip plants that fail to look up
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">PlantView</h1>

      <SearchBar onSearch={handleSearch} onFileSelected={handleFileSelected} isLoading={isLoading} />

      <div className="mt-8">
        {error && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {mode === "single" && isLoading && (
          <div className="text-center text-gray-500">
            <div className="animate-pulse text-lg">Looking up plant...</div>
          </div>
        )}

        {mode === "single" && result && !isLoading && <PlantCard result={result} />}

        {mode === "batch" && (batchResults.length > 0 || isLoading) && (
          <PlantList results={batchResults} total={batchTotal} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

export default App;
