"use client";

import { api } from "@/services/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Pencil, Trash2, X, Package, Plus, ImageIcon } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);

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
      await api.post("/products", formData);
      toast.success("Produto criado");
      setForm(emptyForm);
      setImage(null);
      setShowForm(false);
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
      await api.patch(`/products/${editProduct.id}`, formData);
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
    if (!confirm(`Excluir "${product.name}"?`)) return;
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
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-2.5 rounded-xl">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Produtos</h1>
                <p className="text-gray-400 text-sm">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition"
            >
              <Plus size={16} />
              Novo produto
            </button>
          </div>

          {/* Form de criação */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">Novo produto</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Código de barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900">
                  <option value="">Categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="Preço de custo" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Margem de lucro %" value={form.profitMargin} onChange={(e) => setForm({ ...form, profitMargin: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <button onClick={calculateSalePrice} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">Calcular preço de venda</button>
                <input placeholder="Valor de venda *" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Tamanho" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Peso" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <label className="border border-dashed border-gray-300 hover:border-orange-400 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer flex items-center gap-2 transition">
                  <ImageIcon size={16} />
                  {image ? image.name : "Selecionar imagem"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0])} />
                </label>
                <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border border-gray-200 focus:border-orange-400 px-4 py-3 rounded-xl outline-none text-sm text-gray-900 md:col-span-3 resize-none" rows={3} />
              </div>
              <button onClick={createProduct} className="bg-orange-500 hover:bg-orange-600 text-white px-7 py-3 rounded-xl font-bold text-sm mt-5 transition">
                Criar Produto
              </button>
            </div>
          )}

          {/* Grid de produtos */}
          {products.length === 0 ? (
            <div className="text-center text-gray-400 py-20">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              Nenhum produto cadastrado
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative h-44 bg-gray-100">
                    <img
                      src={product.imageUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80"}
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80"; }}
                      className="w-full h-full object-cover"
                      alt={product.name}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => openEdit(product)}
                        className="bg-white/90 hover:bg-white shadow p-1.5 rounded-lg transition"
                        title="Editar"
                      >
                        <Pencil size={13} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product)}
                        className="bg-white/90 hover:bg-red-50 shadow p-1.5 rounded-lg transition"
                        title="Excluir"
                      >
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                    </div>
                    {product.category?.name && (
                      <span className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {product.category.name}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</h2>
                    {product.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-orange-500 text-lg font-black">
                        R$ {Number(product.salePrice).toFixed(2)}
                      </p>
                      {product.sku && <span className="text-gray-300 text-xs">{product.sku}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de edição */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-gray-900">Editar Produto</h2>
              <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Valor de Venda *</label>
                  <input
                    type="number" step="0.01"
                    value={editForm.salePrice}
                    onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                    className="w-full border border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Custo</label>
                  <input
                    type="number" step="0.01"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    className="w-full border border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full border border-gray-200 focus:border-orange-400 rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Trocar imagem</label>
                {editProduct.imageUrl && !editImage && (
                  <img src={editProduct.imageUrl} alt="atual" className="w-16 h-16 object-cover rounded-xl mb-2" />
                )}
                {editImage && (
                  <img src={URL.createObjectURL(editImage)} alt="nova" className="w-16 h-16 object-cover rounded-xl mb-2 ring-2 ring-orange-400" />
                )}
                <label className="block border border-dashed border-gray-300 hover:border-orange-400 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer flex items-center gap-2 transition">
                  <ImageIcon size={16} />
                  {editImage ? editImage.name : "Selecionar nova imagem"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditImage(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditProduct(null)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 transition py-3 rounded-xl font-semibold text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition py-3 rounded-xl font-bold text-sm text-white"
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
