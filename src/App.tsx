import { useState, useEffect } from "react";
import { SearchBar } from "./components/SearchBar";
import { PlantCard } from "./components/PlantCard";
import { PlantList } from "./components/PlantList";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { lookupPlant, extractPlantsFromText, lookupPlantBatch } from "./api";
import { extractTextFromFile } from "./fileParser";
import { getStoredApiKey, setStoredApiKey, deleteStoredApiKey } from "./cache";
import type { PlantResult, PlantListItem } from "./types";

function App() {
  const [result, setResult] = useState<PlantResult | null>(null);
  const [batchItems, setBatchItems] = useState<PlantListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    getStoredApiKey().then((key) => {
      if (key) setApiKey(key);
    });
  }, []);

  const hasResults =
    (mode === "single" && result && !isLoading) ||
    (mode === "batch" && batchItems.some((item) => item.status === "loaded"));

  function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 5) + "•••" + key.slice(-4);
  }

  async function handleSaveKey(key: string) {
    await setStoredApiKey(key);
    setApiKey(key);
    setShowApiKeyModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  async function handleDeleteKey() {
    await deleteStoredApiKey();
    setApiKey(null);
    setShowApiKeyModal(false);
  }

  async function handleSearch(query: string) {
    if (!apiKey) {
      setPendingAction(() => () => handleSearch(query));
      setShowApiKeyModal(true);
      return;
    }
    setMode("single");
    setBatchItems([]);
    setIsLoading(true);
    setError(null);
    try {
      const plantResult = await lookupPlant(query, apiKey);
      setResult(plantResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileSelected(file: File) {
    if (!apiKey) {
      setPendingAction(() => () => handleFileSelected(file));
      setShowApiKeyModal(true);
      return;
    }
    setMode("batch");
    setResult(null);
    setBatchItems([]);
    setIsLoading(true);
    setError(null);

    try {
      const text = await extractTextFromFile(file);
      const entries = await extractPlantsFromText(text, apiKey);

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
        apiKey,
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
      <div className="flex items-center justify-center mb-6 relative">
        <h1 className="text-3xl font-bold text-center text-green-800">PlantView</h1>
        <button
          type="button"
          onClick={() => setShowApiKeyModal(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors no-print"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.07c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

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

      {showApiKeyModal && (
        <ApiKeyModal
          currentKeyHint={apiKey ? maskKey(apiKey) : null}
          onSave={handleSaveKey}
          onDelete={handleDeleteKey}
          onClose={() => {
            setShowApiKeyModal(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
