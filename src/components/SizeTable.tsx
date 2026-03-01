import type { SizeRange } from "../types";

interface SizeStage {
  label: string;
  size: SizeRange;
}

interface SizeTableProps {
  stages: SizeStage[];
}

function formatRange(min: number, max: number): string {
  if (min === max) return `${min}cm`;
  return `${min}–${max}cm`;
}

export function SizeTable({ stages }: SizeTableProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stages.map((stage) => (
        <div key={stage.label} className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
            {stage.label}
          </div>
          <div className="text-sm text-gray-700">
            <div>H: {formatRange(stage.size.height_min_cm, stage.size.height_max_cm)}</div>
            <div>W: {formatRange(stage.size.width_min_cm, stage.size.width_max_cm)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
