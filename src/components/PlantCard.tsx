import type { PlantResult } from "../types";
import { SizeTable } from "./SizeTable";

interface PlantCardProps {
  result: PlantResult;
}

export function PlantCard({ result }: PlantCardProps) {
  const { plant, imageUrl, imageAttribution } = result;

  const stages = [
    { label: "Now", size: plant.current_size },
    { label: "12 Months", size: plant.size_12_months },
    { label: "24 Months", size: plant.size_24_months },
    { label: "Fully Grown", size: plant.mature_size },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <div className="sm:flex">
        {imageUrl && (
          <div className="sm:w-48 sm:flex-shrink-0">
            <img
              src={imageUrl}
              alt={plant.common_name}
              className="w-full h-48 sm:h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 flex-1">
          <h2 className="text-xl font-bold text-gray-900">{plant.common_name}</h2>
          <p className="text-sm text-gray-500 italic">{plant.scientific_name}</p>
          <p className="mt-2 text-sm text-gray-700">{plant.description}</p>
          <p className="mt-2 text-xs text-green-700 font-medium">
            Pot: {plant.pot_size_cm}cm — {plant.pot_size_note}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Growth Projections</h3>
        <SizeTable stages={stages} />
        {plant.mature_size.context && (
          <p className="text-xs text-gray-400 mt-2 text-center">{plant.mature_size.context}</p>
        )}
        <p className="text-xs text-gray-400 mt-1 text-center">
          Confidence: {plant.confidence}
        </p>
      </div>

      {imageAttribution && (
        <div className="px-5 pb-3 text-xs text-gray-400">
          Photo by{" "}
          <a href={imageAttribution.photographerUrl} className="underline" target="_blank" rel="noopener noreferrer">
            {imageAttribution.photographerName}
          </a>{" "}
          on{" "}
          <a href={imageAttribution.unsplashUrl} className="underline" target="_blank" rel="noopener noreferrer">
            Unsplash
          </a>
        </div>
      )}
    </div>
  );
}
