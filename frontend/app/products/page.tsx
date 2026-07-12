"use client";

import { api } from "@/services/api";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { RoleGuard } from "@/components/role-guard";
import { Check, Pencil, Plus, Trash2, X, Package, Pizza, Search, Beer, Loader2, Settings2, Link as LinkIcon, GripVertical, Video, ChevronDown } from "lucide-react";

// @hello-pangea/dnd — incompatível com SSR
const DragDropContext = dynamic(() => import("@hello-pangea/dnd").then((m) => m.DragDropContext), { ssr: false });
const Droppable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Droppable),       { ssr: false }) as any;
const Draggable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Draggable),       { ssr: false }) as any;
import { CurrencyInputBR } from "@/components/ui/CurrencyInputBR";
import { ImageUploaderPreview } from "@/components/ui/ImageUploaderPreview";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SizeRow {
  size: string;
  cost: number;   // R$
  margin: number; // %
  price: number;  // R$
}

const defaultSizes = (): SizeRow[] => [
  { size: "Pequena", cost: 0, margin: 0, price: 0 },
  { size: "Média",   cost: 0, margin: 0, price: 0 },
  { size: "Grande",  cost: 0, margin: 0, price: 0 },
  { size: "Família", cost: 0, margin: 0, price: 0 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcPriceFromCostMargin(cost: number, margin: number): number {
  if (!isFinite(cost) || cost <= 0) return 0;
  if (!isFinite(margin) || margin < 0) return cost;
  return parseFloat((cost * (1 + margin / 100)).toFixed(2));
}

function calcMarginFromCostPrice(cost: number, price: number): number {
  if (!isFinite(cost) || cost <= 0 || !isFinite(price) || price <= 0) return 0;
  return parseFloat((((price - cost) / cost) * 100).toFixed(1));
}

function isPizzaCat(catId: string, cats: any[]): boolean {
  return !!cats.find((c) => c.id === catId && c.name.toLowerCase().includes("pizza"));
}

function isBeverageCat(catId: string, cats: any[]): boolean {
  return !!cats.find((c) => c.id === catId && c.categoryType === "bebidas");
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── shared input class ────────────────────────────────────────────────────────

const inp =
  "w-full border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 " +
  "rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-white outline-none transition placeholder-gray-400";

// ── SizesTable ────────────────────────────────────────────────────────────────

function SizesTable({ rows, onChange }: { rows: SizeRow[]; onChange: (r: SizeRow[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function update(i: number, patch: Partial<SizeRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function onCostChange(i: number, cost: number) {
    const row = rows[i];
    const price = calcPriceFromCostMargin(cost, row.margin);
    update(i, { cost, price });
  }

  function onMarginChange(i: number, val: string) {
    const margin = Math.min(Math.max(parseFloat(val) || 0, 0), 10000);
    const price = calcPriceFromCostMargin(rows[i].cost, margin);
    update(i, { margin, price });
  }

  function onPriceChange(i: number, price: number) {
    const margin = calcMarginFromCostPrice(rows[i].cost, price);
    update(i, { price, margin });
  }

  function confirmEdit(i: number) {
    const trimmed = editName.trim();
    if (trimmed) update(i, { size: trimmed });
    setEditIdx(null);
  }

  return (
    <div className="border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 flex items-center justify-between border-b border-orange-100">
        <span className="text-xs font-black text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
          <Pizza size={13} /> Preços por Tamanho
        </span>
        <button
          type="button"
          onClick={() => onChange([...rows, { size: `Tamanho ${rows.length + 1}`, cost: 0, margin: 0, price: 0 }])}
          className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-bold bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition"
        >
          <Plus size={12} /> Adicionar
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_120px_90px_130px_36px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
        <span>Tamanho</span>
        <span className="text-right">Custo R$</span>
        <span className="text-right">Margem %</span>
        <span className="text-right">Venda R$</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50 bg-white">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_120px_90px_130px_36px] gap-2 items-center px-4 py-2.5 hover:bg-gray-50/50 transition"
          >
            {/* Tamanho inline edit */}
            {editIdx === i ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit(i);
                    if (e.key === "Escape") setEditIdx(null);
                  }}
                  onBlur={() => confirmEdit(i)}
                  className="flex-1 border border-orange-300 ring-2 ring-orange-100 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-900 outline-none"
                />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); confirmEdit(i); }}
                  className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center transition shrink-0"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditIdx(i); setEditName(row.size); }}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-orange-500 transition text-left group"
              >
                <span>{row.size}</span>
                <Pencil size={11} className="text-gray-300 group-hover:text-orange-400 transition shrink-0 opacity-0 group-hover:opacity-100" />
              </button>
            )}

            {/* Custo */}
            <CurrencyInputBR
              value={row.cost}
              onChange={(v) => onCostChange(i, v)}
              className="w-full border border-gray-200 focus:border-orange-300 focus:ring-1 focus:ring-orange-100 rounded-lg px-2.5 py-1.5 text-xs text-right font-medium text-gray-700 bg-white outline-none"
            />

            {/* Margem */}
            <input
              type="number"
              min={0}
              max={10000}
              step={0.1}
              placeholder="0"
              value={row.margin || ""}
              onChange={(e) => onMarginChange(i, e.target.value)}
              className="w-full border border-gray-200 focus:border-orange-300 focus:ring-1 focus:ring-orange-100 rounded-lg px-2.5 py-1.5 text-xs text-right font-medium text-gray-700 bg-white outline-none"
            />

            {/* Venda */}
            <CurrencyInputBR
              value={row.price}
              onChange={(v) => onPriceChange(i, v)}
              className="w-full border border-orange-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 rounded-lg px-2.5 py-1.5 text-xs text-right font-black text-orange-600 bg-orange-50/50 outline-none"
            />

            {/* Remove */}
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="flex items-center justify-center w-8 h-8 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">
        Venda = Custo × (1 + Margem%). Editando Venda recalcula Margem automaticamente.
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value ? "bg-orange-500" : "bg-gray-300"}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
      </button>
      <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <Pizza size={14} className="text-orange-500" /> {label}
      </span>
    </label>
  );
}

// ── MoneyField (non-pizza) ────────────────────────────────────────────────────

function MoneyField({ label, value, onChange, required }: {
  label: string; value: number; onChange: (v: number) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}{required && " *"}
      </label>
      <CurrencyInputBR
        value={value}
        onChange={onChange}
        className={inp}
        placeholder="0,00"
      />
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  name: "", description: "", sku: "", barcode: "",
  categoryId: "", unit: "", weight: "",
  costPrice: 0, profitMargin: 0, salePrice: 0,
  imageUrl: null as string | null,
  imageZoom: 100 as number,
  videoUrl: "" as string,
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]     = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("products_collapsed_cats");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  function toggleCatCollapsed(catId: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      try { localStorage.setItem("products_collapsed_cats", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Create
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [formSizes, setFormSizes] = useState<SizeRow[]>(defaultSizes());
  const [formPizza, setFormPizza] = useState(false);

  // Beverage modal
  const [showBeverageModal, setShowBeverageModal] = useState(false);
  const [beverageCategoryId, setBeverageCategoryId] = useState<string>("");

  // Edit
  const [editProduct, setEditProduct]   = useState<any>(null);
  const [editForm, setEditForm]         = useState(emptyForm());
  const [editSizes, setEditSizes]       = useState<SizeRow[]>(defaultSizes());
  const [editPizza, setEditPizza]       = useState(false);
  const [saving, setSaving]             = useState(false);

  // Derived
  const isFormPizza = formPizza || isPizzaCat(form.categoryId, categories);
  const isEditPizza = editPizza || isPizzaCat(editForm.categoryId, categories);

  // auto-toggle pizza when category changes
  useEffect(() => { if (isPizzaCat(form.categoryId, categories)) setFormPizza(true); }, [form.categoryId, categories]);
  useEffect(() => { if (isPizzaCat(editForm.categoryId, categories)) setEditPizza(true); }, [editForm.categoryId, categories]);

  // When "New Product" button is clicked and category is beverage, open beverage modal
  function handleNewProductClick() {
    setShowForm(!showForm);
    if (showForm) {
      setForm(emptyForm());
      setFormSizes(defaultSizes());
      setFormPizza(false);
    }
  }

  function handleCategoryChange(catId: string) {
    setForm({ ...form, categoryId: catId });
    if (isBeverageCat(catId, categories)) {
      setBeverageCategoryId(catId);
      setShowBeverageModal(true);
      setShowForm(false);
    }
  }

  // margin auto-calc for non-pizza form
  useEffect(() => {
    if (isFormPizza) return;
    if (form.costPrice > 0 && form.profitMargin >= 0) {
      const p = calcPriceFromCostMargin(form.costPrice, form.profitMargin);
      setForm((f) => f.salePrice === p ? f : { ...f, salePrice: p });
    }
  }, [form.costPrice, form.profitMargin, isFormPizza]);

  useEffect(() => {
    if (isEditPizza) return;
    if (editForm.costPrice > 0 && editForm.profitMargin >= 0) {
      const p = calcPriceFromCostMargin(editForm.costPrice, editForm.profitMargin);
      setEditForm((f) => f.salePrice === p ? f : { ...f, salePrice: p });
    }
  }, [editForm.costPrice, editForm.profitMargin, isEditPizza]);

  // ── API ───────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try { const r = await api.get("/products"); setProducts(r.data); }
    catch { toast.error("Erro ao carregar produtos"); }
    finally { setLoading(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try { const r = await api.get("/categories"); setCategories(r.data); }
    catch { /* silent */ }
  }, []);

  // ── Reordenar dentro de uma categoria (drag-and-drop per-category) ──────────
  async function handleCatDragEnd(catId: string, result: any) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const catProducts = products.filter((p) => (p.categoryId ?? "none") === catId);
    const others      = products.filter((p) => (p.categoryId ?? "none") !== catId);

    const next = Array.from(catProducts);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);

    const previous = products;
    setProducts([...others, ...next]);

    const payload = next.map((p, i) => ({ id: p.id, sortOrder: i + 1 }));
    try {
      await api.patch("/products/reorder", { items: payload });
    } catch {
      setProducts(previous);
      toast.error("Erro ao reordenar");
    }
  }

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);

  // ── Sizes → payload ───────────────────────────────────────────────────────
  function sizesToPayload(rows: SizeRow[]) {
    return rows.filter((r) => r.size.trim() && r.price > 0).map((r) => ({
      size: r.size.trim(),
      price: r.price,
      cost: r.cost,
    }));
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function createProduct() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!isFormPizza && form.salePrice <= 0) { toast.error("Informe o preço de venda"); return; }
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fd = new FormData();
      fd.append("name", form.name.trim());
      if (form.description) fd.append("description", form.description);
      if (form.sku) fd.append("sku", form.sku);
      if (form.barcode) fd.append("barcode", form.barcode);
      if (form.categoryId) fd.append("categoryId", form.categoryId);
      if (form.unit) fd.append("unit", form.unit);
      fd.append("companyId", user.companyId);

      const sized = isFormPizza ? sizesToPayload(formSizes) : [];
      fd.append("sizes", JSON.stringify(sized));

      if (isFormPizza) {
        const maxPrice = sized.length > 0 ? Math.max(...sized.map((s) => s.price)) : 0;
        fd.append("salePrice", String(maxPrice));
        fd.append("costPrice", "0");
      } else {
        fd.append("salePrice", String(form.salePrice));
        fd.append("costPrice", String(form.costPrice));
        fd.append("profitMargin", String(form.profitMargin));
      }

      // Image: send as imageUrl (base64) — not as file attachment
      if (form.imageUrl) fd.append("imageUrl", form.imageUrl);
      fd.append("imageZoom", String(form.imageZoom));
      if (form.videoUrl.trim()) fd.append("videoUrl", form.videoUrl.trim());
      else fd.append("videoUrl", "");

      await api.post("/products", fd);
      toast.success("Produto criado!");
      setForm(emptyForm()); setFormSizes(defaultSizes()); setFormPizza(false); setShowForm(false);
      fetchProducts();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao criar produto"));
    }
  }

  // ── Open edit ─────────────────────────────────────────────────────────────
  function openEdit(product: any) {
    setEditProduct(product);
    const hasSizes = product.sizes?.length > 0;
    setEditPizza(hasSizes);
    setEditForm({
      name:        product.name        || "",
      description: product.description || "",
      sku:         product.sku         || "",
      barcode:     product.barcode     || "",
      categoryId:  product.categoryId  || "",
      unit:        product.unit        || "",
      weight:      product.weight      ? String(product.weight) : "",
      costPrice:   Number(product.costPrice)   || 0,
      profitMargin: 0,
      salePrice:   Number(product.salePrice)   || 0,
      imageUrl:    product.imageUrl    || null,
      imageZoom:   product.imageZoom   ?? 100,
      videoUrl:    product.videoUrl    || "",
    });
    setEditSizes(
      hasSizes
        ? product.sizes.map((ps: any) => ({
            size:   ps.size,
            cost:   Number(ps.cost)  || 0,
            margin: calcMarginFromCostPrice(Number(ps.cost), Number(ps.price)),
            price:  Number(ps.price) || 0,
          }))
        : defaultSizes()
    );
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editProduct) return;
    if (!editForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!isEditPizza && editForm.salePrice <= 0) { toast.error("Informe o preço de venda"); return; }
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fd = new FormData();
      fd.append("name", editForm.name.trim());
      if (editForm.description) fd.append("description", editForm.description);
      if (editForm.sku) fd.append("sku", editForm.sku);
      if (editForm.barcode) fd.append("barcode", editForm.barcode);
      if (editForm.categoryId) fd.append("categoryId", editForm.categoryId);
      if (editForm.unit) fd.append("unit", editForm.unit);
      fd.append("companyId", user.companyId);

      const sized = isEditPizza ? sizesToPayload(editSizes) : [];
      fd.append("sizes", JSON.stringify(sized));

      if (isEditPizza) {
        const maxPrice = sized.length > 0 ? Math.max(...sized.map((s) => s.price)) : 0;
        fd.append("salePrice", String(maxPrice));
        fd.append("costPrice", "0");
      } else {
        fd.append("salePrice", String(editForm.salePrice));
        fd.append("costPrice", String(editForm.costPrice));
        fd.append("profitMargin", String(editForm.profitMargin));
      }

      if (editForm.imageUrl) fd.append("imageUrl", editForm.imageUrl);
      fd.append("imageZoom", String(editForm.imageZoom));
      if (editForm.videoUrl?.trim()) fd.append("videoUrl", editForm.videoUrl.trim());
      else fd.append("videoUrl", "");

      await api.patch(`/products/${editProduct.id}`, fd);
      toast.success("Produto atualizado!");
      setEditProduct(null);
      fetchProducts();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao atualizar produto"));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteProduct(product: any) {
    if (!confirm(`Excluir "${product.name}"?`)) return;
    try { await api.delete(`/products/${product.id}`); toast.success("Excluído"); fetchProducts(); }
    catch { toast.error("Erro ao excluir"); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN", "MANAGER"]}>
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-200">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Produtos</h1>
                <p className="text-gray-400 text-sm">{products.length} cadastrado{products.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* Complementos shortcut */}
              <Link
                href="/complements"
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm"
              >
                <Settings2 size={15} /> Complementos
              </Link>
              {/* Beverage quick add */}
              {categories.some((c) => c.categoryType === "bebidas") && (
                <button
                  onClick={() => {
                    const bev = categories.find((c) => c.categoryType === "bebidas");
                    if (bev) { setBeverageCategoryId(bev.id); setShowBeverageModal(true); }
                  }}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-blue-200"
                >
                  <Beer size={15} /> Conveniência
                </button>
              )}
              <button
                onClick={handleNewProductClick}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-orange-200"
              >
                {showForm ? <X size={16} /> : <Plus size={16} />}
                {showForm ? "Cancelar" : "Novo produto"}
              </button>
            </div>
          </div>

          {/* ── Form criação ──────────────────────────────────────────────── */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <h2 className="text-base font-bold text-gray-900 mb-5">Novo produto</h2>

              <div className="grid md:grid-cols-3 gap-4 mb-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                  <input placeholder="Ex: Pizza Margherita" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                  <select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} className={inp}>
                    <option value="">— Selecione —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.categoryType === "bebidas" ? "🥤 " : "🍽️ "}{c.name}
                      </option>
                    ))}
                  </select>
                  {isBeverageCat(form.categoryId, categories) && (
                    <p className="text-xs text-blue-500 mt-1 font-semibold">
                      🥤 Categoria de bebidas — use o modal especial
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">SKU</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inp} placeholder="Código interno" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Código de barras</label>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inp} placeholder="EAN-13" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Unidade</label>
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inp} placeholder="un, kg, L…" />
                </div>
              </div>

              {/* Preços — apenas modo normal */}
              {!isFormPizza && (
                <div className="grid md:grid-cols-4 gap-4 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <MoneyField label="Custo" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} />
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Margem %</label>
                    <input
                      type="number" min={0} max={10000} step={0.1} placeholder="ex: 120"
                      value={form.profitMargin || ""}
                      onChange={(e) => {
                        const m = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 10000);
                        setForm({ ...form, profitMargin: m });
                      }}
                      className={inp}
                    />
                  </div>
                  <MoneyField label="Venda *" value={form.salePrice} onChange={(v) => {
                    const m = calcMarginFromCostPrice(form.costPrice, v);
                    setForm({ ...form, salePrice: v, profitMargin: m });
                  }} required />
                  <div className="flex items-end">
                    <div className="w-full bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[10px] text-orange-400 font-bold uppercase">Margem calculada</p>
                      <p className="text-lg font-black text-orange-600">{form.profitMargin.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pizza toggle */}
              <div className="mb-4">
                <Toggle value={isFormPizza} onChange={setFormPizza} label="Produto pizza (preço por tamanho)" />
              </div>

              {isFormPizza && (
                <div className="mb-5">
                  <SizesTable rows={formSizes} onChange={setFormSizes} />
                </div>
              )}

              {/* Descrição + Imagem */}
              <div className="grid md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                  <textarea
                    placeholder="Ingredientes, observações…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inp + " resize-none"}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Imagem</label>
                  <ImageUploaderPreview
                    value={form.imageUrl || undefined}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    zoom={form.imageZoom}
                    onZoomChange={(z) => setForm({ ...form, imageZoom: z })}
                  />
                </div>
              </div>

              {/* Vídeo promocional */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <Video size={13} className="text-gray-400" />
                  Vídeo Promocional
                  <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="Cole o link do vídeo (YouTube, Vimeo, MP4…)"
                    value={form.videoUrl}
                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                    className={inp + " pr-10"}
                  />
                  {form.videoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, videoUrl: "" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {form.videoUrl && (
                  <p className="mt-1.5 text-[11px] text-emerald-600 flex items-center gap-1">
                    <Video size={11} /> Vídeo configurado — ícone de olho ficará ativo no PDV e cardápio.
                  </p>
                )}
              </div>

              <button
                onClick={createProduct}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold text-sm transition shadow-md shadow-orange-200"
              >
                Criar Produto
              </button>
            </div>
          )}

          {/* ── Grid de produtos ──────────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-44 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-400 py-20">
              <Package size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Nenhum produto cadastrado</p>
              <p className="text-sm mt-1">Clique em "Novo produto" para começar</p>
            </div>
          ) : (
            /* ── Agrupado por categoria ──────────────────────────────────── */
            <>
              {(() => {
                // Build ordered groups: categories in sortOrder, then uncategorized
                const groups: { id: string; name: string; items: any[] }[] = [];
                categories.forEach((cat) => {
                  const items = products.filter((p) => p.categoryId === cat.id);
                  if (items.length > 0) groups.push({ id: cat.id, name: cat.name, items });
                });
                const uncategorized = products.filter(
                  (p) => !p.categoryId || !categories.find((c) => c.id === p.categoryId)
                );
                if (uncategorized.length > 0)
                  groups.push({ id: "none", name: "Sem categoria", items: uncategorized });

                return groups.map(({ id: catId, name: catName, items: catProducts }) => {
                  const isCollapsed = collapsedCats.has(catId);
                  return (
                  <div key={catId} className="mb-8">
                    <button
                      type="button"
                      onClick={() => toggleCatCollapsed(catId)}
                      className="flex items-center gap-2 mb-3 w-full text-left group/cathdr"
                    >
                      <ChevronDown
                        size={14}
                        className={`text-gray-400 group-hover/cathdr:text-gray-600 transition-transform shrink-0 ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                      <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest group-hover/cathdr:text-gray-700">{catName}</h2>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{catProducts.length} produto{catProducts.length !== 1 ? "s" : ""}</span>
                    </button>
                    {isCollapsed ? null : (
                    <DragDropContext onDragEnd={(r) => handleCatDragEnd(catId, r)}>
                      <Droppable droppableId={`cat-${catId}`}>
                        {(dropProvided: any) => (
                          <div
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3"
                          >
                            {catProducts.map((product: any, index: number) => (
                              <Draggable key={product.id} draggableId={product.id} index={index}>
                                {(dragProvided: any, snapshot: any) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className={`relative bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-200 group ${
                                      snapshot.isDragging ? "border-primary shadow-xl ring-2 ring-orange-100" : "border-gray-100 hover:shadow-md hover:-translate-y-0.5"
                                    }`}
                                  >
                                    {/* Drag handle */}
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="absolute top-1.5 left-1.5 z-10 bg-white/90 hover:bg-white shadow-sm p-0.5 rounded-md text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition"
                                      title="Arrastar para reordenar"
                                    >
                                      <GripVertical size={12} />
                                    </div>
                                    {/* Image */}
                                    <div className="relative h-28 bg-gray-100 overflow-hidden">
                                      <img
                                        src={product.imageUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80"}
                                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80"; }}
                                        className="w-full h-full object-cover"
                                        style={{ transform: `scale(${(product.imageZoom ?? 100) / 100})`, transformOrigin: "center center" }}
                                        alt={product.name}
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
                                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => openEdit(product)} className="bg-white/95 hover:bg-white shadow-sm p-1 rounded-md transition" title="Editar">
                                          <Pencil size={11} className="text-gray-600" />
                                        </button>
                                        <button onClick={() => deleteProduct(product)} className="bg-white/95 hover:bg-red-50 shadow-sm p-1 rounded-md transition" title="Excluir">
                                          <Trash2 size={11} className="text-red-500" />
                                        </button>
                                      </div>
                                      {product.sizes?.length > 0 && (
                                        <span className="absolute bottom-1.5 right-1.5 bg-white/95 text-orange-500 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
                                          <Pizza size={8} /> {product.sizes.length}
                                        </span>
                                      )}
                                    </div>
                                    {/* Info */}
                                    <div className="p-2.5">
                                      <h2 className="font-bold text-gray-900 text-xs leading-snug line-clamp-2">{product.name}</h2>
                                      <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
                                        {product.sizes?.length > 0 ? (
                                          <span className="text-[10px] text-orange-500 font-bold">
                                            A partir de R$ {fmtBRL(Math.min(...product.sizes.map((s: any) => Number(s.price))))}
                                          </span>
                                        ) : (
                                          <p className="text-orange-500 text-sm font-black">R$ {fmtBRL(Number(product.salePrice))}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {dropProvided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                    )}
                  </div>
                  );
                });
              })()}
            </>
          )}
        </div>
      </main>

      {/* ── Modal de edição ─────────────────────────────────────────────── */}
      {editProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          {/* Container sempre cabe na viewport (max-h-[90vh]) — header e rodapé
              ficam fixos, só o miolo do formulário rola. Independe da resolução:
              nunca corta o título nem os botões de ação. */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-black text-gray-900">Editar Produto</h2>
              <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className={inp + " resize-none"} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                  <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })} className={inp}>
                    <option value="">— Sem categoria —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Código de barras</label>
                  <input value={editForm.barcode} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} className={inp} placeholder="EAN-13" />
                </div>
              </div>

              <Toggle value={isEditPizza} onChange={setEditPizza} label="Preço por tamanho" />

              {isEditPizza ? (
                <SizesTable rows={editSizes} onChange={setEditSizes} />
              ) : (
                <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <MoneyField label="Custo" value={editForm.costPrice} onChange={(v) => setEditForm({ ...editForm, costPrice: v })} />
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Margem %</label>
                    <input
                      type="number" min={0} max={10000} step={0.1}
                      value={editForm.profitMargin || ""}
                      onChange={(e) => {
                        const m = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 10000);
                        setEditForm({ ...editForm, profitMargin: m });
                      }}
                      className={inp}
                    />
                  </div>
                  <MoneyField label="Venda *" value={editForm.salePrice} onChange={(v) => {
                    const m = calcMarginFromCostPrice(editForm.costPrice, v);
                    setEditForm({ ...editForm, salePrice: v, profitMargin: m });
                  }} required />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Imagem</label>
                <ImageUploaderPreview
                  value={editForm.imageUrl || undefined}
                  onChange={(url) => setEditForm({ ...editForm, imageUrl: url })}
                  zoom={editForm.imageZoom}
                  onZoomChange={(z) => setEditForm({ ...editForm, imageZoom: z })}
                />
              </div>

              {/* Vídeo no edit */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                  <Video size={13} className="text-gray-400" />
                  Vídeo Promocional
                  <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="Cole o link do vídeo (YouTube, Vimeo, MP4…)"
                    value={editForm.videoUrl || ""}
                    onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                    className={inp + " pr-10"}
                  />
                  {editForm.videoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, videoUrl: "" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {editForm.videoUrl && (
                  <p className="mt-1.5 text-[11px] text-emerald-600 flex items-center gap-1">
                    <Video size={11} /> Vídeo configurado — ícone de olho ficará ativo no PDV e cardápio.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-7 py-5 border-t border-gray-100 shrink-0">
              <button onClick={() => setEditProduct(null)} className="flex-1 border border-gray-200 hover:bg-gray-50 py-3 rounded-xl font-semibold text-sm text-gray-600 transition">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 py-3 rounded-xl font-bold text-sm text-white transition shadow-md shadow-orange-200">
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Beverage Modal ──────────────────────────────────────────────── */}
      {showBeverageModal && (
        <BeverageModal
          categoryId={beverageCategoryId}
          categories={categories}
          onClose={() => setShowBeverageModal(false)}
          onCreated={() => { setShowBeverageModal(false); fetchProducts(); }}
        />
      )}
    </RoleGuard>
  );
}

// ── BeverageModal ─────────────────────────────────────────────────────────────

interface BeverageModalProps {
  categoryId: string;
  categories: any[];
  onClose: () => void;
  onCreated: () => void;
}

function BeverageModal({ categoryId, categories, onClose, onCreated }: BeverageModalProps) {
  type Step = "type" | "search" | "form";

  const [step, setStep]                 = useState<Step>("type");
  const [productType, setProductType]   = useState<"preparado" | "industrializado">("industrializado");
  const [searchQuery, setSearchQuery]   = useState("");
  const [searching, setSearching]       = useState(false);
  const [suggestions, setSuggestions]   = useState<any[]>([]);
  const [saving, setSaving]             = useState(false);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [icmsRate, setIcmsRate]         = useState(0); // % ICMS — UI only, affects margin display
  const [form, setForm]                 = useState({
    name: "", description: "", salePrice: 0, costPrice: 0,
    eanCode: "", sku: "", unit: "un", imageUrl: null as string | null,
    brand: "", categoryId,
  });

  const UNIT_OPTIONS = ["un", "350ml", "473ml", "500ml", "600ml", "1L", "2L", "g", "100g", "kg"];
  function cycleUnit(dir: 1 | -1) {
    setForm(f => {
      const idx = UNIT_OPTIONS.indexOf(f.unit);
      const next = (idx + dir + UNIT_OPTIONS.length) % UNIT_OPTIONS.length;
      return { ...f, unit: UNIT_OPTIONS[next] };
    });
  }

  const costWithIcms = form.costPrice * (1 + icmsRate / 100);
  const profitMargin = form.salePrice > 0
    ? ((form.salePrice - costWithIcms) / form.salePrice) * 100
    : 0;

  // Search Open Food Facts via proxy (avoids CORS)
  async function searchProducts(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    setSuggestions([]);
    try {
      // EAN/barcode lookup
      if (/^\d{8,14}$/.test(query.trim())) {
        const r = await fetch(`/api/off/product/${query.trim()}`);
        const data = await r.json();
        if (data.status === 1 && data.product) {
          setSuggestions([mapOFFProduct(data.product)]);
          return;
        }
      }
      // Name search
      const r = await fetch(`/api/off/search?q=${encodeURIComponent(query)}`);
      const data = await r.json();
      if (Array.isArray(data.products)) {
        setSuggestions(data.products.map(mapOFFProduct).filter((p: any) => p.name));
      }
    } catch {
      toast.error("Erro na busca. Verifique sua conexão.");
    } finally {
      setSearching(false);
    }
  }

  function mapOFFProduct(p: any) {
    return {
      name:     p.product_name || p.product_name_pt || "",
      brand:    p.brands || "",
      ean:      p.code || p._id || "",
      imageUrl: p.image_url || p.image_front_url || null,
      quantity: p.quantity || "",
    };
  }

  function selectSuggestion(s: any) {
    setForm((f) => ({
      ...f,
      name:     s.brand ? `${s.brand} ${s.name}`.trim() : s.name,
      brand:    s.brand || "",
      eanCode:  s.ean,
      sku:      s.ean ? `EAN-${s.ean}` : "",
      imageUrl: s.imageUrl,
      unit:     s.quantity || "un",
    }));
    setStep("form");
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (form.salePrice <= 0) { toast.error("Informe o preço de venda"); return; }
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const fd = new FormData();
      fd.append("name",        form.name.trim());
      fd.append("categoryId",  form.categoryId);
      fd.append("unit",        form.unit);
      fd.append("salePrice",   String(form.salePrice));
      fd.append("costPrice",   String(form.costPrice));
      fd.append("companyId",   user.companyId);
      fd.append("productType", productType);
      if (form.description) fd.append("description", form.description);
      if (form.eanCode)     fd.append("eanCode",  form.eanCode);
      if (form.sku)         fd.append("sku",      form.sku);
      // brand is stored in product name — NOT sent separately (not in schema)
      if (form.imageUrl)    fd.append("imageUrl", form.imageUrl);
      fd.append("sizes", JSON.stringify([]));
      await api.post("/products", fd);
      toast.success("Bebida cadastrada!");
      onCreated();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥤</span>
            <h2 className="font-black text-gray-900">Cadastrar Bebida</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">

          {/* STEP 1: choose type */}
          {step === "type" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-600 mb-4">
                Que tipo de bebida você quer cadastrar?
              </p>

              <button
                onClick={() => { setProductType("industrializado"); setStep("search"); }}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition text-left group"
              >
                <div className="text-3xl mt-0.5">🏪</div>
                <div>
                  <p className="font-black text-gray-900 group-hover:text-blue-700">Industrializado</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Produtos prontos: refrigerantes, água, cerveja, energético, chocolates, salgadinhos…
                  </p>
                  <span className="inline-block mt-2 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                    🔍 Busca automática por nome ou código de barras (EAN)
                  </span>
                </div>
              </button>

              <button
                onClick={() => { setProductType("preparado"); setStep("form"); }}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-green-100 hover:border-green-400 hover:bg-green-50 transition text-left group"
              >
                <div className="text-3xl mt-0.5">🧃</div>
                <div>
                  <p className="font-black text-gray-900 group-hover:text-green-700">Preparado pela loja</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Produtos que você produz: sucos naturais, vitaminas, drinks, cafés, milkshakes…
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: search EAN / name */}
          {step === "search" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("type")}
                className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
              >
                ← voltar
              </button>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Nome do produto ou código de barras (EAN)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchQuery(v);
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        if (v.trim().length >= 3) {
                          debounceRef.current = setTimeout(() => searchProducts(v), 500);
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && searchProducts(searchQuery)}
                      placeholder="Ex: Coca-Cola 350ml ou 7894900011517"
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={() => searchProducts(searchQuery)}
                    disabled={searching}
                    className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 transition"
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Busca na base Open Food Facts (mundial, gratuita)
                </p>
              </div>

              {/* Suggestions — card grid */}
              {suggestions.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectSuggestion(s)}
                      className="flex flex-col rounded-xl border border-gray-100 hover:border-primary hover:bg-orange-50 transition text-left overflow-hidden group"
                    >
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={s.name} className="w-full h-24 object-contain bg-gray-50 border-b border-gray-100" />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center border-b border-gray-100">
                          <Beer size={28} className="text-gray-300" />
                        </div>
                      )}
                      <div className="p-2 space-y-0.5">
                        <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight">{s.name}</p>
                        {s.brand && (
                          <p className="text-[10px] text-gray-400 truncate">{s.brand}</p>
                        )}
                        {s.ean && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">EAN</span>
                            <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1 rounded">{s.ean}</span>
                          </div>
                        )}
                        {s.quantity && (
                          <p className="text-[9px] text-gray-400">{s.quantity}</p>
                        )}
                        <p className="text-[10px] font-bold text-primary group-hover:underline mt-1">Selecionar →</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {suggestions.length === 0 && searchQuery && !searching && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">Nenhum resultado. Preencha manualmente →</p>
                  <button
                    onClick={() => setStep("form")}
                    className="mt-2 text-sm text-primary font-bold underline"
                  >
                    Cadastrar manualmente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: form */}
          {step === "form" && (
            <div className="space-y-4">
              {step === "form" && productType === "industrializado" && (
                <button
                  onClick={() => setStep("search")}
                  className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
                >
                  ← voltar para a busca
                </button>
              )}
              {step === "form" && productType === "preparado" && (
                <button
                  onClick={() => setStep("type")}
                  className="text-xs text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
                >
                  ← voltar
                </button>
              )}

              {/* Preview image if from search */}
              {form.imageUrl && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <img src={form.imageUrl} alt="" className="w-14 h-14 object-contain rounded-lg bg-white border border-gray-100" />
                  <div>
                    <p className="text-xs font-bold text-blue-700">Imagem encontrada automaticamente</p>
                    <button
                      onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                      className="text-xs text-blue-500 underline mt-0.5"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Coca-Cola Lata 350ml"
                  className={inp}
                />
              </div>

              {/* EAN / Barcode / SKU row — always visible */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">EAN / Cód. barras</label>
                  <input
                    value={form.eanCode}
                    onChange={(e) => setForm({ ...form, eanCode: e.target.value })}
                    placeholder="Ex: 7894900011517"
                    className={inp + " font-mono"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">SKU interno</label>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Ex: BEB-001"
                    className={inp + " font-mono"}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Preço de venda *</label>
                  <CurrencyInputBR value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Custo</label>
                  <CurrencyInputBR value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} className={inp} />
                </div>
              </div>

              {/* ICMS + Profit margin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">ICMS (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={icmsRate}
                    onChange={(e) => setIcmsRate(Number(e.target.value))}
                    className={inp}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Margem de lucro</label>
                  <div className={`${inp} flex items-center justify-between pointer-events-none select-none ${
                    profitMargin < 0 ? "text-red-500" : profitMargin < 20 ? "text-orange-500" : "text-green-600"
                  }`}>
                    <span className="font-black text-base">{profitMargin.toFixed(1)}%</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {icmsRate > 0 ? `c/ ICMS ${icmsRate}%` : "sem ICMS"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Unit selector with arrows */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Unidade</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cycleUnit(-1)}
                      className="w-9 h-[42px] rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition shrink-0"
                    >‹</button>
                    <input
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className={inp + " text-center font-bold"}
                      placeholder="un"
                    />
                    <button
                      type="button"
                      onClick={() => cycleUnit(1)}
                      className="w-9 h-[42px] rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition shrink-0"
                    >›</button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["un", "350ml", "500ml", "1L", "kg"].map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm({ ...form, unit: u })}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                          form.unit === u
                            ? "bg-primary text-white border-primary"
                            : "text-gray-500 border-gray-200 hover:border-primary"
                        }`}
                      >{u}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className={inp}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={inp + " resize-none"}
                  placeholder="Ingredientes, sabor, observações…"
                />
              </div>

              {!form.imageUrl && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Imagem</label>
                  <ImageUploaderPreview
                    value={form.imageUrl || undefined}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {step === "form" && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-primary disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={15} />}
              {saving ? "Salvando…" : "Cadastrar Bebida"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
