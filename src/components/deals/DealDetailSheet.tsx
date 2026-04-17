"use client";

import { Deal } from "@/lib/types";
import { formatPriceDollars, formatPercent, formatMultiple, formatRelativeDate } from "@/lib/formatters";
import { INDUSTRY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  X,
  Bookmark,
  ExternalLink,
  GitBranch,
  MapPin,
  Calendar,
  TrendingUp,
  DollarSign,
  BarChart3,
  Target,
} from "lucide-react";

interface DealDetailSheetProps {
  deal: Deal | null;
  open: boolean;
  onClose: () => void;
}

export function DealDetailSheet({ deal, open, onClose }: DealDetailSheetProps) {
  if (!open || !deal) return null;

  const indColors = INDUSTRY_COLORS[deal.industry] || {
    bg: "bg-gray-50",
    text: "text-gray-700",
  };

  const stats = [
    {
      label: "Asking Price",
      value: formatPriceDollars(deal.askingPrice),
      icon: <DollarSign size={16} />,
      highlight: true,
    },
    {
      label: "Revenue",
      value: formatPriceDollars(deal.revenue),
      icon: <TrendingUp size={16} />,
    },
    {
      label: "Earnings",
      value: formatPriceDollars(deal.earnings),
      icon: <BarChart3 size={16} />,
    },
    {
      label: "Margin",
      value: formatPercent(deal.marginPct),
      icon: <Target size={16} />,
      good: deal.marginPct !== null && deal.marginPct >= 25,
    },
    {
      label: "Multiple",
      value: formatMultiple(deal.multiple),
      icon: <Target size={16} />,
      good: deal.multiple !== null && deal.multiple <= 3,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[480px] bg-white shadow-2xl border-l border-surface-200 animate-slide-right overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-surface-200 bg-white/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold shadow-md"
                style={{ backgroundColor: deal.logoColor || "#6366f1" }}
              >
                {deal.title.charAt(0)}
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink-900 leading-tight">
                  {deal.title}
                </h2>
                <p className="text-xs text-ink-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} />
                  {deal.locationCity}, {deal.locationState}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700 hover:bg-surface-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm">
              <Bookmark size={13} />
              Save Deal
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-50 transition-colors">
              <GitBranch size={13} />
              Add to Pipeline
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-50 transition-colors">
              <ExternalLink size={13} />
              View Source
            </button>
          </div>
        </div>

        {/* Financial stats */}
        <div className="px-6 py-5 border-b border-surface-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Financial Summary
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-xl border p-3",
                  stat.highlight
                    ? "border-brand-200 bg-brand-50/50 col-span-2"
                    : stat.good
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-surface-200 bg-surface-50/50"
                )}
              >
                <div className="flex items-center gap-1.5 text-ink-500 mb-1">
                  {stat.icon}
                  <span className="text-[11px] font-medium">{stat.label}</span>
                </div>
                <p
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    stat.highlight
                      ? "text-brand-700"
                      : stat.good
                      ? "text-emerald-700"
                      : "text-ink-900"
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 border-b border-surface-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Details
          </h3>
          <div className="space-y-2.5">
            <DetailRow label="Industry">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                  indColors.bg,
                  indColors.text
                )}
              >
                {deal.industry}
              </span>
            </DetailRow>
            <DetailRow label="Sub-Category">
              <span className="text-[13px] text-ink-700">{deal.subIndustry}</span>
            </DetailRow>
            <DetailRow label="Location">
              <span className="text-[13px] text-ink-700">
                {deal.locationCity}, {deal.locationState}, {deal.locationCountry}
              </span>
            </DetailRow>
            <DetailRow label="Listed">
              <span className="text-[13px] text-ink-700 flex items-center gap-1">
                <Calendar size={12} className="text-ink-400" />
                {formatRelativeDate(deal.listedAt)}
              </span>
            </DetailRow>
            <DetailRow label="Status">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </DetailRow>
            <DetailRow label="Source">
              <span className="text-[13px] text-brand-600 font-medium">
                {deal.sourceName || "Direct"}
              </span>
            </DetailRow>
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-5 border-b border-surface-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Description
          </h3>
          <p className="text-[13px] text-ink-600 leading-relaxed">
            {deal.description ||
              "No detailed description available for this listing. Contact the broker for more information."}
          </p>
        </div>

        {/* Notes */}
        <div className="px-6 py-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Private Notes
          </h3>
          <textarea
            className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3.5 py-2.5 text-[13px] text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-none transition-shadow"
            rows={4}
            placeholder="Add your notes about this deal..."
          />
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-ink-400">{label}</span>
      {children}
    </div>
  );
}
