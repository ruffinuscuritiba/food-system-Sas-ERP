"use client";

import { api } from "@/services/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Pencil, Trash2, X } from "lucide-react";

const emptyForm = {
  name: "", description: "", imageUrl: "", costPrice: "",
  profitMargin: "", salePrice: "", unit: "", size: "",
  weight: "", sku: "", barcode: "", categoryId: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [image, setImage] = useState<any>(null);

  // Edit state
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", salePrice: "", costPrice: "", categoryId: "" });
  const [editImage, setEditImage] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function fetchProducts() {
    try {
      const response = await api.get("/products");
      setProducts(response.data);
    } catch {
      toast.error("Erro ao carregar produtos");
    }
  }

  async function fetchCategories() {
    try {
      const response = await api.get("/categories");
      setCategories(response.data);
    } catch {
      toast.error("Erro ao carregar categorias");
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  function calculateSalePrice() {
    const cost = Number(form.costPrice);
    const margin = Number(form.profitMargin);
    const result = cost + (cost * margin) / 100;
    setForm({ ...form, salePrice: result.toFixed(2) });
  }

  async function createProduct() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const formData = new FormData();
      Object.keys(form).forEach((key) => { formData.append(key, form[key]); });
      formData.append("companyId", user.companyId);
      if (image) formData.append("image", image);

      await api.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Produto criado");
      setForm(emptyForm);
      setImage(null);
      fetchProducts();
    } catch {
      toast.error("Erro ao criar produto");
    }
  }

  function openEdit(product: any) {
    setEditProduct(product);
    setEditForm({
      name: product.name || "",
      description: product.description || "",
      salePrice: product.salePrice ? String(product.salePrice) : "",
      costPrice: product.costPrice ? String(product.costPrice) : "",
      categoryId: product.categoryId || "",
    });
    setEditImage(null);
  }

  async function saveEdit() {
    if (!editProduct) return;
    if (!editForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!editForm.salePrice || isNaN(Number(editForm.salePrice))) { toast.error("Valor de venda inválido"); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name.trim());
      formData.append("description", editForm.description);
      formData.append("salePrice", editForm.salePrice);
      formData.append("costPrice", editForm.costPrice);
      if (editForm.categoryId) formData.append("categoryId", editForm.categoryId);
      if (editImage) formData.append("image", editImage);

      await api.patch(`/products/${editProduct.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Produto atualizado");
      setEditProduct(null);
      fetchProducts();
    } catch {
      toast.error("Erro ao atualizar produto");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: any) {
    if (!confirm(`Excluir "${product.name}"? O produto será desativado.`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      toast.success("Produto excluído");
      fetchProducts();
    } catch {
      toast.error("Erro ao excluir produto");
    }
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}>
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold mb-10">Produtos ERP</h1>

          {/* Form de criação */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-10">
            <div className="grid md:grid-cols-3 gap-4">
              <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="Código barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="bg-slate-800 p-4 rounded-2xl">
                <option value="">Categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Preço custo" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="Margem lucro %" value={form.profitMargin} onChange={(e) => setForm({ ...form, profitMargin: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <button onClick={calculateSalePrice} className="bg-green-500 rounded-2xl font-bold">Calcular Venda</button>
              <input placeholder="Valor venda" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="Tamanho" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input placeholder="Peso" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="bg-slate-800 p-4 rounded-2xl" />
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])} className="bg-slate-800 p-4 rounded-2xl" />
              <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-800 p-4 rounded-2xl md:col-span-3" />
            </div>
            <button onClick={createProduct} className="bg-green-500 px-6 py-4 rounded-2xl font-bold mt-6">Criar Produto</button>
          </div>

          {/* Grid de produtos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="relative h-48 bg-slate-800">
                  <img
                    src={product.imageUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591"}
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1513104890138-7c749659a591"; }}
                    className="w-full h-full object-cover"
                    alt={product.name}
                  />
                  {/* Botões sobre a imagem */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => openEdit(product)}
                      className="bg-black/60 hover:bg-blue-600 transition p-1.5 rounded-lg"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteProduct(product)}
                      className="bg-black/60 hover:bg-red-600 transition p-1.5 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-2xl font-bold">{product.name}</h2>
                  <p className="text-slate-400 mt-2 text-sm">{product.description}</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    {product.sku && <p>SKU: {product.sku}</p>}
                    {product.category?.name && <p>Categoria: {product.category.name}</p>}
                    {product.unit && <p>Unidade: {product.unit}</p>}
                  </div>
                  <p className="text-green-400 text-2xl font-bold mt-4">
                    R$ {Number(product.salePrice).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal de edição */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Editar Produto</h2>
              <button onClick={() => setEditProduct(null)} className="text-slate-400 hover:text-white transition">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome *</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valor de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.salePrice}
                    onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Categoria</label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Trocar imagem (opcional)</label>
                {editProduct.imageUrl && !editImage && (
                  <img src={editProduct.imageUrl} alt="atual" className="w-20 h-20 object-cover rounded-xl mb-2" />
                )}
                {editImage && (
                  <img src={URL.createObjectURL(editImage)} alt="nova" className="w-20 h-20 object-cover rounded-xl mb-2 ring-2 ring-green-500" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditImage(e.target.files?.[0] || null)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditProduct(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 transition py-3 rounded-xl font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 transition py-3 rounded-xl font-bold"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
