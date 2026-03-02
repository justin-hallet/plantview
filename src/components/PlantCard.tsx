import type { PlantListItem, PlantResult, PlantEntry } from "../types";
import { SizeTable } from "./SizeTable";

interface PlantCardLoadedProps {
  result: PlantResult;
  entry?: PlantEntry;
}

interface PlantCardItemProps {
  item: PlantListItem;
}

function LandscaperInfo({ entry }: { entry: PlantEntry }) {
  const hasPotSize = !!entry.potSize;
  const hasQty = entry.qty != null;
  const hasNotes = !!entry.notes;

  if (!hasPotSize && !hasQty && !hasNotes) return null;

  return (
    <div className="mx-5 mt-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
        Landscaper Spec
      </h3>
      <div className="text-sm text-amber-900 space-y-0.5">
        {hasQty && <p>Qty: {entry.qty}</p>}
        {hasPotSize && <p>Size: {entry.potSize}</p>}
        {hasNotes && <p>Notes: {entry.notes}</p>}
      </div>
    </div>
  );
}

function PlantCardSkeleton({ entry }: { entry: PlantEntry }) {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <div className="sm:flex">
        <div className="sm:w-48 sm:flex-shrink-0 bg-gray-200 animate-pulse h-48" />
        <div className="p-5 flex-1">
          <h2 className="text-xl font-bold text-gray-900">{entry.name}</h2>
          <div className="mt-1 h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="mt-3 h-3 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <LandscaperInfo entry={entry} />
      <div className="px-5 pb-5">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-green-50 rounded-lg p-3">
              <div className="h-3 w-12 mx-auto bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-16 mx-auto bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-16 mx-auto bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlantCardError({ entry, error }: { entry: PlantEntry; error: string }) {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden border border-red-200">
      <div className="p-5">
        <h2 className="text-xl font-bold text-gray-900">{entry.name}</h2>
        <p className="mt-2 text-sm text-red-600">Failed to look up: {error}</p>
      </div>
      <LandscaperInfo entry={entry} />
    </div>
  );
}

function PlantCardLoaded({ result, entry }: PlantCardLoadedProps) {
  const { plant, imageUrl, imageAttribution } = result;

  const stages = [
    { label: "Now", size: plant.current_size },
    { label: "12 Months", size: plant.size_12_months },
    { label: "24 Months", size: plant.size_24_months },
    { label: "Fully Grown", size: plant.mature_size },
  ];

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-md overflow-hidden print-avoid-break">
      <div className="sm:flex">
        {imageUrl && (
          <div className="sm:w-48 sm:flex-shrink-0">
            <img
              src={imageUrl}
              alt={plant.common_name}
              className="w-full h-48 sm:h-full object-cover"
              loading="lazy"
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

      {entry && <LandscaperInfo entry={entry} />}

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

      <div className="px-5 pb-3 text-xs text-gray-400 flex justify-between">
        <span>
          {imageAttribution && (
            <>
              {imageAttribution.photographerName && (
                <>{imageAttribution.photographerName} · </>
              )}
              <a href={imageAttribution.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
                {imageAttribution.source === "inaturalist" ? "iNaturalist" : "Wikimedia Commons"}
              </a>
              {imageAttribution.license && (
                <> ({imageAttribution.license})</>
              )}
            </>
          )}
        </span>
        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(plant.scientific_name)}`}
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Wikipedia
        </a>
      </div>
    </div>
  );
}

export function PlantCard({ result }: { result: PlantResult }) {
  return <PlantCardLoaded result={result} />;
}

export function PlantCardItem({ item }: PlantCardItemProps) {
  switch (item.status) {
    case "pending":
      return <PlantCardSkeleton entry={item.entry} />;
    case "loaded":
      return <PlantCardLoaded result={item.result} entry={item.entry} />;
    case "error":
      return <PlantCardError entry={item.entry} error={item.error} />;
  }
}
