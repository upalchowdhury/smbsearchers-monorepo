"use client";

import { useAppStore } from "@/lib/store";
import { INDUSTRIES } from "@/lib/constants";
import { X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PRICE_PRESETS = [
  { label: "Under $100K", min: 0, max: 100_000 },
  { label: "$100K – $500K", min: 100_000, max: 500_000 },
  { label: "$500K – $1M", min: 500_000, max: 1_000_000 },
  { label: "$1M – $5M", min: 1_000_000, max: 5_000_000 },
  { label: "$5M+", min: 5_000_000, max: null },
];

export function FilterPanel() {
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const toggleFilters = useAppStore((s) => s.toggleFilters);

  const toggleIndustry = (industry: string) => {
    const current = filters.industries;
    if (current.includes(industry)) {
      setFilter(
        "industries",
        current.filter((i) => i !== industry)
      );
    } else {
      setFilter("industries", [...current, industry]);
    }
  };

  return (
    <div className="border-b border-surface-200 bg-surface-50 px-5 py-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-ink-700 uppercase tracking-wide">
          Filters
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-700 transition-colors"
          >
            <RotateCcw size={12} />
            Clear all
          </button>
          <button
            onClick={toggleFilters}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:text-ink-700 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Price presets */}
        <div>
          <label className="text-[11px] font-medium text-ink-500 mb-1.5 block">
            Asking Price
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((p) => {
              const active =
                filters.priceMin === p.min && filters.priceMax === p.max;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    if (active) {
                      setFilter("priceMin", null);
                      setFilter("priceMax", null);
                    } else {
                      setFilter("priceMin", p.min);
                      setFilter("priceMax", p.max);
                    }
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-surface-300 bg-white text-ink-600 hover:border-brand-300"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Industries */}
        <div className="md:col-span-2">
          <label className="text-[11px] font-medium text-ink-500 mb-1.5 block">
            Industry{" "}
            {filters.industries.length > 0 && (
              <span className="text-brand-600">
                ({filters.industries.length})
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map((ind) => {
              const active = filters.industries.includes(ind);
              return (
                <button
                  key={ind}
                  onClick={() => toggleIndustry(ind)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-surface-300 bg-white text-ink-600 hover:border-brand-300"
                  )}
                >
                  {ind}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
