"use client";

import { useAppStore } from "@/lib/store";
import { SlidersHorizontal, Search, Bookmark, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function DealsToolbar({ resultCount }: { resultCount: number }) {
  const filters = useAppStore((s) => s.filters);
  const setFilter = useAppStore((s) => s.setFilter);
  const showFilters = useAppStore((s) => s.showFilters);
  const toggleFilters = useAppStore((s) => s.toggleFilters);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-200 px-5 py-2 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2.5">
        {/* Filters toggle */}
        <button
          onClick={toggleFilters}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            showFilters
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-surface-300 bg-white text-ink-700 hover:bg-surface-50"
          )}
        >
          <SlidersHorizontal size={14} />
          Show Filters
        </button>

        {/* Keyword / AI toggle */}
        <div className="flex items-center rounded-lg border border-surface-300 bg-white p-0.5">
          <button
            onClick={() => setFilter("searchMode", "keyword")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filters.searchMode === "keyword"
                ? "bg-ink-900 text-white shadow-sm"
                : "text-ink-500 hover:text-ink-700"
            )}
          >
            <span className="flex items-center gap-1">
              <span className="text-[10px]">◉</span> Keyword
            </span>
          </button>
          <button
            onClick={() => setFilter("searchMode", "ai")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              filters.searchMode === "ai"
                ? "bg-ink-900 text-white shadow-sm"
                : "text-ink-500 hover:text-ink-700"
            )}
          >
            <span className="flex items-center gap-1">
              <span className="text-[10px]">✦</span> AI
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            placeholder={
              filters.searchMode === "keyword"
                ? "Search keywords..."
                : "Describe your ideal business..."
            }
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="h-8 w-56 rounded-lg border border-surface-300 bg-white pl-3 pr-8 text-xs text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-shadow"
          />
          <button className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:text-ink-600 transition-colors">
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-50 transition-colors">
          <Bookmark size={14} />
          Save Search
        </button>
        <span className="text-xs text-ink-400">
          Showing{" "}
          <span className="font-semibold text-ink-700">
            {resultCount.toLocaleString()}
          </span>{" "}
          results
        </span>
      </div>
    </div>
  );
}
