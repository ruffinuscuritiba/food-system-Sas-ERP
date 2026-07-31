"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import {
  useEffect,
  useState,
} from "react";

type SalesChartPoint = { name: string; vendas: number };

// Placeholder — só usado se o componente for montado sem prop `data`
// (nunca deve acontecer em `/`, que sempre passa a série real vinda de
// GET /orders/dashboard).
const FALLBACK_DATA: SalesChartPoint[] = [
  { name: "Seg", vendas: 0 },
  { name: "Ter", vendas: 0 },
  { name: "Qua", vendas: 0 },
  { name: "Qui", vendas: 0 },
  { name: "Sex", vendas: 0 },
  { name: "Sab", vendas: 0 },
  { name: "Dom", vendas: 0 },
];

export function SalesChart({ data }: { data?: SalesChartPoint[] }) {

  const chartData = data && data.length > 0 ? data : FALLBACK_DATA;

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {

    setMounted(true);

  }, []);

  if (!mounted) {

    return null;
  }

  return (

    <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full shadow-sm">

      <h3 className="text-2xl font-bold mb-6 text-gray-900">
        Fluxo de Caixa
      </h3>

      <div
        style={{
          width: "100%",
          height: 350,
        }}
      >

        <ResponsiveContainer
  width={800}
  height={350}
>

          <LineChart data={chartData}>

            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="vendas"
              stroke="#22c55e"
              strokeWidth={4}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}