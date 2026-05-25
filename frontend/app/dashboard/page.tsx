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
} from "lucide-react";

// Recharts is heavy (~350KB) — load only after initial paint
const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-10">
      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 h-[466px] animate-pulse" />
      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 h-[466px] animate-pulse" />
    </div>
  ),
});

function MetricCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400">{title}</p>
          <h2 className={`text-4xl font-bold mt-4 ${color}`}>{value}</h2>
        </div>
        <div className="bg-slate-800 p-4 rounded-2xl">{icon}</div>
      </div>
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
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-2xl font-bold animate-pulse">Carregando Dashboard...</p>
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
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">

        <div className="mb-12">
          <h1 className="text-5xl font-black">Dashboard Enterprise</h1>
          <p className="text-slate-400 mt-3 text-lg">Gestão financeira realtime</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <MetricCard
            title="Faturamento"
            value={`R$ ${Number(ordersData.revenue).toFixed(2)}`}
            icon={<DollarSign />}
            color="text-green-400"
          />
          <MetricCard
            title="Lucro"
            value={`R$ ${Number(ordersData.totalProfit).toFixed(2)}`}
            icon={<TrendingUp />}
            color="text-emerald-400"
          />
          <MetricCard
            title="CMV"
            value={`R$ ${Number(ordersData.totalCmv).toFixed(2)}`}
            icon={<ChefHat />}
            color="text-red-400"
          />
          <MetricCard
            title="Margem"
            value={`${Number(ordersData.margin).toFixed(1)}%`}
            icon={<Percent />}
            color="text-cyan-400"
          />
          <MetricCard
            title="Pedidos"
            value={ordersData.totalOrders}
            icon={<ShoppingCart />}
            color="text-yellow-400"
          />
          <MetricCard
            title="Ticket Médio"
            value={`R$ ${Number(ordersData.averageTicket).toFixed(2)}`}
            icon={<DollarSign />}
            color="text-violet-400"
          />
        </div>

        <DashboardCharts chartData={chartData} />

      </div>
    </main>
  );
}
