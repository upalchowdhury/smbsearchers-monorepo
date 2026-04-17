import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
    isCollapsed: boolean;
    toggle: () => void;
    setCollapsed: (collapsed: boolean) => void;
}

export const useSidebar = create<SidebarState>()(
    persist(
        (set) => ({
            isCollapsed: false,
            toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
            setCollapsed: (isCollapsed: boolean) => set({ isCollapsed }),
        }),
        {
            name: 'dealflow-sidebar-state',
        }
    )
);
