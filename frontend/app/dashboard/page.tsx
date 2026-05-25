"use client";

import dynamic from "next/dynamic";
import { api } from "@/services/api";
import { socket } from "@/services/socket";
import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Percent,
  ChefHat,
  Hash,
} from "lucide-react";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
      <div className="bg-white rounded-2xl border border-gray-100 h-[400px] animate-pulse" />
      <div className="bg-white rounded-2xl border border-gray-100 h-[400px] animate-pulse" />
    </div>
  ),
});

function MetricCard({ title, value, icon, accent }: { title: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <div className={`p-2.5 rounded-xl ${accent}`}>{icon}</div>
      </div>
      <p className="text-3xl font-black text-gray-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [tablesData, setTablesData] = useState<any>(null);
  const [ordersData, setOrdersData] = useState<any>(null);

  async function loadDashboard() {
    try {
      const [tablesResponse, ordersResponse] = await Promise.all([
        api.get("/tables/dashboard"),
        api.get("/orders/dashboard"),
      ]);
      setTablesData(tablesResponse.data);
      setOrdersData(ordersResponse.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadDashboard();
    socket.connect();
    socket.on("dashboard:update", (data) => { setOrdersData(data); });
    socket.on("tableUpdate", loadDashboard);
    return () => {
      socket.off("dashboard:update");
      socket.off("tableUpdate");
      socket.disconnect();
    };
  }, []);

  if (!tablesData || !ordersData) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Carregando dashboard...</p>
        </div>
      </main>
    );
  }

  const chartData = [
    { day: "Seg", revenue: 1200, profit: 700 },
    { day: "Ter", revenue: 1800, profit: 1100 },
    { day: "Qua", revenue: 1400, profit: 800 },
    { day: "Qui", revenue: 2200, profit: 1400 },
    { day: "Sex", revenue: 3200, profit: 2100 },
    { day: "Sáb", revenue: 4800, profit: 3200 },
    { day: "Dom", revenue: 3900, profit: 2600 },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Visão geral em tempo real</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <MetricCard
            title="Faturamento"
            value={`R$ ${Number(ordersData.revenue).toFixed(2)}`}
            icon={<DollarSign size={18} className="text-green-600" />}
            accent="bg-green-50"
          />
          <MetricCard
            title="Lucro"
            value={`R$ ${Number(ordersData.totalProfit).toFixed(2)}`}
            icon={<TrendingUp size={18} className="text-emerald-600" />}
            accent="bg-emerald-50"
          />
          <MetricCard
            title="CMV"
            value={`R$ ${Number(ordersData.totalCmv).toFixed(2)}`}
            icon={<ChefHat size={18} className="text-orange-600" />}
            accent="bg-orange-50"
          />
          <MetricCard
            title="Margem"
            value={`${Number(ordersData.margin).toFixed(1)}%`}
            icon={<Percent size={18} className="text-blue-600" />}
            accent="bg-blue-50"
          />
          <MetricCard
            title="Pedidos"
            value={String(ordersData.totalOrders)}
            icon={<ShoppingCart size={18} className="text-violet-600" />}
            accent="bg-violet-50"
          />
          <MetricCard
            title="Ticket Médio"
            value={`R$ ${Number(ordersData.averageTicket).toFixed(2)}`}
            icon={<Hash size={18} className="text-pink-600" />}
            accent="bg-pink-50"
          />
        </div>

        <DashboardCharts chartData={chartData} />
      </div>
    </main>
  );
}
