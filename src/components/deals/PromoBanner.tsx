"use client";

import { useAppStore } from "@/lib/store";
import { X, Sparkles, ArrowRight } from "lucide-react";

export function PromoBanner() {
  const visible = useAppStore((s) => s.promoBannerVisible);
  const dismiss = useAppStore((s) => s.dismissPromoBanner);

  if (!visible) return null;

  return (
    <div className="mx-4 mt-2 mb-3 relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 via-blue-50 to-indigo-50">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-md shadow-brand-200">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              Want to see today&apos;s deals?
            </p>
            <p className="text-xs text-ink-500 mt-0.5">
              Start your free trial with DealFlow to unlock all listings, including
              those added in the last 30 days!
            </p>
          </div>
        </div>
        <button className="shrink-0 flex items-center gap-1.5 rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-700 transition-colors shadow-sm">
          Start 7-day free trial
          <ArrowRight size={14} />
        </button>
      </div>

      <button
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-ink-400 hover:text-ink-700 hover:bg-white/60 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
