export interface Deal {
  id: string;
  title: string;
  slug: string;
  description?: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  askingPrice: number | null;
  revenue: number | null;
  earnings: number | null;
  marginPct: number | null;
  multiple: number | null;
  industry: string;
  subIndustry: string;
  logoUrl?: string;
  logoColor?: string;
  sourceName?: string;
  sourceUrl?: string;
  isOffMarket: boolean;
  isSaved: boolean;
  status: "active" | "under_loi" | "sold" | "withdrawn";
  listedAt: string;
  createdAt: string;
}

export interface FilterState {
  search: string;
  searchMode: "keyword" | "ai";
  priceMin: number | null;
  priceMax: number | null;
  revenueMin: number | null;
  revenueMax: number | null;
  earningsMin: number | null;
  earningsMax: number | null;
  marginMin: number | null;
  marginMax: number | null;
  multipleMin: number | null;
  multipleMax: number | null;
  industries: string[];
  states: string[];
  country: string;
  dealTypes: string[];
  sortBy: string;
  sortDir: "asc" | "desc";
}

export interface SidebarItem {
  label: string;
  icon: string;
  href: string;
  badge?: string;
  children?: SidebarItem[];
}

export type SortField =
  | "askingPrice"
  | "revenue"
  | "earnings"
  | "marginPct"
  | "multiple"
  | "listedAt";

export type SortDirection = "asc" | "desc" | null;
