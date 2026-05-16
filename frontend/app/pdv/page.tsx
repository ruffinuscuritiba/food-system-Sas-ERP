"use client";
import { apiBaseUrl } from "@/services/env";

import {
  useEffect,
  useState,
} from "react";

export default function PDVPage() {

  const [cash, setCash] =
    useState<any>(null);

  const [value, setValue] =
    useState("");

  const [type, setType] =
    useState("SUPPLY");

  async function loadCash() {

    try {

      const response =
        await fetch(
          `${apiBaseUrl}/cash/current`,
        );

      const data =
        await response.json();

      setCash(data);

    } catch (error) {

      console.log(error);
    }
  }

  useEffect(() => {

    loadCash();

  }, []);

  async function openCash() {

    await fetch(
      `${apiBaseUrl}/cash/open`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          openingValue: 100,
        }),
      },
    );

    loadCash();
  }

  async function movement() {

    await fetch(
      `${apiBaseUrl}/cash/movement`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          type,
          value:
            Number(value),
        }),
      },
    );

    setValue("");

    loadCash();
  }

  async function closeCash() {

    await fetch(
      `${apiBaseUrl}/cash/close`,
      {
        method: "PATCH",
      },
    );

    loadCash();
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-10">

          <h1 className="text-5xl font-bold">
            PDV / Caixa
          </h1>

          {!cash?.isOpen ? (

            <button
              onClick={openCash}
              className="bg-green-500 px-6 py-3 rounded-2xl font-bold"
            >
              Abrir Caixa
            </button>

          ) : (

            <button
              onClick={closeCash}
              className="bg-red-500 px-6 py-3 rounded-2xl font-bold"
            >
              Fechar Caixa
            </button>

          )}

        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">

          <div className="bg-slate-900 rounded-3xl p-6">

            <p className="text-slate-400">
              Status
            </p>

            <h2 className="text-3xl font-bold mt-2">

              {
                cash?.isOpen

                  ? "🟢 ABERTO"

                  : "🔴 FECHADO"
              }

            </h2>

          </div>

          <div className="bg-slate-900 rounded-3xl p-6">

            <p className="text-slate-400">
              Saldo Atual
            </p>

            <h2 className="text-3xl font-bold mt-2 text-green-400">

              R$ {cash?.balance || 0}

            </h2>

          </div>

          <div className="bg-slate-900 rounded-3xl p-6">

            <p className="text-slate-400">
              Entradas
            </p>

            <h2 className="text-3xl font-bold mt-2 text-blue-400">

              R$ {cash?.entries || 0}

            </h2>

          </div>

          <div className="bg-slate-900 rounded-3xl p-6">

            <p className="text-slate-400">
              Saídas
            </p>

            <h2 className="text-3xl font-bold mt-2 text-red-400">

              R$ {cash?.exits || 0}

            </h2>

          </div>

        </div>

        {cash?.isOpen && (

          <div className="bg-slate-900 rounded-3xl p-8">

            <h2 className="text-3xl font-bold mb-8">
              Movimentação
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <select
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value,
                  )
                }
                className="bg-slate-800 p-4 rounded-2xl"
              >

                <option value="SUPPLY">
                  Reforço
                </option>

                <option value="WITHDRAW">
                  Sangria
                </option>

              </select>

              <input
                type="number"
                placeholder="Valor"

                value={value}

                onChange={(e) =>
                  setValue(
                    e.target.value,
                  )
                }

                className="bg-slate-800 p-4 rounded-2xl"
              />

              <button
                onClick={movement}
                className="bg-green-500 rounded-2xl font-bold"
              >
                Confirmar
              </button>

            </div>

          </div>

        )}

      </div>

    </main>
  );
}