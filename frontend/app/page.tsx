"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";

import { socket } from "@/services/socket";

import { api } from "@/services/api";

import toast, {
  Toaster,
} from "react-hot-toast";

import { KpiCard }
from "@/components/dashboard/kpi-card";

import { SalesChart }
from "@/components/dashboard/sales-chart";

export default function Home() {

  const router = useRouter();

  const [summary, setSummary] =
    useState<any>({
      entries: 0,
      exits: 0,
      balance: 0,
      totalSales: 0,
      totalOrders: 0,
      ticketAverage: 0,
    });

  function logout() {

    localStorage.removeItem(
      "token",
    );

    localStorage.removeItem(
      "user",
    );

    document.cookie =
      "token=; Max-Age=0; path=/";

    router.push("/login");
  }

  async function loadDashboard() {

    try {

      const response =
        await api.get(
  "/orders/dashboard",
);

      const data = response.data;

setSummary({
  entries: data.revenue || 0,

  exits: 0,

  balance: data.revenue || 0,

  totalSales: data.revenue || 0,

  totalOrders: data.totalOrders || 0,

  ticketAverage:
    data.averageTicket || 0,
});

    } catch (error) {

      toast.error(
        "Erro ao carregar dashboard",
      );
    }
  }

  useEffect(() => {

    loadDashboard();

    socket.on(
      "tableUpdate",
      () => {

        loadDashboard();
      },
    );

    socket.on(
      "orderCreated",
      () => {

        loadDashboard();
      },
    );

    socket.on(
  "dashboardUpdate",
  (data) => {

    setSummary({

      entries:
        data.revenue || 0,

      exits: 0,

      balance:
        data.revenue || 0,

      totalSales:
        data.revenue || 0,

      totalOrders:
        data.totalOrders || 0,

      ticketAverage:
        data.averageTicket || 0,
    });
  },
);

    socket.on(
      "kitchenUpdate",
      () => {

        loadDashboard();
      },
    );

    return () => {

      socket.disconnect();
    };

  }, []);

  return (

    <main className="min-h-screen bg-slate-950 text-white">

      <Toaster position="top-right" />

      <section className="p-8">

        <div className="flex items-center justify-between mb-10">

          <div>

            <h2 className="text-4xl font-bold mb-2">
              Dashboard
            </h2>

            <p className="text-slate-400">
              Gestão SaaS em tempo real
            </p>

          </div>

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 transition rounded-xl py-3 px-6 font-semibold"
          >
            Sair
          </button>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">

          <KpiCard
            title="Entradas"
            value={`R$ ${summary.entries}`}
            color="text-green-400"
          />

          <KpiCard
            title="Saídas"
            value={`R$ ${summary.exits}`}
            color="text-red-400"
          />

          <KpiCard
            title="Saldo"
            value={`R$ ${summary.balance}`}
          />

          <KpiCard
            title="Vendas"
            value={`R$ ${summary.totalSales}`}
            color="text-blue-400"
          />

          <KpiCard
            title="Pedidos"
            value={summary.totalOrders}
            color="text-yellow-400"
          />

          <KpiCard
            title="Ticket Médio"
            value={`R$ ${summary.ticketAverage}`}
            color="text-purple-400"
          />

        </div>

        <SalesChart />

      </section>

    </main>
  );
}