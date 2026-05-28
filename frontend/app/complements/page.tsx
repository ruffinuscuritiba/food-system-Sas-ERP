"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronUp,
  Settings2, Tag, Package, Utensils, ShoppingBag, Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ComplementType = "INGREDIENTES" | "ESPECIFICACOES" | "CROSS_SELL" | "DESCARTAVEIS";

interface ComplementOption {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

interface Complement {
  id: string;
  productId: string | null;
  product?: { id: string; name: string };
  name: string;
  type: ComplementType;
  required: boolean;
  chargesExtra: boolean;
  multipleChoice: boolean;
  minOptions: number;
  maxOptions: number;
  isActive: boolean;
  options: ComplementOption[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<ComplementType, { label: string; icon: React.ReactNode; color: string }> = {
  INGREDIENTES:   { label: "Ingredientes",   icon: <Utensils size={14} />,    color: "bg-orange-50 text-orange-600 border-orange-100" },
  ESPECIFICACOES: { label: "Especificações", icon: <Settings2 size={14} />,   color: "bg-blue-50 text-blue-600 border-blue-100" },
  CROSS_SELL:     { label: "Sugestão",       icon: <ShoppingBag size={14} />, color: "bg-purple-50 text-purple-600 border-purple-100" },
  DESCARTAVEIS:   { label: "Descartáveis",   icon: <Package size={14} />,     color: "bg-gray-50 text-gray-600 border-gray-200" },
};

const EMPTY_COMPLEMENT = (): Omit<Complement, "id" | "options" | "product"> => ({
  productId:      null,
  name:           "",
  type:           "INGREDIENTES",
  required:       false,
  chargesExtra:   true,
  multipleChoice: false,
  minOptions:     0,
  maxOptions:     1,
  isActive:       true,
});

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ComplementsPage() {
  const [complements, setComplements] = useState<Complement[]>([]);
  const [products, setProducts]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  // modal create/edit complement
  const [modal, setModal]           = useState<"none" | "create" | "edit">("none");
  const [editComp, setEditComp]     = useState<Complement | null>(null);
  const [form, setForm]             = useState(EMPTY_COMPLEMENT());
  const [saving, setSaving]         = useState(false);

  // expanded card
  const [expanded, setExpanded]     = useState<string | null>(null);

  // option inline add
  const [optForm, setOptForm]       = useState<Record<string, { name: string; price: string }>>({});

  // ── Data ──────────────────────────────────────────────────────────────────────

  const fetchComplements = useCallback(async () => {
    try {
      const res = await api.get("/complements");
      setComplements(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Erro ao carregar complementos");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchComplements(); fetchProducts(); }, [fetchComplements, fetchProducts]);

  // ── Complement CRUD ───────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_COMPLEMENT());
    setEditComp(null);
    setModal("create");
  }

  function openEdit(c: Complement) {
    setForm({ ...c });
    setEditComp(c);
    setModal("edit");
  }

  async function saveComplement() {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      if (modal === "create") {
        await api.post("/complements", form);
        toast.success("Complemento criado!");
      } else if (editComp) {
        await api.patch(`/complements/${editComp.id}`, form);
        toast.success("Complemento atualizado!");
      }
      setModal("none");
      fetchComplements();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteComplement(id: string) {
    if (!confirm("Excluir este complemento e todas as opções?")) return;
    try {
      await api.delete(`/complements/${id}`);
      toast.success("Complemento excluído");
      fetchComplements();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  // ── Options ───────────────────────────────────────────────────────────────────

  async function addOption(complementId: string) {
    const of = optForm[complementId];
    if (!of?.name?.trim()) { toast.error("Informe o nome da opção"); return; }
    try {
      await api.post(`/complements/${complementId}/options`, {
        name:  of.name.trim(),
        price: parseFloat(of.price || "0") || 0,
      });
      setOptForm((p) => ({ ...p, [complementId]: { name: "", price: "" } }));
      fetchComplements();
    } catch {
      toast.error("Erro ao adicionar opção");
    }
  }

  async function deleteOption(complementId: string, optionId: string) {
    try {
      await api.delete(`/complements/${complementId}/options/${optionId}`);
      fetchComplements();
    } catch {
      toast.error("Erro ao excluir opção");
    }
  }

  // ── Group by product ──────────────────────────────────────────────────────────

  const grouped: Record<string, { product: any | null; items: Complement[] }> = {};
  complements.forEach((c) => {
    const key = c.productId ?? "__global";
    if (!grouped[key]) grouped[key] = { product: c.product ?? null, items: [] };
    grouped[key].items.push(c);
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
              <Settings2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Complementos</h1>
              <p className="text-gray-400 text-sm">
                Bordas, acompanhamentos, descartáveis e mais — estilo iFood
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-primary/20 transition"
          >
            <Plus size={16} /> Novo Complemento
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700">
            <strong>Como funciona:</strong> Cada produto pode ter vários complementos (grupos de opções).
            No cardápio, o cliente escolhe as opções antes de adicionar ao carrinho.
            Opções com preço &gt; R$ 0 somam ao valor do item.
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Carregando…</p>
          </div>
        ) : complements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Settings2 size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-semibold">Nenhum complemento cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">
              Clique em "Novo Complemento" para adicionar bordas, acompanhamentos, descartáveis…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([key, group]) => (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Product header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <Package size={14} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-600">
                    {group.product ? group.product.name : "Complementos globais"}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{group.items.length} complemento{group.items.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Complements */}
                <div className="divide-y divide-gray-50">
                  {group.items.map((c) => {
                    const meta = TYPE_META[c.type];
                    const isExpanded = expanded === c.id;
                    return (
                      <div key={c.id}>
                        {/* Complement row */}
                        <div className="px-5 py-4 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                                {meta.icon} {meta.label}
                              </span>
                              {c.required && (
                                <span className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                                  Obrigatório
                                </span>
                              )}
                              {c.multipleChoice && (
                                <span className="text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                                  Múltipla escolha
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {c.minOptions}–{c.maxOptions} opções •{" "}
                              {c.chargesExtra ? "cobra adicional" : "sem cobrança extra"} •{" "}
                              {c.options.length} opção{c.options.length !== 1 ? "ões" : ""} cadastrada{c.options.length !== 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => openEdit(c)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium transition border border-gray-200"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteComplement(c.id)}
                              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => setExpanded(isExpanded ? null : c.id)}
                              className="w-8 h-8 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-500 flex items-center justify-center transition"
                              title="Ver opções"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Options panel */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                            <p className="text-xs font-bold text-gray-500 mb-3">Opções do complemento</p>

                            {/* Existing options */}
                            <div className="space-y-2 mb-3">
                              {c.options.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nenhuma opção ainda. Adicione abaixo.</p>
                              ) : (
                                c.options.map((opt) => (
                                  <div
                                    key={opt.id}
                                    className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2.5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-orange-500">
                                          {c.options.indexOf(opt) + 1}
                                        </span>
                                      </div>
                                      <span className="text-sm font-semibold text-gray-800">{opt.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={`text-sm font-black ${Number(opt.price) > 0 ? "text-orange-500" : "text-gray-400"}`}>
                                        {Number(opt.price) > 0 ? `+R$ ${Number(opt.price).toFixed(2)}` : "Grátis"}
                                      </span>
                                      <button
                                        onClick={() => deleteOption(c.id, opt.id)}
                                        className="text-gray-300 hover:text-red-400 transition"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add option inline */}
                            <div className="flex gap-2">
                              <input
                                placeholder="Nome da opção (ex: Catupiry)"
                                value={optForm[c.id]?.name ?? ""}
                                onChange={(e) =>
                                  setOptForm((p) => ({ ...p, [c.id]: { ...p[c.id], name: e.target.value } }))
                                }
                                onKeyDown={(e) => e.key === "Enter" && addOption(c.id)}
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary"
                              />
                              <div className="relative w-28">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">+R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0,00"
                                  value={optForm[c.id]?.price ?? ""}
                                  onChange={(e) =>
                                    setOptForm((p) => ({ ...p, [c.id]: { ...p[c.id], price: e.target.value } }))
                                  }
                                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary"
                                />
                              </div>
                              <button
                                onClick={() => addOption(c.id)}
                                className="px-3 py-2 bg-primary text-white rounded-xl text-sm font-bold transition"
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal create/edit ──────────────────────────────────────────────────── */}
      {modal !== "none" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-black text-gray-900">
                {modal === "create" ? "Novo Complemento" : "Editar Complemento"}
              </h2>
              <button onClick={() => setModal("none")} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Produto */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Produto</label>
                <select
                  value={form.productId ?? ""}
                  onChange={(e) => setForm({ ...form, productId: e.target.value || null })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="">— Global (todos os produtos) —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Nome do complemento *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Borda recheada, Talheres, Bebida…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TYPE_META) as ComplementType[]).map((t) => {
                    const meta = TYPE_META[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, type: t })}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                          form.type === t
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {meta.icon} {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opções de quantidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Mínimo de opções</label>
                  <input
                    type="number" min={0} max={99}
                    value={form.minOptions}
                    onChange={(e) => setForm({ ...form, minOptions: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Máximo de opções</label>
                  <input
                    type="number" min={1} max={99}
                    value={form.maxOptions}
                    onChange={(e) => setForm({ ...form, maxOptions: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <Toggle
                  label="Obrigatório"
                  desc="Cliente deve escolher ao menos uma opção"
                  value={form.required}
                  onChange={(v) => setForm({ ...form, required: v, minOptions: v ? Math.max(1, form.minOptions) : 0 })}
                />
                <Toggle
                  label="Múltipla escolha"
                  desc="Cliente pode escolher mais de uma opção"
                  value={form.multipleChoice}
                  onChange={(v) => setForm({ ...form, multipleChoice: v })}
                />
                <Toggle
                  label="Cobra adicional"
                  desc="Preço das opções soma ao total do pedido"
                  value={form.chargesExtra}
                  onChange={(v) => setForm({ ...form, chargesExtra: v })}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setModal("none")}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveComplement}
                disabled={saving}
                className="flex-1 bg-primary disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition"
              >
                <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Toggle helper ──────────────────────────────────────────────────────────────

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-gray-300"}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
