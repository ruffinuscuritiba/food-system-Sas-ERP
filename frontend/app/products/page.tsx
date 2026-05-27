"use client";

import { api } from "@/services/api";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Check, Pencil, Plus, Trash2, X, Package, ImageIcon, Pizza } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SizeRow {
  size: string;
  cost: string;
  margin: string;
  price: string;
}

const defaultSizes = (): SizeRow[] => [
  { size: "Pequena", cost: "", margin: "", price: "" },
  { size: "Média",   cost: "", margin: "", price: "" },
  { size: "Grande",  cost: "", margin: "", price: "" },
  { size: "Família", cost: "", margin: "", price: "" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function calcPrice(cost: string, margin: string): string {
  const c = parseFloat(cost);
  const m = parseFloat(margin);
  if (!isFinite(c) || c <= 0 || !isFinite(m) || m < 0) return "";
  return (c * (1 + m / 100)).toFixed(2);
}

function calcMargin(cost: string, price: string): string {
  const c = parseFloat(cost);
  const p = parseFloat(price);
  if (!isFinite(c) || c <= 0 || !isFinite(p) || p <= 0) return "";
  return (((p / c) - 1) * 100).toFixed(1);
}

function isPizzaCategory(categoryId: string, categories: any[]): boolean {
  const cat = categories.find((c) => c.id === categoryId);
  return !!cat && cat.name.toLowerCase().includes("pizza");
}

// ── input class ───────────────────────────────────────────────────────────────

const inp =
  "w-full border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 " +
  "rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none transition placeholder-gray-400";

// ── SizesTable ────────────────────────────────────────────────────────────────

function SizesTable({ sizes, onChange }: { sizes: SizeRow[]; onChange: (s: SizeRow[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  function update(index: number, patch: Partial<SizeRow>) {
    const next = sizes.map((s, i) => i === index ? { ...s, ...patch } : s);
    onChange(next);
  }

  function onCostChange(index: number, value: string) {
    const row = { ...sizes[index], cost: value };
    if (row.margin !== "") row.price = calcPrice(value, row.margin);
    update(index, { cost: value, margin: row.margin, price: row.price });
  }

  function onMarginChange(index: number, value: string) {
    const row = { ...sizes[index], margin: value };
    row.price = calcPrice(row.cost, value);
    update(index, { margin: value, price: row.price });
  }

  function onPriceChange(index: number, value: string) {
    const row = { ...sizes[index], price: value };
    row.margin = calcMargin(row.cost, value);
    update(index, { price: value, margin: row.margin });
  }

  return (
    <div className="border border-orange-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-orange-50 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
          <Pizza size={13} /> Preços por Tamanho
        </span>
        <button
          type="button"
          onClick={() => onChange([...sizes, { size: `Tamanho ${sizes.length + 1}`, cost: "", margin: "", price: "" }])}
          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-bold transition"
        >
          <Plus size={12} /> Adicionar
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_90px_80px_90px_32px] gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
        <span>Tamanho</span>
        <span>Custo R$</span>
        <span>Margem %</span>
        <span>Venda R$</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {sizes.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_80px_90px_32px] gap-2 items-center px-3 py-2">
            {/* Tamanho */}
            {editingIdx === i ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (editingName.trim()) update(i, { size: editingName.trim() });
                      setEditingIdx(null);
                    }
                    if (e.key === "Escape") setEditingIdx(null);
                  }}
                  className={inp + " text-xs py-1.5"}
                />
                <button
                  type="button"
                  onClick={() => { if (editingName.trim()) update(i, { size: editingName.trim() }); setEditingIdx(null); }}
                  className="text-green-500 hover:text-green-600 shrink-0"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditingIdx(i); setEditingName(s.size); }}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-orange-500 transition text-left w-full group"
              >
                <span className="truncate">{s.size}</span>
                <Pencil size={11} className="shrink-0 text-gray-300 group-hover:text-orange-400 transition" />
              </button>
            )}

            {/* Custo */}
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={s.cost}
              onChange={(e) => onCostChange(i, e.target.value)}
              className={inp + " text-xs py-1.5 text-right"}
            />

            {/* Margem */}
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={s.margin}
              onChange={(e) => onMarginChange(i, e.target.value)}
              className={inp + " text-xs py-1.5 text-right"}
            />

            {/* Venda */}
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={s.price}
              onChange={(e) => onPriceChange(i, e.target.value)}
              className={inp + " text-xs py-1.5 text-right font-bold text-orange-600"}
            />

            {/* Remove */}
            <button
              type="button"
              onClick={() => onChange(sizes.filter((_, idx) => idx !== i))}
              className="flex items-center justify-center text-gray-300 hover:text-red-400 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 px-3 py-2 bg-gray-50 border-t border-gray-100">
        Venda calculada automaticamente. Edite diretamente para ajustar a margem.
      </p>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer w-fit select-none">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? "bg-orange-500" : "bg-gray-300"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
      </button>
      <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <Pizza size={14} className="text-orange-500" /> {label}
      </span>
    </label>
  );
}

// ── MoneyField ────────────────────────────────────────────────────────────────

function MoneyField({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}{required && " *"}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none select-none">
          R$
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inp + " pl-9"}
        />
      </div>
    </div>
  );
}

// ── Main form state ───────────────────────────────────────────────────────────

const emptyForm = {
  name: "", description: "", imageUrl: "",
  costPrice: "", profitMargin: "", salePrice: "",
  unit: "", size: "", weight: "", sku: "", barcode: "", categoryId: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]   = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Create form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<any>(emptyForm);
  const [formSizes, setFormSizes] = useState<SizeRow[]>(defaultSizes());
  const [formPizza, setFormPizza] = useState(false);
  const [image, setImage]         = useState<File | null>(null);

  // Edit modal
  const [editProduct, setEditProduct]   = useState<any>(null);
  const [editForm, setEditForm]         = useState({ name: "", description: "", salePrice: "", costPrice: "", profitMargin: "", categoryId: "" });
  const [editSizes, setEditSizes]       = useState<SizeRow[]>(defaultSizes());
  const [editPizza, setEditPizza]       = useState(false);
  const [editImage, setEditImage]       = useState<File | null>(null);
  const [saving, setSaving]             = useState(false);

  // ── derived ──────────────────────────────────────────────────────────────────
  const isFormPizza = formPizza || isPizzaCategory(form.categoryId, categories);
  const isEditPizza = editPizza || isPizzaCategory(editForm.categoryId, categories);

  // auto-toggle pizza mode when category changes
  useEffect(() => {
    if (isPizzaCategory(form.categoryId, categories)) setFormPizza(true);
  }, [form.categoryId, categories]);

  useEffect(() => {
    if (isPizzaCategory(editForm.categoryId, categories)) setEditPizza(true);
  }, [editForm.categoryId, categories]);

  // ── main price auto-calc (non-pizza mode) ────────────────────────────────────
  function calcFormSalePrice() {
    const c = parseFloat(form.costPrice);
    const m = parseFloat(form.profitMargin);
    if (!isFinite(c) || c <= 0) { toast.error("Informe o custo"); return; }
    if (!isFinite(m) || m < 0) { toast.error("Informe a margem %"); return; }
    setForm((f: any) => ({ ...f, salePrice: (c * (1 + m / 100)).toFixed(2) }));
  }

  // ── API ───────────────────────────────────────────────────────────────────────
  async function fetchProducts() {
    try { const r = await api.get("/products"); setProducts(r.data); }
    catch { toast.error("Erro ao carregar produtos"); }
  }

  async function fetchCategories() {
    try { const r = await api.get("/categories"); setCategories(r.data); }
    catch { toast.error("Erro ao carregar categorias"); }
  }

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  // ── Sizes → backend format ────────────────────────────────────────────────────
  function sizesToPayload(rows: SizeRow[]) {
    return rows
      .filter((s) => s.size.trim() && s.price !== "" && isFinite(Number(s.price)))
      .map((s) => ({
        size:  s.size.trim(),
        price: parseFloat(s.price) || 0,
        cost:  parseFloat(s.cost)  || 0,
      }));
  }

  // ── Create ────────────────────────────────────────────────────────────────────
  async function createProduct() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!isFormPizza && (!form.salePrice || isNaN(Number(form.salePrice)))) {
      toast.error("Informe o valor de venda"); return;
    }
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fd   = new FormData();
      Object.keys(form).forEach((k) => { if (form[k] !== "") fd.append(k, form[k]); });
      fd.append("companyId", user.companyId);
      if (image) fd.append("image", image);
      const sized = isFormPizza ? sizesToPayload(formSizes) : [];
      fd.append("sizes", JSON.stringify(sized));
      if (isFormPizza) { fd.set("salePrice", sized.length > 0 ? String(Math.max(...sized.map((s) => s.price))) : "0"); }
      await api.post("/products", fd);
      toast.success("Produto criado!");
      setForm(emptyForm); setFormSizes(defaultSizes()); setFormPizza(false); setImage(null); setShowForm(false);
      fetchProducts();
    } catch { toast.error("Erro ao criar produto"); }
  }

  // ── Open edit ─────────────────────────────────────────────────────────────────
  function openEdit(product: any) {
    setEditProduct(product);
    const hasSizes = product.sizes?.length > 0;
    setEditPizza(hasSizes);
    setEditForm({
      name:        product.name        || "",
      description: product.description || "",
      salePrice:   product.salePrice   ? String(product.salePrice) : "",
      costPrice:   product.costPrice   ? String(product.costPrice) : "",
      profitMargin: "",
      categoryId:  product.categoryId  || "",
    });
    setEditSizes(
      hasSizes
        ? product.sizes.map((ps: any) => ({
            size:   ps.size,
            cost:   ps.cost   != null ? String(ps.cost)  : "",
            margin: "",
            price:  ps.price  != null ? String(ps.price) : "",
          }))
        : defaultSizes()
    );
    setEditImage(null);
  }

  // ── Save edit ─────────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editProduct) return;
    if (!editForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!isEditPizza && (!editForm.salePrice || isNaN(Number(editForm.salePrice)))) {
      toast.error("Informe o valor de venda"); return;
    }
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fd   = new FormData();
      fd.append("name",        editForm.name.trim());
      fd.append("description", editForm.description);
      fd.append("companyId",   user.companyId);
      if (editForm.categoryId) fd.append("categoryId", editForm.categoryId);
      if (editImage) fd.append("image", editImage);

      const sized = isEditPizza ? sizesToPayload(editSizes) : [];
      fd.append("sizes", JSON.stringify(sized));
      const sp = isEditPizza
        ? (sized.length > 0 ? String(Math.max(...sized.map((s) => s.price))) : "0")
        : editForm.salePrice;
      fd.append("salePrice", sp || "0");
      fd.append("costPrice",  editForm.costPrice  || "0");

      await api.patch(`/products/${editProduct.id}`, fd);
      toast.success("Produto atualizado!");
      setEditProduct(null);
      fetchProducts();
    } catch { toast.error("Erro ao atualizar produto"); }
    finally { setSaving(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function deleteProduct(product: any) {
    if (!confirm(`Excluir "${product.name}"?`)) return;
    try { await api.delete(`/products/${product.id}`); toast.success("Excluído"); fetchProducts(); }
    catch { toast.error("Erro ao excluir"); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
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

          {/* ── Form de criação ────────────────────────────────────────────── */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">Novo produto</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition">
                  <X size={18} />
                </button>
              </div>

              {/* Basic fields */}
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                  <input placeholder="Ex: Pizza Margherita" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">SKU</label>
                  <input placeholder="Código interno" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Código de barras</label>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                  <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inp}>
                    <option value="">— Selecione —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Unidade</label>
                  <input placeholder="un, kg, L…" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Peso / Tamanho</label>
                  <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={inp} />
                </div>
              </div>

              {/* Preços — hidden when pizza */}
              {!isFormPizza && (
                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <MoneyField label="Custo" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} />
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Margem %</label>
                    <input
                      type="number" min="0" step="0.1" placeholder="0"
                      value={form.profitMargin}
                      onChange={(e) => setForm({ ...form, profitMargin: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={calcFormSalePrice}
                      className="h-[42px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition"
                    >
                      Calcular →
                    </button>
                  </div>
                  <MoneyField label="Venda *" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} required />
                </div>
              )}

              {/* Pizza toggle */}
              <div className="mb-4">
                <Toggle
                  value={isFormPizza}
                  onChange={(v) => setFormPizza(v)}
                  label="Produto pizza (preço por tamanho)"
                />
              </div>

              {/* Sizes table */}
              {isFormPizza && (
                <div className="mb-4">
                  <SizesTable sizes={formSizes} onChange={setFormSizes} />
                </div>
              )}

              {/* Desc + image */}
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                  <textarea
                    placeholder="Ingredientes, observações…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inp + " resize-none"}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Imagem</label>
                  <label className="block border border-dashed border-gray-300 hover:border-orange-400 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer flex items-center gap-2 transition h-[90px]">
                    <ImageIcon size={16} className="shrink-0" />
                    <span className="truncate">{image ? image.name : "Selecionar imagem (JPG, PNG)"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <button
                onClick={createProduct}
                className="bg-orange-500 hover:bg-orange-600 text-white px-7 py-3 rounded-xl font-bold text-sm transition"
              >
                Criar Produto
              </button>
            </div>
          )}

          {/* ── Grid de produtos ────────────────────────────────────────────── */}
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
                      <button onClick={() => openEdit(product)} className="bg-white/90 hover:bg-white shadow p-1.5 rounded-lg transition" title="Editar">
                        <Pencil size={13} className="text-gray-600" />
                      </button>
                      <button onClick={() => deleteProduct(product)} className="bg-white/90 hover:bg-red-50 shadow p-1.5 rounded-lg transition" title="Excluir">
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                    </div>
                    {product.category?.name && (
                      <span className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {product.category.name}
                      </span>
                    )}
                    {product.sizes?.length > 0 && (
                      <span className="absolute bottom-2 right-2 bg-white/90 text-orange-500 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Pizza size={10} /> {product.sizes.length} tam.
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</h2>
                    {product.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-1">
                      {product.sizes?.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {product.sizes.slice(0, 2).map((ps: any) => (
                            <span key={ps.size} className="text-xs bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded border border-orange-100">
                              {ps.size}: R${Number(ps.price).toFixed(2)}
                            </span>
                          ))}
                          {product.sizes.length > 2 && (
                            <span className="text-xs text-gray-400">+{product.sizes.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-orange-500 text-lg font-black">
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

      {/* ── Modal de edição ─────────────────────────────────────────────────── */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-7 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-gray-900">Editar Produto</h2>
              <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={inp}
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className={inp + " resize-none"}
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className={inp}
                >
                  <option value="">— Sem categoria —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Pizza toggle */}
              <Toggle
                value={isEditPizza}
                onChange={(v) => setEditPizza(v)}
                label="Preço por tamanho"
              />

              {/* Preços OR sizes */}
              {isEditPizza ? (
                <SizesTable sizes={editSizes} onChange={setEditSizes} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <MoneyField label="Custo" value={editForm.costPrice} onChange={(v) => setEditForm({ ...editForm, costPrice: v })} />
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Margem %</label>
                    <input
                      type="number" min="0" step="0.1" placeholder="0"
                      value={editForm.profitMargin}
                      onChange={(e) => {
                        const m = e.target.value;
                        const c = parseFloat(editForm.costPrice);
                        const price = calcPrice(editForm.costPrice, m);
                        setEditForm({ ...editForm, profitMargin: m, salePrice: price || editForm.salePrice });
                      }}
                      className={inp}
                    />
                  </div>
                  <MoneyField label="Venda *" value={editForm.salePrice} onChange={(v) => {
                    const margin = calcMargin(editForm.costPrice, v);
                    setEditForm({ ...editForm, salePrice: v, profitMargin: margin });
                  }} required />
                </div>
              )}

              {/* Imagem */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Imagem</label>
                {editProduct.imageUrl && !editImage && (
                  <img src={editProduct.imageUrl} alt="atual" className="w-16 h-16 object-cover rounded-xl mb-2" />
                )}
                {editImage && (
                  <img src={URL.createObjectURL(editImage)} alt="nova" className="w-16 h-16 object-cover rounded-xl mb-2 ring-2 ring-orange-400" />
                )}
                <label className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-orange-400 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-pointer transition">
                  <ImageIcon size={16} className="shrink-0" />
                  <span className="truncate">{editImage ? editImage.name : "Selecionar nova imagem"}</span>
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
