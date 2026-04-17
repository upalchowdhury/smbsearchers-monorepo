"use client";

import { useAppStore } from "@/lib/store";
import { PromoBanner } from "./PromoBanner";
import { DealsToolbar } from "./DealsToolbar";
import { DealsTable } from "./DealsTable";
import { FilterPanel } from "./FilterPanel";
import { DealDetailSheet } from "./DealDetailSheet";
import { useActiveDeals } from "@/hooks/useActiveDeals";
import { useEffect, useMemo, useState } from "react";
import { Deal } from "@/lib/types";
import { formatMultiple, formatPercent, formatPriceDollars } from "@/lib/formatters";
import { AlertTriangle, RefreshCcw, Database, BarChart3, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function mapSortForApi(sortField: string | null, sortDirection: "asc" | "desc" | null): string {
  if (!sortField || !sortDirection) return "newest";

  if (sortField === "askingPrice") {
    return sortDirection === "asc" ? "price_asc" : "price_desc";
  }

  if (sortField === "earnings") {
    return sortDirection === "asc" ? "cash_flow_asc" : "cash_flow_desc";
  }

  if (sortField === "multiple") {
    return sortDirection === "asc" ? "multiple_asc" : "multiple_desc";
  }

  if (sortField === "revenue") {
    return sortDirection === "asc" ? "revenue_asc" : "revenue_desc";
  }

  if (sortField === "listedAt") {
    return sortDirection === "asc" ? "oldest" : "newest";
  }

  return "newest";
}

export function DealsPage() {
  const filters = useAppStore((s) => s.filters);
  const sortField = useAppStore((s) => s.sortField);
  const sortDirection = useAppStore((s) => s.sortDirection);
  const showFilters = useAppStore((s) => s.showFilters);
  const selectedDealId = useAppStore((s) => s.selectedDealId);
  const setSelectedDealId = useAppStore((s) => s.setSelectedDealId);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryPage = toPositiveInt(searchParams.get("page"), 1);
  const queryPageSize = toPositiveInt(searchParams.get("pageSize"), 50);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [jumpPage, setJumpPage] = useState("");

  const apiSort = useMemo(() => mapSortForApi(sortField, sortDirection), [sortField, sortDirection]);

  useEffect(() => {
    setPage(1);
  }, [filters, apiSort]);

  useEffect(() => {
    if (page !== queryPage) setPage(queryPage);
    if (pageSize !== queryPageSize) setPageSize(queryPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryPage, queryPageSize]);

  useEffect(() => {
    if (queryPage === page && queryPageSize === pageSize) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    next.set("pageSize", String(pageSize));
    const target = `${pathname}?${next.toString()}`;
    router.replace(target, { scroll: false });
  }, [page, pageSize, pathname, queryPage, queryPageSize, router, searchParams]);

  const { data, isLoading, isError, refetch, isFetching } = useActiveDeals({
    page,
    pageSize,
    filters,
    sort: apiSort,
  });

  const realDeals = data?.deals || [];
  const totalDeals = data?.pagination.total || 0;
  const totalPages = Math.max(1, data?.pagination.totalPages || 1);

  const selectedDeal = selectedDealId
    ? realDeals?.find((d: Deal) => d.id === selectedDealId)
    : null;

  const kpis = useMemo(() => {
    const deals = realDeals;
    const withAsking = deals.filter((d) => d.askingPrice !== null);
    const withMargin = deals.filter((d) => d.marginPct !== null);
    const withMultiple = deals.filter((d) => d.multiple !== null);

    const avgAsking = withAsking.length
      ? withAsking.reduce((sum, d) => sum + (d.askingPrice || 0), 0) / withAsking.length
      : null;

    const avgMargin = withMargin.length
      ? withMargin.reduce((sum, d) => sum + (d.marginPct || 0), 0) / withMargin.length
      : null;

    const avgMultiple = withMultiple.length
      ? withMultiple.reduce((sum, d) => sum + (d.multiple || 0), 0) / withMultiple.length
      : null;

    return {
      total: totalDeals,
      avgAsking,
      avgMargin,
      avgMultiple,
    };
  }, [realDeals, totalDeals]);

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="shrink-0 px-6 pt-4 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            Explore active deals aggregated across multiple acquisition sources
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-surface-300 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-surface-50"
          >
            <RefreshCcw size={12} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KpiCard icon={<Database size={14} />} label="Active Deals" value={kpis.total.toLocaleString()} />
          <KpiCard icon={<BarChart3 size={14} />} label="Avg Asking" value={formatPriceDollars(kpis.avgAsking)} />
          <KpiCard icon={<Target size={14} />} label="Avg Margin" value={formatPercent(kpis.avgMargin)} />
          <KpiCard icon={<Target size={14} />} label="Avg Multiple" value={formatMultiple(kpis.avgMultiple)} />
        </div>
      </div>

      <PromoBanner />
      <DealsToolbar resultCount={totalDeals} />
      {showFilters && <FilterPanel />}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <DealsTableSkeleton />
        ) : isError ? (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={16} />
              Failed to load deals
            </div>
            <p className="mt-1 text-red-600">Please check API/database connectivity and try refreshing.</p>
          </div>
        ) : realDeals.length === 0 ? (
          <div className="mx-6 mt-4 rounded-xl border border-surface-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-ink-700">No deals match current filters.</p>
            <p className="mt-1 text-xs text-ink-500">Try clearing filters or importing more scraped records.</p>
          </div>
        ) : (
          <DealsTable deals={realDeals} />
        )}
      </div>

      {/* Pagination */}
      <div className="shrink-0 border-t border-surface-200 bg-white px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            Page <span className="font-medium text-ink-700">{page}</span> of{" "}
            <span className="font-medium text-ink-700">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-500">Rows</label>
            <select
              className="rounded-md border border-surface-300 bg-white px-2 py-1 text-xs text-ink-700"
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setPageSize(nextSize);
                setPage(1);
              }}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="inline-flex items-center gap-1 rounded-md border border-surface-300 px-2 py-1 text-xs text-ink-700 hover:bg-surface-50 disabled:opacity-50"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              className="inline-flex items-center gap-1 rounded-md border border-surface-300 px-2 py-1 text-xs text-ink-700 hover:bg-surface-50 disabled:opacity-50"
            >
              Next <ChevronRight size={13} />
            </button>

            <div className="ml-1 flex items-center gap-1.5">
              <label className="text-xs text-ink-500">Go to</label>
              <input
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-14 rounded-md border border-surface-300 px-2 py-1 text-xs text-ink-700"
                inputMode="numeric"
                placeholder={String(page)}
              />
              <button
                onClick={() => {
                  if (!jumpPage) return;
                  const nextPage = Number.parseInt(jumpPage, 10);
                  if (!Number.isFinite(nextPage)) return;
                  setPage(Math.min(totalPages, Math.max(1, nextPage)));
                  setJumpPage("");
                }}
                className="rounded-md border border-surface-300 px-2 py-1 text-xs text-ink-700 hover:bg-surface-50"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      <DealDetailSheet
        deal={selectedDeal || null}
        open={!!selectedDealId}
        onClose={() => setSelectedDealId(null)}
      />
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-ink-500 text-[11px] font-medium">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink-900 tabular-nums">{value}</p>
    </div>
  );
}

function DealsTableSkeleton() {
  return (
    <div className="px-6 py-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-surface-100 animate-pulse" />
      ))}
    </div>
  );
}
