import { useState } from "react";
import { SearchBar } from "./components/SearchBar";
import { PlantCard } from "./components/PlantCard";
import { lookupPlant } from "./api";
import type { PlantResult } from "./types";

function App() {
  const [result, setResult] = useState<PlantResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(query: string) {
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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-green-800 mb-6">PlantView</h1>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

      <div className="mt-8">
        {isLoading && (
          <div className="text-center text-gray-500">
            <div className="animate-pulse text-lg">Looking up plant...</div>
          </div>
        )}

        {error && (
          <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && !isLoading && <PlantCard result={result} />}
      </div>
    </div>
  );
}

export default App;
