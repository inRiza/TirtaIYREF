"use client";

import { cn } from "@/lib/utils";

interface MapLegendProps {
  show: boolean;
}

const LEGEND_ITEMS = [
  { label: "Sangat Rawan", color: "bg-red-400" },
  { label: "Rawan", color: "bg-amber-400" },
  { label: "Tidak Rawan", color: "bg-green-400" },
];

export function MapLegend({ show }: MapLegendProps) {
  return (
    <div
      className={cn(
        "absolute left-4 z-40 bottom-[calc(env(safe-area-inset-bottom)+160px)] w-40",
        "transition-all duration-300 ease-out",
        show
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95 pointer-events-none",
      )}
    >
      <div className="rounded-xl bg-slate-100 shadow-md px-3 py-2.5 space-y-1.5">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className={cn("h-2.5 w-2.5 rounded-sm opacity-80", item.color)}
            />
            <span className="text-xs font-semibold">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
