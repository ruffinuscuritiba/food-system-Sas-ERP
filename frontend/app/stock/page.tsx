"use client";
import { apiBaseUrl } from "@/services/env";

import { useEffect, useState } from "react";

export default function StockPage() {

  const [movements, setMovements] =
    useState<any[]>([]);

  const companyId =
    "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  useEffect(() => {

    loadMovements();

  }, []);

  async function loadMovements() {

    const response =
      await fetch(
        `${apiBaseUrl}/stock/${companyId}/movements`,
      );

    const data =
      await response.json();

    setMovements(data);
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="mb-10">

        <h1 className="text-4xl font-bold">
          Movimentações Estoque
        </h1>

        <p className="text-slate-400 mt-2">
          Auditoria operacional estoque
        </p>

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-slate-800">

            <tr>

              <th className="text-left p-4">
                Ingrediente
              </th>

              <th className="text-left p-4">
                Tipo
              </th>

              <th className="text-left p-4">
                Quantidade
              </th>

              <th className="text-left p-4">
                Estoque Antes
              </th>

              <th className="text-left p-4">
                Estoque Atual
              </th>

              <th className="text-left p-4">
                Motivo
              </th>

              <th className="text-left p-4">
                Data
              </th>

            </tr>

          </thead>

          <tbody>

            {movements.map((movement) => (

              <tr
                key={movement.id}
                className="border-t border-slate-800"
              >

                <td className="p-4">
                  {movement.ingredient?.name}
                </td>

                <td className="p-4">

                  <span
                    className={`
                      px-3 py-1 rounded-full text-xs font-bold

                      ${
                        movement.type === "ENTRY"
                          ? "bg-green-500/20 text-green-400"

                        : movement.type === "LOSS"
                          ? "bg-red-500/20 text-red-400"

                        : movement.type === "EXIT"
                          ? "bg-yellow-500/20 text-yellow-400"

                        : "bg-blue-500/20 text-blue-400"
                      }
                    `}
                  >

                    {movement.type}

                  </span>

                </td>

                <td className="p-4">
                  {movement.quantity}
                </td>

                <td className="p-4">
                  {movement.previousStock}
                </td>

                <td className="p-4">
                  {movement.currentStock}
                </td>

                <td className="p-4">
                  {movement.reason}
                </td>

                <td className="p-4 text-slate-400">

                  {new Date(
                    movement.createdAt,
                  ).toLocaleString("pt-BR")}

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}