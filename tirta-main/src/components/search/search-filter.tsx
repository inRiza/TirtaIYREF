"use client";

import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RiskCategory } from "@/components/card/report-card-overlay";
import { cn } from "@/lib/utils";

export type SortOption = "latest" | "oldest" | "nearest" | null;

export interface FilterState {
  risk: RiskCategory[];
  sort: SortOption;
}

interface HomeSearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  className?: string;
}

export const RISK_OPTIONS: { value: RiskCategory; label: string }[] = [
  { value: "TINGGI", label: "Risiko Tinggi" },
  { value: "SEDANG", label: "Risiko Sedang" },
  { value: "RENDAH", label: "Risiko Rendah" },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "nearest", label: "Terdekat" },
];

export const SORT_LABEL: Record<NonNullable<SortOption>, string> = {
  latest: "Terbaru",
  oldest: "Terlama",
  nearest: "Terdekat",
};

export function SearchFilter({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  className,
}: HomeSearchFilterProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filter);
  const [inputValue, setInputValue] = useState(search);
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = filter.risk.length + (filter.sort ? 1 : 0);

  useEffect(() => {
    setDraft(filter);
  }, [filter]);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  // debounce
  useEffect(() => {
    const debounce = 400;

    const timer = setTimeout(() => {
      onSearchChange(inputValue);
    }, debounce);

    return () => clearTimeout(timer);
  }, [inputValue, onSearchChange]);

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

  const toggleDraftRisk = (v: RiskCategory) =>
    setDraft((d) => ({
      ...d,
      risk: d.risk.includes(v) ? d.risk.filter((r) => r !== v) : [...d.risk, v],
    }));

  const applyFilter = () => {
    onFilterChange(draft);
    setFilterOpen(false);
  };

  const resetFilter = () => {
    const reset: FilterState = { risk: [], sort: null };
    setDraft(reset);
    onFilterChange(reset);
    setFilterOpen(false);
  };

  const openFilter = () => {
    setDraft(filter);
    setFilterOpen(true);
  };

  return (
    <div className={cn("relative px-5 py-3", className)} ref={filterRef}>
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Telusuri laporan di sekitarmu"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={openFilter}
            className="bg-brand text-white flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm active:scale-95 transition-all"
          >
            <SlidersHorizontal size={18} />
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-14 z-40 w-72 rounded-lg bg-white shadow-2xl border border-slate-100 p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Filter Laporan
                </h3>
                <button
                  type="button"
                  onClick={resetFilter}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Reset
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 mb-3">
                  Tingkat Risiko
                </p>
                <div className="flex flex-wrap gap-2">
                  {RISK_OPTIONS.map((opt) => {
                    const active = draft.risk.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleDraftRisk(opt.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all border",
                          active
                            ? "bg-brand border-brand text-white shadow-md shadow-blue-100"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-200",
                        )}
                      >
                        {active && <Check size={10} />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 mb-3">Urutkan</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {SORT_OPTIONS.map((opt) => {
                    const active = draft.sort === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({ ...d, sort: opt.value }))
                        }
                        className={cn(
                          "flex items-center justify-between rounded-sm px-4 py-2.5 text-xs font-semibold transition-all",
                          active
                            ? "bg-blue-50 text-brand"
                            : "text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        <span>{opt.label}</span>
                        {active && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={applyFilter}
                className="w-full h-10 rounded-lg bg-brand text-white text-xs font-bold"
              >
                Terapkan
              </button>
            </div>
          )}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
          {filter.risk.map((r) => (
            <div
              key={r}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 border border-slate-200"
            >
              <span>{RISK_OPTIONS.find((o) => o.value === r)?.label}</span>
              <button
                type="button"
                onClick={() =>
                  onFilterChange({
                    ...filter,
                    risk: filter.risk.filter((item) => item !== r),
                  })
                }
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {filter.sort && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 border border-slate-200">
              <span>
                Urut: {SORT_LABEL[filter.sort as NonNullable<SortOption>]}
              </span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filter, sort: null })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
