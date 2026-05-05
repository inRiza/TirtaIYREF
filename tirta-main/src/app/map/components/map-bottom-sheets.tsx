"use client";

import { ChevronRight, X } from "lucide-react";
import { ZoneRiskBadge } from "./zone-risk-badge";

interface MapBottomSheetProps {
  selectedCluster: {
    address: string | null;
    clusterCount: number;
    floodRiskScore: number;
    riskLevel: string;
    categoryLevel: "TINGGI" | "SEDANG" | "RENDAH" | null;
  };
  clusterReports: Array<{
    id: string;
    title: string | null;
    address: string | null;
    reportedAt: string;
    floodRiskScore: number;
    categoryLevel: "TINGGI" | "SEDANG" | "RENDAH" | null;
    user: { name: string | null };
  }>;
  sheetLoading: boolean;
  onClose: () => void;
  onSelectReport: (id: string) => void;
  formatRelative: (date: string) => string;
  getScoreColor: (score: number, category: string | null) => string;
}

export function MapBottomSheet({
  selectedCluster,
  clusterReports,
  sheetLoading,
  onClose,
  onSelectReport,
  formatRelative,
  getScoreColor,
}: MapBottomSheetProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white shadow-2xl">
      <div className="flex justify-center pt-3 pb-1">
        <div className="h-1 w-10 rounded-full bg-slate-200" />
      </div>

      <div className="flex items-start justify-between px-5 pt-2 pb-3 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400 font-medium">
            {selectedCluster.clusterCount > 1
              ? `${selectedCluster.clusterCount} laporan dalam radius 100m`
              : "Detail laporan"}
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5 max-w-60 truncate">
            {selectedCluster.address ?? "Lokasi tidak diketahui"}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <ZoneRiskBadge level={selectedCluster.riskLevel} />
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{
                background: getScoreColor(
                  selectedCluster.floodRiskScore,
                  selectedCluster.categoryLevel,
                ),
              }}
            >
              {Math.round(selectedCluster.floodRiskScore)} FRI
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 bg-slate-100 text-slate-500"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto px-5 py-3 space-y-2.5">
        {sheetLoading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Memuat...
          </div>
        ) : clusterReports.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Tidak ada laporan
          </div>
        ) : (
          clusterReports.map((report) => (
            <button
              type="button"
              key={report.id}
              onClick={() => onSelectReport(report.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left active:bg-slate-100"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                style={{
                  background: getScoreColor(
                    report.floodRiskScore,
                    report.categoryLevel,
                  ),
                }}
              >
                {Math.round(report.floodRiskScore)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {report.title ?? report.address ?? "Laporan tanpa judul"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {report.user.name ?? "Anonim"} ·{" "}
                  {formatRelative(report.reportedAt)}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))
        )}
      </div>
      <div className="h-6" />
    </div>
  );
}
