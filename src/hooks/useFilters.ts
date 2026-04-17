import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FilterState {
    keyword: string;
    minPrice: number | null;
    maxPrice: number | null;
    minRevenue: number | null;
    maxRevenue: number | null;
    minCashFlow: number | null;
    maxCashFlow: number | null;
    industries: string[];
    states: string[];
}

interface FilterStore {
    filters: FilterState;
    isPanelOpen: boolean;
    togglePanel: () => void;
    setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    clearFilters: () => void;
    getActiveFilterCount: () => number;
}

const initialFilters: FilterState = {
    keyword: '',
    minPrice: null,
    maxPrice: null,
    minRevenue: null,
    maxRevenue: null,
    minCashFlow: null,
    maxCashFlow: null,
    industries: [],
    states: [],
};

export const useFilters = create<FilterStore>()(
    persist(
        (set, get) => ({
            filters: initialFilters,
            isPanelOpen: false,
            togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
            setFilter: (key, value) =>
                set((state) => ({
                    filters: { ...state.filters, [key]: value },
                })),
            clearFilters: () => set({ filters: initialFilters }),
            getActiveFilterCount: () => {
                const { filters } = get();
                let count = 0;
                if (filters.keyword) count++;
                if (filters.minPrice !== null || filters.maxPrice !== null) count++;
                if (filters.minRevenue !== null || filters.maxRevenue !== null) count++;
                if (filters.minCashFlow !== null || filters.maxCashFlow !== null) count++;
                if (filters.industries.length > 0) count++;
                if (filters.states.length > 0) count++;
                return count;
            },
        }),
        {
            name: 'dealflow-filters',
            partialize: (state) => ({ filters: state.filters }),
        }
    )
);
