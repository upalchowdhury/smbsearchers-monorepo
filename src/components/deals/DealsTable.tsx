"use client";

import { Deal, SortField } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatPriceDollars, formatPercent, formatMultiple, formatRelativeDate } from "@/lib/formatters";
import { INDUSTRY_COLORS } from "@/lib/constants";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Lock,
  MoreHorizontal,
  Square,
} from "lucide-react";

interface DealsTableProps {
  deals: Deal[];
}

const COLUMNS: {
  key: string;
  label: string;
  sortKey?: SortField;
  width: string;
  align?: "left" | "right" | "center";
}[] = [
  { key: "actions", label: "ACTIONS", width: "w-[100px]" },
  { key: "listing", label: "LISTING", width: "min-w-[260px] w-[280px]" },
  {
    key: "askingPrice",
    label: "ASKING",
    sortKey: "askingPrice",
    width: "w-[90px]",
    align: "right",
  },
  {
    key: "revenue",
    label: "REVENUE",
    sortKey: "revenue",
    width: "w-[90px]",
    align: "right",
  },
  {
    key: "earnings",
    label: "EARNINGS",
    sortKey: "earnings",
    width: "w-[90px]",
    align: "right",
  },
  {
    key: "marginPct",
    label: "MARGIN %",
    sortKey: "marginPct",
    width: "w-[85px]",
    align: "right",
  },
  {
    key: "multiple",
    label: "MULTIPLE",
    sortKey: "multiple",
    width: "w-[85px]",
    align: "right",
  },
  { key: "industry", label: "INDUSTRY", width: "min-w-[220px] flex-1" },
  {
    key: "listedAt",
    label: "DATE",
    sortKey: "listedAt",
    width: "w-[110px]",
    align: "right",
  },
  { key: "source", label: "SOURCE", width: "w-[70px]", align: "center" },
];

export function DealsTable({ deals }: DealsTableProps) {
  const sortField = useAppStore((s) => s.sortField);
  const sortDirection = useAppStore((s) => s.sortDirection);
  const setSort = useAppStore((s) => s.setSort);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center border-b border-surface-200 bg-surface-50/95 backdrop-blur-sm px-3">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn(
              "flex items-center gap-1 py-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 select-none shrink-0",
              col.width,
              col.align === "right" && "justify-end",
              col.align === "center" && "justify-center",
              col.sortKey && "cursor-pointer hover:text-ink-700 transition-colors"
            )}
            onClick={() => col.sortKey && setSort(col.sortKey)}
          >
            {col.label}
            {col.sortKey && (
              <SortIndicator
                active={sortField === col.sortKey}
                direction={sortField === col.sortKey ? sortDirection : null}
              />
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div>
        {deals.map((deal, index) => (
          <DealRow key={deal.id} deal={deal} index={index} />
        ))}
      </div>
    </div>
  );
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc" | null;
}) {
  if (!active || !direction) {
    return <ArrowUpDown size={12} className="text-ink-300" />;
  }
  return direction === "asc" ? (
    <ArrowUp size={12} className="text-brand-600" />
  ) : (
    <ArrowDown size={12} className="text-brand-600" />
  );
}

function DealRow({ deal, index }: { deal: Deal; index: number }) {
  const savedDealIds = useAppStore((s) => s.savedDealIds);
  const toggleSaveDeal = useAppStore((s) => s.toggleSaveDeal);
  const setSelectedDealId = useAppStore((s) => s.setSelectedDealId);
  const isSaved = savedDealIds.has(deal.id);
  const indColors = INDUSTRY_COLORS[deal.industry] || {
    bg: "bg-gray-50",
    text: "text-gray-700",
  };

  return (
    <div
      className={cn(
        "flex items-center border-b border-surface-100 px-3 table-row-hover cursor-pointer group",
        index % 2 === 1 && "bg-surface-50/40"
      )}
      style={{ animationDelay: `${Math.min(index * 15, 300)}ms` }}
      onClick={() => setSelectedDealId(deal.id)}
    >
      {/* ACTIONS */}
      <div className="flex items-center gap-1 py-2 px-2 w-[100px] shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex h-5 w-5 items-center justify-center rounded border border-surface-300 text-ink-300 hover:border-brand-400 hover:text-brand-500 transition-colors"
        >
          <Square size={10} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSaveDeal(deal.id);
          }}
          className={cn(
            "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
            isSaved
              ? "text-brand-600 bg-brand-50"
              : "text-ink-500 hover:text-brand-600 hover:bg-brand-50"
          )}
        >
          {isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          Save
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded text-ink-300 hover:text-ink-600 transition-colors"
        >
          <ExternalLink size={12} />
        </button>
      </div>

      {/* LISTING */}
      <div className="flex items-center gap-2.5 py-2 px-2 min-w-[260px] w-[280px] shrink-0">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: deal.logoColor || "#6366f1" }}
        >
          {deal.title.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-900 truncate leading-tight group-hover:text-brand-700 transition-colors">
            {deal.title}
          </p>
          <p className="text-[11px] text-ink-400 truncate leading-tight mt-0.5">
            {deal.locationCity}, {deal.locationState},{" "}
            {deal.locationCountry}
          </p>
        </div>
      </div>

      {/* ASKING */}
      <div className="w-[90px] shrink-0 py-2 px-2 text-right">
        <span className={cn("text-[13px] tabular-nums", deal.askingPrice ? "text-ink-900 font-medium" : "text-ink-400")}>
          {formatPriceDollars(deal.askingPrice)}
        </span>
      </div>

      {/* REVENUE */}
      <div className="w-[90px] shrink-0 py-2 px-2 text-right">
        <span className={cn("text-[13px] tabular-nums", deal.revenue ? "text-ink-700" : "text-ink-400")}>
          {formatPriceDollars(deal.revenue)}
        </span>
      </div>

      {/* EARNINGS */}
      <div className="w-[90px] shrink-0 py-2 px-2 text-right">
        <span className={cn("text-[13px] tabular-nums", deal.earnings ? "text-ink-700" : "text-ink-400")}>
          {formatPriceDollars(deal.earnings)}
        </span>
      </div>

      {/* MARGIN */}
      <div className="w-[85px] shrink-0 py-2 px-2 text-right">
        <span
          className={cn(
            "text-[13px] tabular-nums",
            deal.marginPct === null
              ? "text-ink-400"
              : deal.marginPct >= 30
              ? "text-emerald-600 font-medium"
              : deal.marginPct >= 15
              ? "text-ink-700"
              : "text-ink-500"
          )}
        >
          {formatPercent(deal.marginPct)}
        </span>
      </div>

      {/* MULTIPLE */}
      <div className="w-[85px] shrink-0 py-2 px-2 text-right">
        <span
          className={cn(
            "text-[13px] tabular-nums",
            deal.multiple === null
              ? "text-ink-400"
              : deal.multiple <= 2.5
              ? "text-emerald-600 font-medium"
              : "text-ink-700"
          )}
        >
          {formatMultiple(deal.multiple)}
        </span>
      </div>

      {/* INDUSTRY */}
      <div className="min-w-[220px] flex-1 shrink-0 py-2 px-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight",
              indColors.bg,
              indColors.text
            )}
          >
            {deal.industry}
          </span>
          <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 text-[11px] font-medium text-ink-600 leading-tight">
            {deal.subIndustry}
          </span>
        </div>
      </div>

      {/* DATE */}
      <div className="w-[110px] shrink-0 py-2 px-2 text-right">
        <span className="text-[12px] text-ink-400">
          {formatRelativeDate(deal.listedAt)}
        </span>
      </div>

      {/* SOURCE */}
      <div className="w-[70px] shrink-0 py-2 px-2 flex items-center justify-center gap-1.5">
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-ink-300 hover:text-ink-500 transition-colors"
        >
          <Lock size={13} />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-ink-300 hover:text-ink-500 transition-colors"
        >
          <ExternalLink size={13} />
        </button>
      </div>
    </div>
  );
}
