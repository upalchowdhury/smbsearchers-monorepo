import { formatDistanceToNow } from "date-fns";

export function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return "N/A";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    const m = dollars / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    const k = dollars / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return `$${dollars.toFixed(0)}`;
}

export function formatPriceDollars(dollars: number | null): string {
  if (dollars === null || dollars === undefined) return "N/A";
  if (dollars >= 1_000_000) {
    const m = dollars / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    const k = dollars / 1_000;
    return `$${k >= 100 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return `$${dollars.toFixed(0)}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

export function formatMultiple(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(1)}x`;
}

export function formatRelativeDate(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return "N/A";
  }
}
