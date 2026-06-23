import { create } from "zustand";

type CompanyStore = {
  sidebarConfig: Record<string, boolean>;
  setSidebarConfig: (config: Record<string, boolean>) => void;
  isNavVisible: (navKey: string) => boolean;
};

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  sidebarConfig: {},

  setSidebarConfig: (config) => set({ sidebarConfig: config }),

  // false = hidden by admin; undefined/true = visible
  isNavVisible: (navKey: string) => get().sidebarConfig[navKey] !== false,
}));
