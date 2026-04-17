import { AppShell } from "@/components/layout/AppShell";

type AppPlaceholderPageProps = {
  title: string;
  description: string;
};

export function AppPlaceholderPage({ title, description }: AppPlaceholderPageProps) {
  return (
    <AppShell>
      <div className="p-6">
        <div className="rounded-xl border border-surface-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
          <p className="mt-2 text-sm text-ink-500">{description}</p>
        </div>
      </div>
    </AppShell>
  );
}
