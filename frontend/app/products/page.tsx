"use client";

import { api } from "@/services/api";

import { useEffect, useState } from "react";

import toast from "react-hot-toast";

import {
  RoleGuard,
} from "@/components/role-guard";

export default function ProductsPage() {

  const [products, setProducts] =
    useState<any[]>([]);

  const [categories, setCategories] =
    useState<any[]>([]);

  const [form, setForm] =
    useState<any>({
      name: "",
      description: "",
      imageUrl: "",
      costPrice: "",
      profitMargin: "",
      salePrice: "",
      unit: "",
      size: "",
      weight: "",
      sku: "",
      barcode: "",
      categoryId: "",
    });

  const [image, setImage] =
    useState<any>(null);

  async function fetchProducts() {

    try {

      const response =
        await api.get(
          "/products",
        );

      setProducts(
        response.data,
      );

    } catch {

      toast.error(
        "Erro ao carregar produtos",
      );
    }
  }

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

    fetchProducts();

    fetchCategories();

  }, []);

  function calculateSalePrice() {

    const cost =
      Number(form.costPrice);

    const margin =
      Number(form.profitMargin);

    const result =
      cost +
      (cost * margin) / 100;

    setForm({
      ...form,
      salePrice:
        result.toFixed(2),
    });
  }

  async function createProduct() {

    try {

      const user =
        JSON.parse(
          localStorage.getItem(
            "user",
          ) || "{}",
        );

      const formData =
        new FormData();

      Object.keys(form).forEach(
        (key) => {

          formData.append(
            key,
            form[key],
          );
        },
      );

      formData.append(
        "companyId",
        user.companyId,
      );

      if (image) {

        formData.append(
          "image",
          image,
        );
      }

      await api.post(
        "/products",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        },
      );

      toast.success(
        "Produto criado",
      );

      setForm({
        name: "",
        description: "",
        imageUrl: "",
        costPrice: "",
        profitMargin: "",
        salePrice: "",
        unit: "",
        size: "",
        weight: "",
        sku: "",
        barcode: "",
        categoryId: "",
      });

      setImage(null);

      fetchProducts();

    } catch {

      toast.error(
        "Erro ao criar produto",
      );
    }
  }

  return (

    <RoleGuard
      allowedRoles={[
        "SUPER_ADMIN",
        "ADMIN",
        "MANAGER",
      ]}
    >

      <main className="min-h-screen bg-slate-950 text-white p-8">

        <div className="max-w-7xl mx-auto">

          <h1 className="text-5xl font-bold mb-10">
            Produtos ERP
          </h1>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-10">

            <div className="grid md:grid-cols-3 gap-4">

              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="SKU"
                value={form.sku}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sku:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="Código barras"
                value={form.barcode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    barcode:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoryId:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              >

                <option value="">
                  Categoria
                </option>

                {categories.map(
                  (category) => (

                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>

                  ),
                )}

              </select>

              <input
                placeholder="Preço custo"
                value={form.costPrice}
                onChange={(e) =>
                  setForm({
                    ...form,
                    costPrice:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="Margem lucro %"
                value={form.profitMargin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    profitMargin:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <button
                onClick={
                  calculateSalePrice
                }
                className="bg-green-500 rounded-2xl font-bold"
              >
                Calcular Venda
              </button>

              <input
                placeholder="Valor venda"
                value={form.salePrice}
                onChange={(e) =>
                  setForm({
                    ...form,
                    salePrice:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="Unidade"
                value={form.unit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unit:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="Tamanho"
                value={form.size}
                onChange={(e) =>
                  setForm({
                    ...form,
                    size:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                placeholder="Peso"
                value={form.weight}
                onChange={(e) =>
                  setForm({
                    ...form,
                    weight:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <input
                type="file"
                onChange={(e) =>
                  setImage(
                    e.target.files?.[0],
                  )
                }
                className="bg-slate-800 p-4 rounded-2xl"
              />

              <textarea
                placeholder="Descrição"
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description:
                      e.target.value,
                  })
                }
                className="bg-slate-800 p-4 rounded-2xl md:col-span-3"
              />

            </div>

            <button
              onClick={createProduct}
              className="bg-green-500 px-6 py-4 rounded-2xl font-bold mt-6"
            >
              Criar Produto
            </button>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            {products.map((product) => (

              <div
                key={product.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden"
              >

                <img
                  src={
                    product.imageUrl ||
                    "https://images.unsplash.com/photo-1513104890138-7c749659a591"
                  }
                  className="w-full h-48 object-cover"
                />

                <div className="p-4">

                  <h2 className="text-2xl font-bold">
                    {product.name}
                  </h2>

                  <p className="text-slate-400 mt-2">
                    {product.description}
                  </p>

                  <div className="mt-4 space-y-1 text-sm">

                    <p>
                      SKU:
                      {" "}
                      {product.sku}
                    </p>

                    <p>
                      Código:
                      {" "}
                      {product.barcode}
                    </p>

                    <p>
                      Categoria:
                      {" "}
                      {
                        product
                          ?.category
                          ?.name
                      }
                    </p>

                    <p>
                      Unidade:
                      {" "}
                      {product.unit}
                    </p>

                    <p>
                      Tamanho:
                      {" "}
                      {product.size}
                    </p>

                    <p>
                      Peso:
                      {" "}
                      {product.weight}
                    </p>

                  </div>

                  <p className="text-green-400 text-2xl font-bold mt-4">
                    R$
                    {" "}
                    {product.salePrice}
                  </p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </main>

    </RoleGuard>
  );
}