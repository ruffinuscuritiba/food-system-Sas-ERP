"use client";

import { api } from "@/services/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Pencil, Trash2, X, Package, Plus, ImageIcon, Pizza } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PizzaSize = "PEQUENA" | "MEDIA" | "GRANDE" | "FAMILIA";

interface SizeRow {
  size: PizzaSize;
  price: string;
}

const SIZE_LABELS: Record<PizzaSize, string> = {
  PEQUENA: "Pequena",
  MEDIA:   "Média",
  GRANDE:  "Grande",
  FAMILIA: "Família",
};

const ALL_SIZES: PizzaSize[] = ["PEQUENA", "MEDIA", "GRANDE", "FAMILIA"];

const emptySizes = (): SizeRow[] => ALL_SIZES.map((s) => ({ size: s, price: "" }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function SizesTable({
  sizes, onChange,
}: {
  sizes: SizeRow[];
  onChange: (sizes: SizeRow[]) => void;
}) {
  function setPrice(size: PizzaSize, value: string) {
    onChange(sizes.map((s) => s.size === size ? { ...s, price: value } : s));
  }

  return (
    <div className="border border-orange-100 bg-primary/5/50 rounded-xl p-4">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
        🍕 Preços por Tamanho
      </p>
      <div className="grid grid-cols-2 gap-2">
        {sizes.map((s) => (
          <div key={s.size}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{SIZE_LABELS[s.size]}</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={s.price}
                onChange={(e) => setPrice(s.size, e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 focus:border-primary rounded-lg pl-8 pr-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">Deixe em branco para não oferecer aquele tamanho.</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const emptyForm = {
  name: "", description: "", imageUrl: "", costPrice: "",
  profitMargin: "", salePrice: "", unit: "", size: "",
  weight: "", sku: "", barcode: "", categoryId: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [formSizes, setFormSizes] = useState<SizeRow[]>(emptySizes());
  const [formHasSizes, setFormHasSizes] = useState(false);
  const [image, setImage] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const [editProduct, setEditProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", salePrice: "", costPrice: "", categoryId: "" });
  const [editSizes, setEditSizes] = useState<SizeRow[]>(emptySizes());
  const [editHasSizes, setEditHasSizes] = useState(false);
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
    const cost = parseFloat(String(form.costPrice).replace(",", "."));
    const margin = parseFloat(String(form.profitMargin).replace(",", "."));
    if (isNaN(cost) || cost <= 0) { toast.error("Informe o preço de custo"); return; }
    if (isNaN(margin) || margin < 0) { toast.error("Informe a margem de lucro (%)"); return; }
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
      if (formHasSizes) {
        const filledSizes = formSizes.filter((s) => s.price !== "" && !isNaN(Number(s.price)));
        if (filledSizes.length > 0) {
          formData.append("sizes", JSON.stringify(filledSizes.map((s) => ({ size: s.size, price: Number(s.price) }))));
        }
      }
      await api.post("/products", formData);
      toast.success("Produto criado");
      setForm(emptyForm);
      setFormSizes(emptySizes());
      setFormHasSizes(false);
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
    const hasSizes = product.sizes && product.sizes.length > 0;
    setEditHasSizes(hasSizes);
    setEditSizes(ALL_SIZES.map((s) => {
      const existing = product.sizes?.find((ps: any) => ps.size === s);
      return { size: s, price: existing ? String(existing.price) : "" };
    }));
    setEditImage(null);
  }

  async function saveEdit() {
    if (!editProduct) return;
    if (!editForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!editHasSizes && (!editForm.salePrice || isNaN(Number(editForm.salePrice)))) {
      toast.error("Informe o valor de venda");
      return;
    }
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const formData = new FormData();
      formData.append("name", editForm.name.trim());
      formData.append("description", editForm.description);
      formData.append("salePrice", editForm.salePrice || "0");
      formData.append("costPrice", editForm.costPrice || "0");
      formData.append("companyId", user.companyId);
      if (editForm.categoryId) formData.append("categoryId", editForm.categoryId);
      if (editImage) formData.append("image", editImage);

      const filledSizes = editHasSizes
        ? editSizes.filter((s) => s.price !== "" && !isNaN(Number(s.price)))
        : [];
      formData.append("sizes", JSON.stringify(filledSizes.map((s) => ({ size: s.size, price: Number(s.price) }))));

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
              <div className="bg-primary p-2.5 rounded-xl">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Produtos</h1>
                <p className="text-gray-400 text-sm">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm transition"
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
                <input placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Código de barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900">
                  <option value="">Categoria</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="Preço de custo" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Margem de lucro %" value={form.profitMargin} onChange={(e) => setForm({ ...form, profitMargin: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <button onClick={calculateSalePrice} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">Calcular preço de venda</button>
                <input placeholder="Valor de venda *" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Tamanho" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <input placeholder="Peso" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900" />
                <label className="border border-dashed border-gray-300 hover:border-primary rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer flex items-center gap-2 transition">
                  <ImageIcon size={16} />
                  {image ? image.name : "Selecionar imagem"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0])} />
                </label>
                <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border border-gray-200 focus:border-primary px-4 py-3 rounded-xl outline-none text-sm text-gray-900 md:col-span-3 resize-none" rows={3} />
              </div>

              {/* Pizza sizes toggle */}
              <div className="mt-4">
                <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                  <div
                    onClick={() => setFormHasSizes((v) => !v)}
                    className={`w-10 h-5 rounded-full transition relative cursor-pointer ${formHasSizes ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${formHasSizes ? "left-5" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Pizza size={15} className="text-primary" /> Produto pizza (preço por tamanho)
                  </span>
                </label>
                {formHasSizes && (
                  <div className="mt-3">
                    <SizesTable sizes={formSizes} onChange={setFormSizes} />
                  </div>
                )}
              </div>

              <button onClick={createProduct} className="bg-primary hover:bg-primary text-white px-7 py-3 rounded-xl font-bold text-sm mt-5 transition">
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
                      <span className="absolute bottom-2 left-2 bg-primary text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {product.category.name}
                      </span>
                    )}
                    {product.sizes?.length > 0 && (
                      <span className="absolute bottom-2 right-2 bg-white/90 text-primary text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Pizza size={10} /> 4 tam.
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</h2>
                    {product.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      {product.sizes?.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {product.sizes.slice(0, 2).map((ps: any) => (
                            <span key={ps.size} className="text-xs bg-primary/5 text-primary font-bold px-1.5 py-0.5 rounded">
                              {SIZE_LABELS[ps.size as PizzaSize]}: R${Number(ps.price).toFixed(2)}
                            </span>
                          ))}
                          {product.sizes.length > 2 && (
                            <span className="text-xs text-gray-400">+{product.sizes.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-primary text-lg font-black">
                          R$ {Number(product.salePrice).toFixed(2)}
                        </p>
                      )}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-7 max-h-[90vh] overflow-y-auto">
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
                  className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-3 text-gray-900 outline-none text-sm resize-none"
                />
              </div>

              {/* Pizza sizes toggle */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer w-fit mb-3">
                  <div
                    onClick={() => setEditHasSizes((v) => !v)}
                    className={`w-10 h-5 rounded-full transition relative cursor-pointer ${editHasSizes ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editHasSizes ? "left-5" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Pizza size={15} className="text-primary" /> Preço por tamanho
                  </span>
                </label>

                {editHasSizes ? (
                  <SizesTable sizes={editSizes} onChange={setEditSizes} />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Valor de Venda *</label>
                      <input
                        type="number" step="0.01"
                        value={editForm.salePrice}
                        onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                        className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Custo</label>
                      <input
                        type="number" step="0.01"
                        value={editForm.costPrice}
                        onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                        className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full border border-gray-200 focus:border-primary rounded-xl px-4 py-3 text-gray-900 outline-none text-sm"
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
                <label className="block border border-dashed border-gray-300 hover:border-primary rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer flex items-center gap-2 transition">
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
                className="flex-1 bg-primary hover:bg-primary disabled:opacity-50 transition py-3 rounded-xl font-bold text-sm text-white"
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
