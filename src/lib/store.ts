import { create } from "zustand";
import { FilterState, SortDirection, SortField } from "./types";

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Filters
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  showFilters: boolean;
  toggleFilters: () => void;

  // Sorting
  sortField: SortField | null;
  sortDirection: SortDirection;
  setSort: (field: SortField) => void;

  // Saved deals
  savedDealIds: Set<string>;
  toggleSaveDeal: (id: string) => void;

  // UI
  promoBannerVisible: boolean;
  dismissPromoBanner: () => void;
  selectedDealId: string | null;
  setSelectedDealId: (id: string | null) => void;
}

const defaultFilters: FilterState = {
  search: "",
  searchMode: "keyword",
  priceMin: null,
  priceMax: null,
  revenueMin: null,
  revenueMax: null,
  earningsMin: null,
  earningsMax: null,
  marginMin: null,
  marginMax: null,
  multipleMin: null,
  multipleMax: null,
  industries: [],
  states: [],
  country: "United States",
  dealTypes: [],
  sortBy: "listedAt",
  sortDir: "desc",
};

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Filters
  filters: { ...defaultFilters },
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  showFilters: false,
  toggleFilters: () => set((s) => ({ showFilters: !s.showFilters })),

  // Sorting
  sortField: "listedAt",
  sortDirection: "desc",
  setSort: (field) =>
    set((s) => {
      if (s.sortField === field) {
        if (s.sortDirection === "asc") return { sortDirection: "desc" };
        if (s.sortDirection === "desc") return { sortField: null, sortDirection: null };
        return { sortField: field, sortDirection: "asc" };
      }
      return { sortField: field, sortDirection: "asc" };
    }),

  // Saved
  savedDealIds: new Set(),
  toggleSaveDeal: (id) =>
    set((s) => {
      const next = new Set(s.savedDealIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { savedDealIds: next };
    }),

  // UI
  promoBannerVisible: true,
  dismissPromoBanner: () => set({ promoBannerVisible: false }),
  selectedDealId: null,
  setSelectedDealId: (id) => set({ selectedDealId: id }),
}));
