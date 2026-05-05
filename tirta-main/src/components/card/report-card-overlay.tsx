import { MapPin } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type RiskCategory = "TINGGI" | "SEDANG" | "RENDAH";

export interface ReportCardOverlayProps {
  id: string;
  imageUrl?: string | null;
  address?: string | null;
  distanceLabel?: string | null;
  showFri?: boolean;
  friScore?: number | null;
  riskCategory?: RiskCategory | null;
  showRiskLabel?: boolean;
  className?: string;
}

const RISK_BG_COLOR: Record<RiskCategory, string> = {
  TINGGI: "bg-red-200",
  SEDANG: "bg-amber-200",
  RENDAH: "bg-blue-200",
};

const RISK_TEXT_COLOR: Record<RiskCategory, string> = {
  TINGGI: "text-red-500",
  SEDANG: "text-amber-500",
  RENDAH: "text-brand",
};

const RISK_LABEL: Record<RiskCategory, string> = {
  TINGGI: "Risiko tinggi",
  SEDANG: "Risiko sedang",
  RENDAH: "Risiko rendah",
};

export function ReportCardOverlay({
  id,
  imageUrl,
  address,
  distanceLabel,
  showFri = true,
  friScore,
  riskCategory,
  showRiskLabel = true,
  className,
}: ReportCardOverlayProps) {
  const router = useRouter();

  const hasBadge = showRiskLabel && riskCategory;
  const badgeBgColor = riskCategory
    ? RISK_BG_COLOR[riskCategory]
    : "bg-slate-500";
  const badgeTextColor = riskCategory
    ? RISK_TEXT_COLOR[riskCategory]
    : "text-white";
  const badgeText = riskCategory ? RISK_LABEL[riskCategory] : null;
  const scoreText = friScore != null ? `${Math.round(friScore)} FRI` : null;

  return (
    <button
      type="button"
      onClick={() => router.push(`/report/${id}`)}
      className={cn(
        "group relative flex-shrink-0 w-60 h-52 rounded-3xl overflow-hidden bg-slate-200 text-left active:scale-[0.97] transition-transform duration-150",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={address ?? "Laporan"}
          fill
          sizes="200px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-300" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      {hasBadge && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-1 rounded-sm px-2.5 py-1 text-[11px] font-bold leading-none",
              badgeBgColor,
              badgeTextColor,
            )}
          >
            {badgeText}
          </span>
        </div>
      )}
      {showFri && scoreText && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-sm px-2.5 py-1 text-[11px] font-bold leading-none",
              riskCategory
                ? `${badgeBgColor} ${badgeTextColor}`
                : "bg-black/50 text-white backdrop-blur-sm",
            )}
          >
            {scoreText}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
          {address ?? "Lokasi tidak diketahui"}
        </p>
        {distanceLabel && (
          <div className="mt-1 flex items-center gap-1">
            <MapPin size={10} className="text-white/70 shrink-0" />
            <span className="text-[11px] text-white/70">{distanceLabel}</span>
          </div>
        )}
      </div>
    </button>
  );
}
