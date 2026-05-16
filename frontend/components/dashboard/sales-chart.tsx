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

const data = [
  {
    name: "Seg",
    vendas: 400,
  },

  {
    name: "Ter",
    vendas: 700,
  },

  {
    name: "Qua",
    vendas: 500,
  },

  {
    name: "Qui",
    vendas: 900,
  },

  {
    name: "Sex",
    vendas: 1200,
  },

  {
    name: "Sab",
    vendas: 1800,
  },

  {
    name: "Dom",
    vendas: 1400,
  },
];

export function SalesChart() {

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {

    setMounted(true);

  }, []);

  if (!mounted) {

    return null;
  }

  return (

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full">

      <h3 className="text-2xl font-bold mb-6 text-white">
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

          <LineChart data={data}>

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