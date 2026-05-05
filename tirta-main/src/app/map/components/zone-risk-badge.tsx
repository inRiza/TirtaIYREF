"use client";

import { AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoneRiskBadgeProps {
  level: string;
}

export function ZoneRiskBadge({ level }: ZoneRiskBadgeProps) {
  const config = (
    {
      SANGAT_RAWAN: {
        label: "Sangat Rawan",
        icon: ShieldAlert,
        className: "bg-red-50 text-red-600",
      },
      RAWAN: {
        label: "Rawan",
        icon: AlertTriangle,
        className: "bg-amber-50 text-amber-600",
      },
      TIDAK_RAWAN: {
        label: "Tidak Rawan",
        icon: Shield,
        className: "bg-green-50 text-green-600",
      },
      UNKNOWN: {
        label: "Tidak Diketahui",
        icon: Shield,
        className: "bg-slate-50 text-slate-500",
      },
    } as Record<
      string,
      { label: string; icon: typeof Shield; className: string }
    >
  )[level] ?? {
    label: level,
    icon: Shield,
    className: "bg-slate-50 text-slate-500",
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        config.className,
      )}
    >
      <Icon size={10} />
      {config.label}
    </span>
  );
}
