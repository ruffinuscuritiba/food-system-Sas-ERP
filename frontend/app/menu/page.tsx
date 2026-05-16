"use client";
import { apiBaseUrl } from "@/services/env";

import { useEffect, useState } from "react";
import axios from "axios";

export default function MenuPage() {

  const [products, setProducts] =
    useState<any[]>([]);

  useEffect(() => {

    loadProducts();

  }, []);

  async function loadProducts() {

    try {

      const response =
        await axios.get(
          `${apiBaseUrl}/products/public/menu/1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a`,
        );

      setProducts(
        response.data,
      );

    } catch (error) {

      console.log(error);
    }
  }

  return (

    <main className="min-h-screen bg-slate-950 p-10">

      <h1 className="text-white text-5xl font-bold mb-10">

        Cardápio

      </h1>

      <div className="grid grid-cols-3 gap-6">

        {products.map((product) => (

          <div
            key={product.id}
            className="bg-white rounded-3xl overflow-hidden"
          >

            <img
              src={
                product.imageUrl ||
                "https://images.unsplash.com/photo-1513104890138-7c749659a591"
              }
              className="w-full h-52 object-cover"
            />

            <div className="p-6">

              <h2 className="text-2xl font-bold text-black">

                {product.name}

              </h2>

              <p className="text-gray-500 mt-2">

                {product.description}

              </p>

              <button
                onClick={() => {

                  alert(product.name);

                }}
                className="mt-6 w-full bg-black text-white py-4 rounded-2xl"
              >

                Adicionar

              </button>

            </div>

          </div>

        ))}

      </div>

    </main>
  );
}