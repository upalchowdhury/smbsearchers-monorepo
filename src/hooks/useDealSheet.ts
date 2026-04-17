import { create } from 'zustand';

export type SheetDeal = {
    id: string;
    title: string;
    description: string;
    sourceUrl: string;
    askingPrice: string | null;
    revenue: string | null;
    cashFlow: string | null;
    marginRaw: number | null;
    multiple: number | null;
    industryNormalized: string;
    city: string | null;
    stateCode: string | null;
    updatedAt: string;
    url: string | null;
    source: string;
};

type DealSheetState = {
    isOpen: boolean;
    selectedDeal: SheetDeal | null;
    openSheet: (deal: SheetDeal) => void;
    closeSheet: () => void;
};

export const useDealSheet = create<DealSheetState>((set) => ({
    isOpen: false,
    selectedDeal: null,
    openSheet: (deal) => set({ isOpen: true, selectedDeal: deal }),
    closeSheet: () => set({ isOpen: false, selectedDeal: null }),
}));
