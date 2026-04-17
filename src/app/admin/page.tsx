"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { RefreshCcw, Play, Database, Activity, CheckCircle2, AlertCircle } from "lucide-react";

type AdminStats = {
  totalActive: number;
  totalAll: number;
  bySource: Array<{ name: string; count: number }>;
  byIndustry: Array<{ industryNormalized: string; count: number }>;
  byState: Array<{ stateCode: string; count: number }>;
  recentRuns: Array<{
    id: string;
    status: string;
    listingsFound: number;
    listingsNew: number;
    listingsUpdated: number;
    createdAt: string;
    source?: { name: string };
  }>;
};

const SCRAPE_SOURCES = ["bizbuysell", "bizquest", "acquire", "transworld", "quietlight"];

export default function AdminPage() {
  const [runningSource, setRunningSource] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin");
      if (!res.ok) throw new Error("Failed to load admin stats");
      return (await res.json()) as AdminStats;
    },
    staleTime: 60_000,
  });

  const latestRun = useMemo(() => data?.recentRuns?.[0] || null, [data]);

  const queueScrape = async (source: string) => {
    setRunningSource(source);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error("Failed to queue scrape");
      await refetch();
    } finally {
      setRunningSource(null);
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink-900">Admin Dashboard</h1>
            <p className="text-xs text-ink-500">Monitor data freshness and queue source runs.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-50"
          >
            <RefreshCcw size={13} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-surface-100 animate-pulse" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load admin data.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="Active Listings" value={data.totalActive.toLocaleString()} icon={<Database size={14} />} />
              <StatCard label="Total Listings" value={data.totalAll.toLocaleString()} icon={<Activity size={14} />} />
              <StatCard
                label="Latest Run"
                value={latestRun ? `${latestRun.source?.name || "unknown"} • ${latestRun.status}` : "No runs"}
                icon={latestRun?.status === "COMPLETED" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              />
            </div>

            <div className="rounded-xl border border-surface-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-ink-900 mb-2">Queue Manual Scrape</h2>
              <div className="flex flex-wrap gap-2">
                {SCRAPE_SOURCES.map((source) => (
                  <button
                    key={source}
                    onClick={() => queueScrape(source)}
                    disabled={runningSource !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-50 disabled:opacity-60"
                  >
                    <Play size={12} />
                    {runningSource === source ? `Queueing ${source}...` : `Run ${source}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <TopListCard
                title="Top Sources"
                rows={data.bySource.slice(0, 8).map((x) => ({ label: x.name, value: x.count.toLocaleString() }))}
              />
              <TopListCard
                title="Top Industries"
                rows={data.byIndustry.slice(0, 8).map((x) => ({ label: x.industryNormalized || "Unknown", value: x.count.toLocaleString() }))}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-500 font-medium">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-base font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function TopListCard({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-ink-900 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-ink-600 truncate pr-2">{row.label}</span>
            <span className="font-medium text-ink-900 tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
