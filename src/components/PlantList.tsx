import type { PlantListItem } from "../types";
import { PlantCardItem } from "./PlantCard";

interface PlantListProps {
  items: PlantListItem[];
  isLoading: boolean;
}

export function PlantList({ items, isLoading }: PlantListProps) {
  const completed = items.filter((item) => item.status !== "pending").length;
  const total = items.length;

  // Group items by section, preserving order
  const sections: { section: string | null; items: { item: PlantListItem; index: number }[] }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const section = item.entry.section ?? null;
    const last = sections[sections.length - 1];
    if (last && last.section === section) {
      last.items.push({ item, index: i });
    } else {
      sections.push({ section, items: [{ item, index: i }] });
    }
  }

  const hasSections = sections.some((s) => s.section != null);

  return (
    <div className="max-w-xl mx-auto">
      {isLoading && (
        <div className="text-center text-gray-500 mb-4">
          <div className="animate-pulse text-sm">
            Looking up plants... {completed} / {total}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      <div className="space-y-4">
        {hasSections
          ? sections.map((section, si) => (
              <div key={si}>
                {section.section && (
                  <h2 className="text-lg font-semibold text-gray-700 mt-8 mb-3 border-b border-gray-200 pb-1">
                    {section.section}
                  </h2>
                )}
                <div className="space-y-4">
                  {section.items.map(({ item, index }) => (
                    <PlantCardItem
                      key={index}
                      item={item}
                    />
                  ))}
                </div>
              </div>
            ))
          : items.map((item, i) => (
              <PlantCardItem key={i} item={item} />
            ))}
      </div>
    </div>
  );
}
