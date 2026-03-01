import { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { PlantCard } from "./components/PlantCard";
import { PlantList } from "./components/PlantList";
import { lookupPlant, extractPlantsFromText, lookupPlantBatch } from "./api";
import { extractTextFromFile } from "./fileParser";
import type { PlantResult, PlantListItem } from "./types";

function App() {
  const [result, setResult] = useState<PlantResult | null>(null);
  const [batchItems, setBatchItems] = useState<PlantListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "batch">("single");

  const hasResults =
    (mode === "single" && result && !isLoading) ||
    (mode === "batch" && batchItems.some((item) => item.status === "loaded"));

  async function handleSearch(query: string) {
    setMode("single");
    setBatchItems([]);
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
    setBatchItems([]);
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

      // Show placeholders immediately
      setBatchItems(entries.map((entry) => ({ status: "pending", entry })));

      // Look up all plants concurrently with progressive updates
      await lookupPlantBatch(
        entries,
        (index, plantResult) => {
          setBatchItems((prev) => {
            const next = [...prev];
            next[index] = { status: "loaded", entry: entries[index], result: plantResult };
            return next;
          });
        },
        (index, errorMsg) => {
          setBatchItems((prev) => {
            const next = [...prev];
            next[index] = { status: "error", entry: entries[index], error: errorMsg };
            return next;
          });
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">PlantView</h1>

      <SearchBar
        onSearch={handleSearch}
        onFileSelected={handleFileSelected}
        onExport={() => window.print()}
        isLoading={isLoading}
        showExport={!!hasResults}
      />

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

        {mode === "batch" && batchItems.length > 0 && (
          <PlantList items={batchItems} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

export default App;
