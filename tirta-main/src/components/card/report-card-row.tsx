import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RiskCategory } from "./report-card-overlay";

export interface ReportCardRowProps {
  id: string;
  imageUrl?: string | null;
  address?: string | null;
  reportedAt?: string | null;
  description?: string | null;
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

export function ReportCardRow({
  id,
  imageUrl,
  address,
  reportedAt,
  description,
  showFri = true,
  friScore,
  riskCategory,
  showRiskLabel = true,
  className,
}: ReportCardRowProps) {
  const router = useRouter();

  const hasBadge = showRiskLabel && riskCategory;
  const badgeBgColor = riskCategory
    ? RISK_BG_COLOR[riskCategory]
    : "bg-slate-400";
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
        "relative flex w-full items-center gap-3.5 rounded-2xl bg-white px-3.5 py-3 text-left border active:scale-[0.98] transition-transform duration-150",
        className,
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-200">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={address ?? "Laporan"}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-200" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {hasBadge && (
          <div className="mb-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold leading-none",
                `${badgeBgColor} ${badgeTextColor}`,
              )}
            >
              {badgeText}
            </span>
          </div>
        )}

        <p className="text-sm font-semibold text-slate-900 truncate">
          {address ?? "Lokasi tidak diketahui"}
        </p>

        {reportedAt && (
          <p className="mt-0.5 text-xs text-slate-400">
            {formatRelative(reportedAt)}
          </p>
        )}

        {description && (
          <p className="mt-1 text-xs text-slate-500 line-clamp-1">
            {description}
          </p>
        )}
      </div>
      {showFri && scoreText && (
        <div className="absolute top-3 right-3">
          <span
            className={cn(
              "rounded-sm px-2 py-1 text-[10px] font-bold leading-none",
              riskCategory
                ? `${badgeBgColor} ${badgeTextColor}`
                : "bg-slate-100 text-slate-500",
            )}
          >
            {scoreText}
          </span>
        </div>
      )}
    </button>
  );
}
