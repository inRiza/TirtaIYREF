import { MapPin } from "lucide-react";

interface LocationIndicatorProps {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
}

export function LocationIndicator({
  latitude,
  longitude,
  address,
}: LocationIndicatorProps) {
  return (
    <div className="flex gap-3">
      <MapPin size={24} className="mt-1 text-brand" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {address || "Mencari lokasi..."}
        </p>
        <div className="flex gap-1 mt-1 text-[10px]">
          <code className="font-medium text-slate-500 bg-white px-1 rounded border border-slate-100">
            {latitude?.toFixed(6) ?? "0.000000"}
          </code>
          <code className="font-mono font-medium text-slate-500 bg-white px-1 rounded border border-slate-100">
            {longitude?.toFixed(6) ?? "0.000000"}
          </code>
        </div>
      </div>
    </div>
  );
}
