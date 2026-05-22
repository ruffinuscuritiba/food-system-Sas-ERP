"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function DashboardPage() {

  const [data, setData] =
    useState<any>(null);

  const companyId =
    "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  useEffect(() => {

    loadDashboard();

  }, []);

  async function loadDashboard() {

    const response =
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://food-system-backend-no7d.onrender.com"}/orders/dashboard`,
      );

    const dashboard =
      await response.json();

    setData(dashboard);
  }

  if (!data) {

    return (

      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        Carregando...

      </div>
    );
  }

  const rankingData =
    data.ranking.map(
      (item: any) => ({

        name:
          item.productName,

        lucro:
          item._sum.profit || 0,
      }),
    );

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="mb-10">

        <h1 className="text-5xl font-bold">
          Dashboard Executivo
        </h1>

        <p className="text-slate-400 mt-2">
          Inteligência operacional gastronômica
        </p>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <p className="text-slate-400">
            Faturamento
          </p>

          <h2 className="text-4xl font-bold mt-3 text-green-400">

            R$ {data.revenue.toFixed(2)}

          </h2>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <p className="text-slate-400">
            Lucro Real
          </p>

          <h2 className="text-4xl font-bold mt-3 text-blue-400">

            R$ {data.profit.toFixed(2)}

          </h2>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <p className="text-slate-400">
            CMV
          </p>

          <h2 className="text-4xl font-bold mt-3 text-yellow-400">

            R$ {data.cmv.toFixed(2)}

          </h2>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <p className="text-slate-400">
            Food Cost
          </p>

          <h2 className="text-4xl font-bold mt-3 text-red-400">

            {data.foodCost.toFixed(1)}%

          </h2>

        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <h2 className="text-2xl font-bold mb-6">
            Produto Mais Lucrativo
          </h2>

          <div className="text-4xl font-bold text-green-400">

            {data.bestProduct?.productName || "-"}

          </div>

          <p className="text-slate-400 mt-4">

            Lucro:
            {" "}

            R$
            {" "}

            {
              data.bestProduct?._sum
                ?.profit?.toFixed(2)
            }

          </p>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">

          <h2 className="text-2xl font-bold mb-6">
            Produto Pior Margem
          </h2>

          <div className="text-4xl font-bold text-red-400">

            {data.worstProduct?.productName || "-"}

          </div>

          <p className="text-slate-400 mt-4">

            Lucro:
            {" "}

            R$
            {" "}

            {
              data.worstProduct?._sum
                ?.profit?.toFixed(2)
            }

          </p>

        </div>

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">

        <h2 className="text-3xl font-bold mb-8">
          Ranking Lucro Produtos
        </h2>

        <div className="h-[500px]">

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={rankingData}
            >

              <XAxis dataKey="name" />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="lucro"
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </div>

    </main>
  );
}