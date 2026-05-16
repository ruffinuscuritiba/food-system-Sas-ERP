import { create }
from "zustand";

interface DashboardData {

  revenue: number;

  totalProfit: number;

  totalCmv: number;

  margin: number;

  totalOrders: number;

  averageTicket: number;
}

interface DashboardStore {

  dashboard: DashboardData | null;

  setDashboard: (
    dashboard: DashboardData,
  ) => void;
}

export const useDashboardStore =
  create<DashboardStore>(
    (set) => ({

      dashboard: null,

      setDashboard:
        (dashboard) =>

          set({
            dashboard,
          }),
    }),
  );