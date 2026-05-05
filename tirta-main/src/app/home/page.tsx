"use client";

import { Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppBottomNav } from "@/components/app-bottom-nav";
import {
  ReportCardOverlay,
  type RiskCategory,
} from "@/components/card/report-card-overlay";
import { ReportCardRow } from "@/components/card/report-card-row";
import {
  type FilterState,
  SearchFilter,
} from "@/components/search/search-filter";
import {
  ReportCardOverlaySkeleton,
  ReportCardRowSkeleton,
} from "@/components/skeleton/report-card-skeleton";
import { useAuth } from "@/lib/auth-context";

interface HomeReport {
  id: string;
  address: string | null;
  reportedAt: string;
  description: string | null;
  imageUrl: string | null;
  friScore: number | null;
  riskCategory: RiskCategory | null;
  distanceLabel: string | null;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [nearby, setNearby] = useState<HomeReport[]>([]);
  const [listed, setListed] = useState<HomeReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationLabel, setLocationLabel] = useState("...");
  const [isExpanded, setIsExpanded] = useState(false);

  const [filter, setFilter] = useState<FilterState>({ risk: [], sort: null });
  // draft filter — hanya apply saat tekan Terapkan
  const [draft, setDraft] = useState<FilterState>({ risk: [], sort: null });

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?types=neighborhood,locality&language=id&access_token=${token}`,
    )
      .then((r) => r.json())
      .then((d) => {
        const label = d.features?.[0]?.place_name;
        if (label) setLocationLabel(label.split(",")[0].trim());
      })
      .catch(() => {});
  }, [coords]);

  const fetchReports = useCallback(async (f: FilterState, c: typeof coords) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (c) {
        params.set("lat", String(c.lat));
        params.set("lng", String(c.lng));
      }
      if (f.sort) params.set("sort", f.sort);
      if (f.risk.length) params.set("riskCategory", f.risk.join(","));

      const res = await fetch(`/api/home/reports?${params.toString()}`);
      const data = await res.json();
      setNearby(data.nearby ?? []);
      setListed(data.listed ?? []);
    } catch {
    } finally {
      setDataLoading(false);
      setIsExpanded(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(filter, coords);
  }, [filter, coords, fetchReports]);

  // close filter on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // filter listed by search (client-side)
  const filteredListed = listed.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.address ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });

  const activeFilterCount = filter.risk.length + (filter.sort ? 1 : 0);
  const isSearchingOrFiltering =
    search.trim().length > 0 || activeFilterCount > 0 || isExpanded;
  const displayListed = isSearchingOrFiltering
    ? filteredListed
    : filteredListed.slice(0, 6);

  if (loading || !user) return null;

  const firstName = user.displayName?.split(" ")[0] ?? "Pengguna";

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="bg-slate-100 px-5 pt-5 pb-2 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-slate-400">
                <MapPin size={18} className="" />
                <p className="text-base">{locationLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-blue-600">
                  {firstName[0]?.toUpperCase()}
                </span>
              )}
            </button>
          </div>

          <div className="mt-2 mb-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Halo, {firstName}!
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Ingin pantau kondisi di mana?
            </p>
          </div>
        </header>

        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
        />
        <main className="flex-1 pb-24 space-y-6">
          {!isSearchingOrFiltering && (
            <section>
              <div className="flex items-center justify-between px-5 mb-5 mt-5">
                <p className="text-sm font-semibold">Terdekat</p>
                <button
                  type="button"
                  onClick={() => setFilter((f) => ({ ...f, sort: "nearest" }))}
                  className="text-xs font-semibold text-slate-400 underline"
                >
                  Lebih banyak
                </button>
              </div>

              {dataLoading ? (
                <div className="flex gap-3 px-5 overflow-x-auto pb-2 scrollbar-hide">
                  {[...Array(4).keys()].map((i) => (
                    <ReportCardOverlaySkeleton key={`overlay-skel-${i}`} />
                  ))}
                </div>
              ) : nearby.length === 0 ? (
                <div className="mx-5 rounded-3xl bg-white px-6 py-8 text-center">
                  <p className="text-sm text-slate-400">
                    Tidak ada laporan di sekitar Anda
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 px-5 overflow-x-auto pb-2 scrollbar-hide">
                  {nearby.map((r) => (
                    <ReportCardOverlay
                      key={r.id}
                      id={r.id}
                      imageUrl={r.imageUrl}
                      address={r.address}
                      distanceLabel={r.distanceLabel}
                      friScore={r.friScore}
                      riskCategory={r.riskCategory}
                      showFri
                      showRiskLabel
                    />
                  ))}
                </div>
              )}
            </section>
          )}
          <section>
            <div className="flex items-center justify-between px-5 mb-3">
              <p className="text-sm font-semibold">
                {isSearchingOrFiltering ? "Hasil pencarian" : "Terbaru"}
              </p>
              {!isSearchingOrFiltering && (
                <button
                  type="button"
                  onClick={() => setFilter((f) => ({ ...f, sort: "latest" }))}
                  className="text-xs font-semibold text-slate-400 underline"
                >
                  Lebih banyak
                </button>
              )}
            </div>

            {dataLoading ? (
              <div className="px-5 space-y-3">
                {[...Array(4).keys()].map((i) => (
                  <ReportCardRowSkeleton key={`row-skel-${i}`} />
                ))}
              </div>
            ) : displayListed.length === 0 ? (
              <div className="mx-5 rounded-3xl bg-white px-6 py-8 text-center">
                <p className="text-sm text-slate-400">
                  {search
                    ? `Tidak ada hasil pencarian untuk "${search}"`
                    : "Tidak ada laporan"}
                </p>
              </div>
            ) : (
              <div className="px-5 space-y-2.5">
                {displayListed.map((r) => (
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
          </section>
        </main>
        <AppBottomNav />
      </div>
    </div>
  );
}
