"use client";

import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-200 ease-out",
          collapsed ? "ml-[60px]" : "ml-[220px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}
