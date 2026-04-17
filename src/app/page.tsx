import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DealsPage } from "@/components/deals/DealsPage";

export default function Home() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-6 text-sm text-ink-500">Loading deals...</div>}>
        <DealsPage />
      </Suspense>
    </AppShell>
  );
}
