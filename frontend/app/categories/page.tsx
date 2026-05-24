"use client";

import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import { api } from "@/services/api";

export default function CategoriesPage() {

  const [categories, setCategories] =
    useState<any[]>([]);

  const [name, setName] =
    useState("");

  async function fetchCategories() {

    try {

      const user =
        JSON.parse(
          localStorage.getItem(
            "user",
          ) || "{}",
        );

      const response =
        await api.get(
          `/categories`,
        );

      setCategories(
        response.data,
      );

    } catch {

      toast.error(
        "Erro ao carregar categorias",
      );
    }
  }

  useEffect(() => {

    fetchCategories();

  }, []);

  async function createCategory() {

    try {

      if (!name) {

        toast.error(
          "Digite o nome",
        );

        return;
      }

      const user =
        JSON.parse(
          localStorage.getItem(
            "user",
          ) || "{}",
        );

      await api.post(
        "/categories",
        {
          name,
          companyId:
            user.companyId,
        },
      );

      toast.success(
        "Categoria criada",
      );

      setName("");

      fetchCategories();

    } catch {

      toast.error(
        "Erro ao criar categoria",
      );
    }
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-5xl font-bold mb-10">
          Categorias
        </h1>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-10">

          <div className="flex gap-4">

            <input
              placeholder="Nome categoria"
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value,
                )
              }
              className="flex-1 bg-slate-800 p-4 rounded-2xl"
            />

            <button
              onClick={
                createCategory
              }
              className="bg-green-500 px-6 rounded-2xl font-bold"
            >
              Criar
            </button>

          </div>

        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {categories.map(
            (category) => (

              <div
                key={category.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6"
              >

                <h2 className="text-2xl font-bold">
                  {category.name}
                </h2>

              </div>

            ),
          )}

        </div>

      </div>

    </main>
  );
}