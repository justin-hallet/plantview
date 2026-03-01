import type { PlantResult } from "../types";
import { PlantCard } from "./PlantCard";

interface PlantListProps {
  results: PlantResult[];
  total: number;
  isLoading: boolean;
}

export function PlantList({ results, total, isLoading }: PlantListProps) {
  return (
    <div className="max-w-xl mx-auto">
      {isLoading && (
        <div className="text-center text-gray-500 mb-4">
          <div className="animate-pulse text-sm">
            Looking up plants... {results.length} / {total}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (results.length / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      <div className="space-y-4">
        {results.map((result, i) => (
          <PlantCard key={`${result.plant.common_name}-${i}`} result={result} />
        ))}
      </div>
    </div>
  );
}
