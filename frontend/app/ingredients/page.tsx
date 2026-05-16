"use client";
import { apiBaseUrl } from "@/services/env";

import { useEffect, useState } from "react";

export default function IngredientsPage() {

  const [ingredients, setIngredients] =
    useState<any[]>([]);

  const [form, setForm] =
    useState({

      name: "",

      stock: "",

      minimumStock: "",

      unit: "",

      cost: "",
    });

  const companyId =
    "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  useEffect(() => {

    loadIngredients();

  }, []);

  async function loadIngredients() {

    const response =
      await fetch(
        `${apiBaseUrl}/ingredients/${companyId}`,
      );

    const data =
      await response.json();

    setIngredients(data);
  }

  async function createIngredient() {

    await fetch(
      `${apiBaseUrl}/ingredients`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          ...form,

          companyId,
        }),
      },
    );

    setForm({

      name: "",

      stock: "",

      minimumStock: "",

      unit: "",

      cost: "",
    });

    loadIngredients();
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="mb-10">

        <h1 className="text-4xl font-bold">
          Ingredientes
        </h1>

        <p className="text-slate-400 mt-2">
          Gestão operacional ingredientes
        </p>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">

        <input
          placeholder="Nome"
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl p-3"
        />

        <input
          placeholder="Estoque"
          value={form.stock}
          onChange={(e) =>
            setForm({
              ...form,
              stock: e.target.value,
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl p-3"
        />

        <input
          placeholder="Estoque mínimo"
          value={form.minimumStock}
          onChange={(e) =>
            setForm({
              ...form,
              minimumStock: e.target.value,
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl p-3"
        />

        <input
          placeholder="Unidade"
          value={form.unit}
          onChange={(e) =>
            setForm({
              ...form,
              unit: e.target.value,
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl p-3"
        />

        <input
          placeholder="Custo"
          value={form.cost}
          onChange={(e) =>
            setForm({
              ...form,
              cost: e.target.value,
            })
          }
          className="bg-slate-900 border border-slate-700 rounded-xl p-3"
        />

      </div>

      <button
        onClick={createIngredient}
        className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl font-bold mb-10"
      >
        Cadastrar Ingrediente
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        <table className="w-full">

          <thead className="bg-slate-800">

            <tr>

              <th className="text-left p-4">
                Nome
              </th>

              <th className="text-left p-4">
                Estoque
              </th>

              <th className="text-left p-4">
                Estoque Mínimo
              </th>

              <th className="text-left p-4">
                Unidade
              </th>

              <th className="text-left p-4">
                Custo
              </th>

            </tr>

          </thead>

          <tbody>

            {ingredients.map((ingredient) => (

              <tr
                key={ingredient.id}
                className="border-t border-slate-800"
              >

                <td className="p-4">
                  {ingredient.name}
                </td>

                <td className="p-4">
                  {ingredient.stock}
                </td>

                <td className="p-4">

                  <span
                    className={
                      ingredient.stock <=
                      ingredient.minimumStock

                        ? "text-red-400 font-bold"

                        : ""
                    }
                  >

                    {ingredient.minimumStock}

                  </span>

                </td>

                <td className="p-4">
                  {ingredient.unit}
                </td>

                <td className="p-4">
                  R$ {ingredient.cost}
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}