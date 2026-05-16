"use client";
import { apiBaseUrl } from "@/services/env";

import { useEffect, useState } from "react";

export default function RecipesPage() {

  const [products, setProducts] =
    useState<any[]>([]);

  const [ingredients, setIngredients] =
    useState<any[]>([]);

  const [selectedProduct, setSelectedProduct] =
    useState("");

  const [items, setItems] =
    useState<any[]>([]);

  const companyId =
    "1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a";

  useEffect(() => {

    loadData();

  }, []);

  async function loadData() {

    const productsRes =
      await fetch(
        `${apiBaseUrl}/products`,
      );

    const productsData =
      await productsRes.json();

    setProducts(productsData);

    const ingredientsRes =
      await fetch(
        `${apiBaseUrl}/ingredients/${companyId}`,
      );

    const ingredientsData =
      await ingredientsRes.json();

    setIngredients(
      ingredientsData,
    );
  }

  function addItem() {

    setItems([
      ...items,

      {
        ingredientId: "",

        quantity: "",
      },
    ]);
  }

  function updateItem(
    index: number,
    field: string,
    value: string,
  ) {

    const updated =
      [...items];

    updated[index][field] =
      value;

    setItems(updated);
  }

  async function saveRecipe() {

    await fetch(
      `${apiBaseUrl}/recipes`,
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          productId:
            selectedProduct,

          items,
        }),
      },
    );

    alert(
      "Receita cadastrada",
    );
  }

  const totalCost =
    items.reduce(
      (
        total,
        item,
      ) => {

        const ingredient =
          ingredients.find(
            (i) =>
              i.id ===
              item.ingredientId,
          );

        if (!ingredient)
          return total;

        return (
          total +
          ingredient.cost *
            Number(
              item.quantity,
            )
        );
      },

      0,
    );

  return (

    <main className="min-h-screen bg-slate-950 text-white p-8">

      <div className="mb-10">

        <h1 className="text-4xl font-bold">
          Ficha Técnica
        </h1>

        <p className="text-slate-400 mt-2">
          Engenharia de cardápio
        </p>

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">

        <select
          value={selectedProduct}
          onChange={(e) =>
            setSelectedProduct(
              e.target.value,
            )
          }
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6"
        >

          <option value="">
            Selecione produto
          </option>

          {products.map(
            (product) => (

              <option
                key={product.id}
                value={product.id}
              >

                {product.name}

              </option>
            ),
          )}
        </select>

        <button
          onClick={addItem}
          className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-xl font-bold mb-8"
        >
          Adicionar Ingrediente
        </button>

        <div className="space-y-4">

          {items.map(
            (
              item,
              index,
            ) => (

              <div
                key={index}
                className="grid grid-cols-2 gap-4"
              >

                <select
                  value={
                    item.ingredientId
                  }
                  onChange={(e) =>
                    updateItem(
                      index,
                      "ingredientId",
                      e.target.value,
                    )
                  }
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4"
                >

                  <option value="">
                    Ingrediente
                  </option>

                  {ingredients.map(
                    (
                      ingredient,
                    ) => (

                      <option
                        key={
                          ingredient.id
                        }
                        value={
                          ingredient.id
                        }
                      >

                        {
                          ingredient.name
                        }

                      </option>
                    ),
                  )}
                </select>

                <input
                  placeholder="Quantidade"
                  value={
                    item.quantity
                  }
                  onChange={(e) =>
                    updateItem(
                      index,
                      "quantity",
                      e.target.value,
                    )
                  }
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4"
                />

              </div>
            ),
          )}

        </div>

        <div className="mt-10">

          <h2 className="text-2xl font-bold">

            CMV Receita:
            {" "}
            <span className="text-green-400">

              R$ {totalCost.toFixed(2)}

            </span>

          </h2>

        </div>

        <button
          onClick={saveRecipe}
          className="mt-8 bg-green-500 hover:bg-green-600 px-8 py-4 rounded-xl font-bold"
        >
          Salvar Receita
        </button>

      </div>

    </main>
  );
}