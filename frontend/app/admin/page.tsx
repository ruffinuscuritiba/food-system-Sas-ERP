"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import ImageUpload from "@/components/ImageUpload";
import { api } from "@/services/api";

type ProductForm = {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  sku: string;
  barcode: string;
  costPrice: string;
  profitMargin: string;
  salePrice: string;
  unit: string;
};

const initialForm: ProductForm = {
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  sku: "",
  barcode: "",
  costPrice: "",
  profitMargin: "",
  salePrice: "",
  unit: "UN",
};

export default function AdminPage() {
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [loading, setLoading] = useState(false);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function createProduct() {
    if (!form.name || !form.costPrice || !form.salePrice) {
      toast.error("Informe nome, preço de custo e preço de venda.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/products", {
        ...form,
        costPrice: Number(form.costPrice),
        profitMargin: Number(form.profitMargin || 0),
        salePrice: Number(form.salePrice),
        categoryId: form.categoryId || undefined,
      });

      toast.success("Produto criado com sucesso.");
      setForm(initialForm);
    } catch {
      toast.error("Erro ao criar produto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 shadow-xl">
        <h1 className="mb-2 text-4xl font-bold">Painel administrativo</h1>
        <p className="mb-8 text-gray-600">
          Cadastro rápido de produtos para ajustes administrativos.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <input
            name="name"
            placeholder="Nome do produto"
            value={form.name}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="categoryId"
            placeholder="ID da categoria"
            value={form.categoryId}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="sku"
            placeholder="SKU"
            value={form.sku}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="barcode"
            placeholder="Código de barras"
            value={form.barcode}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="unit"
            placeholder="Unidade"
            value={form.unit}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="costPrice"
            type="number"
            placeholder="Preço de custo"
            value={form.costPrice}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="profitMargin"
            type="number"
            placeholder="Margem de lucro (%)"
            value={form.profitMargin}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />

          <input
            name="salePrice"
            type="number"
            placeholder="Preço de venda"
            value={form.salePrice}
            onChange={handleChange}
            className="rounded-2xl border p-4"
          />
        </div>

        <div className="mt-5">
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) =>
              setForm((current) => ({
                ...current,
                imageUrl: url,
              }))
            }
          />
        </div>

        <textarea
          name="description"
          placeholder="Descrição do produto"
          value={form.description}
          onChange={handleChange}
          className="mt-5 h-32 w-full rounded-2xl border p-4"
        />

        <button
          type="button"
          onClick={createProduct}
          disabled={loading}
          className="mt-8 rounded-2xl bg-green-600 px-8 py-4 font-bold text-white disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Cadastrar produto"}
        </button>
      </div>
    </main>
  );
}
