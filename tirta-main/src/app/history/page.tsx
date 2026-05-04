"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { ReportCardRow } from "@/components/card/report-card-row";
import {
  type FilterState,
  SearchFilter,
} from "@/components/search/search-filter";
import { ReportCardRowSkeleton } from "@/components/skeleton/report-card-skeleton";
import { useAuth } from "@/lib/auth-context";

interface HistoryReport {
  id: string;
  address: string | null;
  reportedAt: string;
  description: string | null;
  imageUrl: string | null;
  friScore: number | null;
  riskCategory: "TINGGI" | "SEDANG" | "RENDAH" | null;
  distanceLabel: string | null;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>({ risk: [], sort: null });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  const fetchHistory = useCallback(async (f: FilterState, uid: string) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("firebaseUID", uid);
      if (f.sort) params.set("sort", f.sort);
      if (f.risk.length) params.set("riskCategory", f.risk.join(","));

      const res = await fetch(`/api/history/reports?${params.toString()}`);
      const data = await res.json();
      setReports(data.listed ?? []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory(filter, user.uid);
    }
  }, [filter, user, fetchHistory]);

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.address ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });
  const activeFilterCount = filter.risk.length + (filter.sort ? 1 : 0);
  const isSearchingOrFiltering =
    search.trim().length > 0 || activeFilterCount > 0;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-500">Memuat profil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="bg-white px-5 pt-6 pb-2">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Riwayat Laporan
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Laporan yang telah Anda kirimkan
              </p>
            </div>
          </div>
        </header>

        <div className="bg-white">
          <SearchFilter
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
        <main className="flex flex-1 flex-col px-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {isSearchingOrFiltering ? "Hasil pencarian" : "Semua Laporan"}
            </p>
          </div>

          {dataLoading ? (
            <div className="space-y-3 pt-4">
              {[...Array(4).keys()].map((i) => (
                <ReportCardRowSkeleton key={`${i}`} />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center pb-32">
              <p className="text-sm text-slate-400 mt-1 max-w-[200px]">
                {search
                  ? `Tidak ada hasil pencarian untuk "${search}"`
                  : "Tidak ada laporan"}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-4 pb-24">
              {filteredReports.map((r) => (
                <ReportCardRow
                  key={r.id}
                  id={r.id}
                  imageUrl={r.imageUrl}
                  address={r.address}
                  reportedAt={r.reportedAt}
                  description={r.description}
                  friScore={r.friScore}
                  riskCategory={r.riskCategory}
                  showFri
                  showRiskLabel
                />
              ))}
            </div>
          )}
        </main>

        <AppBottomNav />
      </div>
    </div>
  );
}
