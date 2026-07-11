"use client";

/**
 * Página admin de Complementos — Fase B
 *
 * Funcionalidades:
 *  • B1 Herança P > C > G aplicada server-side em GET público (transparente para o cliente)
 *  • B2 Duplicar grupo (botão)
 *  • B3 Upload de imagem por opção (base64 via ImageUploaderPreview)
 *  • B4 Drag-and-drop de grupos + de opções, separado por escopo
 *  • B5 Vínculo explícito: radio "Aplicar a" Produto / Categoria / Global
 *
 * Layout: lista agrupada por escopo (Global, depois por Categoria, depois por Produto).
 * DnD: cada bloco de escopo é uma Droppable separada — não se arrasta entre escopos.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Save, X, ChevronDown, ChevronUp,
  Settings2, Tag, Package, Utensils, ShoppingBag, Info,
  Copy, GripVertical, Image as ImageIcon, FolderTree,
} from "lucide-react";
import { ImageUploaderPreview } from "@/components/ui/ImageUploaderPreview";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

// DnD lazy
const DragDropContext = dynamic(() => import("@hello-pangea/dnd").then((m) => m.DragDropContext), { ssr: false });
const Droppable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Droppable),       { ssr: false }) as any;
const Draggable       = dynamic(() => import("@hello-pangea/dnd").then((m) => m.Draggable),       { ssr: false }) as any;

// ── Types ──────────────────────────────────────────────────────────────────────

type ComplementType = "INGREDIENTES" | "ESPECIFICACOES" | "CROSS_SELL" | "DESCARTAVEIS";
type Scope = "PRODUCT" | "CATEGORY" | "GLOBAL";

interface ComplementOption {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Complement {
  id: string;
  productId:  string | null;
  categoryId: string | null;
  product?:   { id: string; name: string } | null;
  category?:  { id: string; name: string } | null;
  name: string;
  type: ComplementType;
  required: boolean;
  chargesExtra: boolean;
  multipleChoice: boolean;
  minOptions: number;
  maxOptions: number;
  sortOrder: number;
  isActive: boolean;
  options: ComplementOption[];
}

const TYPE_META: Record<ComplementType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  INGREDIENTES:   {
    label: "Ingredientes",   icon: <Utensils size={14} />,    color: "bg-orange-50 text-orange-600 border-orange-100",
    description: "Dê a opção do cliente remover e adicionar ingredientes neste produto, ou escolher entre um grupo de opções.",
  },
  ESPECIFICACOES: {
    label: "Especificações", icon: <Settings2 size={14} />,   color: "bg-blue-50 text-blue-600 border-blue-100",
    description: "Faça perguntas para que o cliente defina melhor o produto e seu modo de preparo.",
  },
  CROSS_SELL:     {
    label: "Cross-sell",     icon: <ShoppingBag size={14} />, color: "bg-purple-50 text-purple-600 border-purple-100",
    description: "Aproveite para sugerir outros produtos e aumentar o valor do pedido.",
  },
  DESCARTAVEIS:   {
    label: "Descartáveis",   icon: <Package size={14} />,     color: "bg-gray-50 text-gray-600 border-gray-200",
    description: "Ao invés de enviar por padrão, economize e ajude o meio ambiente perguntando ao cliente se ele precisa de talheres plásticos, sachês ou embalagens específicas.",
  },
};

function scopeOf(c: Complement): Scope {
  if (c.productId)  return "PRODUCT";
  if (c.categoryId) return "CATEGORY";
  return "GLOBAL";
}

const EMPTY_FORM = () => ({
  productId:      null as string | null,
  categoryId:     null as string | null,
  name:           "",
  type:           "INGREDIENTES" as ComplementType,
  required:       false,
  chargesExtra:   true,
  multipleChoice: false,
  minOptions:     0,
  maxOptions:     1,
  isActive:       true,
});

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ComplementsPage() {
  useNavKeyGuard("complements");
  const [complements, setComplements] = useState<Complement[]>([]);
  const [products,    setProducts]    = useState<any[]>([]);
  const [categories,  setCategories]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [modal, setModal]     = useState<"none" | "create" | "edit">("none");
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState(EMPTY_FORM());
  const [formScope, setFormScope] = useState<Scope>("GLOBAL");
  const [saving, setSaving]   = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);

  // option add form (por grupo) + imageUrl
  const [optForm, setOptForm] = useState<Record<string, { name: string; price: string; imageUrl: string | null }>>({});

  // ── Data ─────────────────────────────────────────────────────────────────────

  const fetchComplements = useCallback(async () => {
    try {
      const r = await api.get("/complements");
      setComplements(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error("Erro ao carregar complementos"); }
    finally { setLoading(false); }
  }, []);
  const fetchProducts   = useCallback(async () => { try { const r = await api.get("/products");   setProducts(r.data || []); } catch {} }, []);
  const fetchCategories = useCallback(async () => { try { const r = await api.get("/categories"); setCategories(r.data || []); } catch {} }, []);

  useEffect(() => { fetchComplements(); fetchProducts(); fetchCategories(); }, [fetchComplements, fetchProducts, fetchCategories]);

  // ── Agrupamento por escopo (para exibição) ───────────────────────────────────

  type Bucket = { key: string; label: string; scope: Scope; items: Complement[] };

  const buckets = useMemo<Bucket[]>(() => {
    const out: Bucket[] = [];
    const global   = complements.filter((c) => scopeOf(c) === "GLOBAL");
    const byCat    = new Map<string, Complement[]>();
    const byProd   = new Map<string, Complement[]>();
    for (const c of complements) {
      if (scopeOf(c) === "CATEGORY") {
        const arr = byCat.get(c.categoryId!) ?? []; arr.push(c); byCat.set(c.categoryId!, arr);
      }
      if (scopeOf(c) === "PRODUCT") {
        const arr = byProd.get(c.productId!) ?? []; arr.push(c); byProd.set(c.productId!, arr);
      }
    }
    if (global.length) out.push({ key: "GLOBAL", label: "Global — aparece em todos os produtos", scope: "GLOBAL", items: global });
    for (const [catId, items] of byCat) {
      const cat = categories.find((x) => x.id === catId);
      out.push({ key: `C:${catId}`, label: `Categoria: ${cat?.name ?? catId}`, scope: "CATEGORY", items });
    }
    for (const [prodId, items] of byProd) {
      const p = products.find((x) => x.id === prodId);
      out.push({ key: `P:${prodId}`, label: `Produto: ${p?.name ?? prodId}`, scope: "PRODUCT", items });
    }
    return out;
  }, [complements, categories, products]);

  // ── CRUD grupo ───────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_FORM());
    setFormScope("GLOBAL");
    setEditId(null);
    setModal("create");
  }

  function openEdit(c: Complement) {
    setForm({
      productId: c.productId, categoryId: c.categoryId,
      name: c.name, type: c.type,
      required: c.required, chargesExtra: c.chargesExtra, multipleChoice: c.multipleChoice,
      minOptions: c.minOptions, maxOptions: c.maxOptions, isActive: c.isActive,
    });
    setFormScope(scopeOf(c));
    setEditId(c.id);
    setModal("edit");
  }

  async function saveComplement() {
    if (!form.name.trim()) return toast.error("Informe o nome");

    // Coerência min/max (mantida da Fase A)
    if (form.maxOptions < 1) return toast.error("Máximo deve ser ≥ 1");
    if (form.minOptions < 0) return toast.error("Mínimo não pode ser negativo");
    if (form.minOptions > form.maxOptions) return toast.error("Mínimo não pode ser maior que máximo");
    if (form.required && form.minOptions < 1) return toast.error("Obrigatório exige mínimo ≥ 1");
    if (!form.multipleChoice && form.maxOptions !== 1) return toast.error('Escolha única exige máximo = 1');

    // Escopo exclusivo (frontend + backend valida)
    const payload: any = { ...form };
    if (formScope === "PRODUCT")  { payload.productId  = form.productId;  payload.categoryId = null; if (!payload.productId)  return toast.error("Selecione o produto"); }
    if (formScope === "CATEGORY") { payload.categoryId = form.categoryId; payload.productId  = null; if (!payload.categoryId) return toast.error("Selecione a categoria"); }
    if (formScope === "GLOBAL")   { payload.productId  = null; payload.categoryId = null; }

    setSaving(true);
    try {
      if (modal === "create") {
        const r = await api.post("/complements", payload);
        // Abre a seção de opções (nome + valor) direto, sem precisar de outro clique.
        if (r?.data?.id) setExpanded(r.data.id);
      } else {
        await api.patch(`/complements/${editId}`, payload);
      }
      toast.success(modal === "create" ? "Grupo criado! Adicione as opções abaixo." : "Atualizado!");
      setModal("none");
      fetchComplements();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function deleteComplement(id: string) {
    if (!confirm("Excluir este grupo?")) return;
    try { await api.delete(`/complements/${id}`); toast.success("Removido"); fetchComplements(); }
    catch { toast.error("Erro ao remover"); }
  }

  // B2 — duplicate
  async function duplicateGroup(id: string) {
    try {
      await api.post(`/complements/${id}/duplicate`);
      toast.success("Grupo duplicado!");
      fetchComplements();
    } catch { toast.error("Erro ao duplicar"); }
  }

  // ── Options ──────────────────────────────────────────────────────────────────

  async function addOption(complementId: string) {
    const f = optForm[complementId];
    if (!f?.name?.trim()) return toast.error("Nome obrigatório");
    const payload: any = { name: f.name.trim(), price: Number(f.price || 0) };
    if (f.imageUrl) payload.imageUrl = f.imageUrl;
    try {
      await api.post(`/complements/${complementId}/options`, payload);
      setOptForm((p) => ({ ...p, [complementId]: { name: "", price: "", imageUrl: null } }));
      fetchComplements();
    } catch { toast.error("Erro ao adicionar opção"); }
  }

  async function deleteOption(complementId: string, optionId: string) {
    try { await api.delete(`/complements/${complementId}/options/${optionId}`); fetchComplements(); }
    catch { toast.error("Erro ao remover opção"); }
  }

  // ── B4 — DnD ─────────────────────────────────────────────────────────────────

  async function handleGroupsDragEnd(bucketKey: string, result: any) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const bucket = buckets.find((b) => b.key === bucketKey);
    if (!bucket) return;
    const next = Array.from(bucket.items);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);

    // Otimista
    const newComplements = complements.map((c) => {
      const idx = next.findIndex((x) => x.id === c.id);
      return idx >= 0 ? { ...c, sortOrder: idx + 1 } : c;
    });
    setComplements(newComplements);

    try {
      await api.patch("/complements/reorder", {
        items: next.map((g, i) => ({ id: g.id, sortOrder: i + 1 })),
      });
    } catch { toast.error("Erro ao reordenar"); fetchComplements(); }
  }

  async function handleOptionsDragEnd(complementId: string, result: any) {
    if (!result.destination || result.destination.index === result.source.index) return;
    const group = complements.find((c) => c.id === complementId);
    if (!group) return;
    const next = Array.from(group.options);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);

    setComplements((prev) => prev.map((c) => c.id === complementId ? { ...c, options: next } : c));

    try {
      await api.patch(`/complements/${complementId}/options/reorder`, {
        items: next.map((o, i) => ({ id: o.id, sortOrder: i + 1 })),
      });
    } catch { toast.error("Erro ao reordenar opções"); fetchComplements(); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl"><Settings2 size={20} className="text-white" /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Complementos</h1>
              <p className="text-gray-400 text-sm">{complements.length} grupo{complements.length !== 1 ? "s" : ""} cadastrado{complements.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-primary/20 min-h-[44px]">
            <Plus size={16} /> Novo Grupo
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700">
            <strong>Hierarquia P &gt; C &gt; G:</strong> grupos do <b>produto</b> sobrescrevem os da <b>categoria</b>, que sobrescrevem os <b>globais</b>.
            Conflito é resolvido pelo nome do grupo (case-insensitive). Cliente final vê apenas o vencedor.
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          </div>
        ) : buckets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Settings2 size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-semibold">Nenhum grupo cadastrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {buckets.map((bucket) => (
              <div key={bucket.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className={`px-5 py-3 border-b border-gray-100 flex items-center gap-2 ${
                  bucket.scope === "GLOBAL"   ? "bg-purple-50"  :
                  bucket.scope === "CATEGORY" ? "bg-blue-50"    :
                                                "bg-orange-50"
                }`}>
                  <FolderTree size={14} className={
                    bucket.scope === "GLOBAL" ? "text-purple-500" : bucket.scope === "CATEGORY" ? "text-blue-500" : "text-orange-500"
                  } />
                  <span className={`text-sm font-bold ${
                    bucket.scope === "GLOBAL" ? "text-purple-700" : bucket.scope === "CATEGORY" ? "text-blue-700" : "text-orange-700"
                  }`}>{bucket.label}</span>
                  <span className="ml-auto text-xs text-gray-500">{bucket.items.length} grupo{bucket.items.length !== 1 ? "s" : ""}</span>
                </div>

                <DragDropContext onDragEnd={(r: any) => handleGroupsDragEnd(bucket.key, r)}>
                  <Droppable droppableId={`groups-${bucket.key}`}>
                    {(dropProv: any) => (
                      <div ref={dropProv.innerRef} {...dropProv.droppableProps} className="divide-y divide-gray-50">
                        {bucket.items.map((c, idx) => {
                          const meta = TYPE_META[c.type];
                          const isExp = expanded === c.id;
                          return (
                            <Draggable key={c.id} draggableId={c.id} index={idx}>
                              {(dProv: any, snap: any) => (
                                <div ref={dProv.innerRef} {...dProv.draggableProps} className={snap.isDragging ? "bg-orange-50" : ""}>
                                  <div className="px-4 py-4 flex items-start gap-3">
                                    <div {...dProv.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mt-1 touch-none" title="Arrastar">
                                      <GripVertical size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.icon} {meta.label}</span>
                                        {c.required && <span className="text-xs font-bold bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">Obrigatório</span>}
                                        {c.multipleChoice && <span className="text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">Múltipla</span>}
                                      </div>
                                      <p className="text-xs text-gray-400">
                                        {c.minOptions}–{c.maxOptions} opções • {c.chargesExtra ? "cobra adicional" : "sem cobrança"} • {c.options.length} opção{c.options.length !== 1 ? "ões" : ""}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button onClick={() => duplicateGroup(c.id)} title="Duplicar" className="w-9 h-9 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center min-h-[44px] min-w-[44px]"><Copy size={14} /></button>
                                      <button onClick={() => openEdit(c)} className="text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium border border-gray-200 min-h-[44px]">Editar</button>
                                      <button onClick={() => deleteComplement(c.id)} className="w-9 h-9 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center min-h-[44px] min-w-[44px]"><Trash2 size={14} /></button>
                                      <button onClick={() => setExpanded(isExp ? null : c.id)} title="Opções" className="w-9 h-9 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-500 flex items-center justify-center min-h-[44px] min-w-[44px]">{isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                                    </div>
                                  </div>

                                  {isExp && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                                      <p className="text-xs font-bold text-gray-500 mb-3">Opções do grupo</p>

                                      {c.options.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic mb-3">Nenhuma opção ainda.</p>
                                      ) : (
                                        <DragDropContext onDragEnd={(r: any) => handleOptionsDragEnd(c.id, r)}>
                                          <Droppable droppableId={`opts-${c.id}`}>
                                            {(odp: any) => (
                                              <div ref={odp.innerRef} {...odp.droppableProps} className="space-y-2 mb-3">
                                                {c.options.map((opt, oi) => (
                                                  <Draggable key={opt.id} draggableId={opt.id} index={oi}>
                                                    {(odprov: any, osnap: any) => (
                                                      <div
                                                        ref={odprov.innerRef}
                                                        {...odprov.draggableProps}
                                                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 min-h-[56px] ${
                                                          osnap.isDragging ? "bg-orange-50 border-primary" : "bg-white border-gray-100"
                                                        }`}
                                                      >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                          <div {...odprov.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"><GripVertical size={14} /></div>
                                                          {opt.imageUrl ? (
                                                            <img src={opt.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                                                          ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0"><ImageIcon size={14} className="text-gray-300" /></div>
                                                          )}
                                                          <span className="text-sm font-semibold text-gray-800 truncate">{opt.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                          <span className={`text-sm font-black ${Number(opt.price) > 0 ? "text-orange-500" : "text-gray-400"}`}>
                                                            {Number(opt.price) > 0 ? `+R$ ${Number(opt.price).toFixed(2)}` : "Grátis"}
                                                          </span>
                                                          <button onClick={() => deleteOption(c.id, opt.id)} className="text-gray-300 hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center"><Trash2 size={14} /></button>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                ))}
                                                {odp.placeholder}
                                              </div>
                                            )}
                                          </Droppable>
                                        </DragDropContext>
                                      )}

                                      {/* Add option (com upload de imagem) */}
                                      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
                                          <input
                                            placeholder="Nome da opção"
                                            value={optForm[c.id]?.name ?? ""}
                                            onChange={(e) => setOptForm((p) => ({ ...p, [c.id]: { ...(p[c.id] ?? { name: "", price: "", imageUrl: null }), name: e.target.value } }))}
                                            onKeyDown={(e) => e.key === "Enter" && addOption(c.id)}
                                            className="border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]"
                                          />
                                          <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">+R$</span>
                                            <input type="number" step="0.01" min="0" placeholder="0,00"
                                              value={optForm[c.id]?.price ?? ""}
                                              onChange={(e) => setOptForm((p) => ({ ...p, [c.id]: { ...(p[c.id] ?? { name: "", price: "", imageUrl: null }), price: e.target.value } }))}
                                              className="w-full border border-gray-200 rounded-xl pl-10 pr-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]"
                                            />
                                          </div>
                                          <button onClick={() => addOption(c.id)} className="px-4 bg-primary text-white rounded-xl text-sm font-bold min-h-[44px]"><Plus size={16} /></button>
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Imagem (opcional)</p>
                                          <ImageUploaderPreview
                                            value={optForm[c.id]?.imageUrl ?? null}
                                            onChange={(v) => setOptForm((p) => ({ ...p, [c.id]: { ...(p[c.id] ?? { name: "", price: "", imageUrl: null }), imageUrl: v } }))}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {dropProv.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal create/edit ───────────────────────────────────────────────── */}
      {modal !== "none" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-black text-gray-900">{modal === "create" ? "Novo Grupo" : "Editar Grupo"}</h2>
              <button onClick={() => setModal("none")} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* B5 — Escopo: Aplicar a */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Aplicar a *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["GLOBAL", "CATEGORY", "PRODUCT"] as Scope[]).map((s) => (
                    <button key={s} type="button" onClick={() => setFormScope(s)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-semibold min-h-[44px] ${
                        formScope === s ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-500"
                      }`}>
                      {s === "GLOBAL" ? "🌐 Global" : s === "CATEGORY" ? "📂 Categoria" : "🍔 Produto"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {formScope === "GLOBAL"   && "Aparece em todos os produtos da empresa."}
                  {formScope === "CATEGORY" && "Aparece em todos os produtos de uma categoria."}
                  {formScope === "PRODUCT"  && "Aparece apenas em um produto específico."}
                </p>
              </div>

              {formScope === "PRODUCT" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Produto *</label>
                  <select value={form.productId ?? ""} onChange={(e) => setForm({ ...form, productId: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]">
                    <option value="">— Selecione —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {formScope === "CATEGORY" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Categoria *</label>
                  <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || null })}
                    className="w-full border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]">
                    <option value="">— Selecione —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Nome do grupo *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Adicionais, Bordas, Ponto da carne…"
                  className="w-full border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Tipo</label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(TYPE_META) as ComplementType[]).map((t) => {
                    const meta = TYPE_META[t];
                    return (
                      <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left ${
                          form.type === t ? "border-primary bg-primary/5" : "border-gray-200"
                        }`}>
                        <span className={form.type === t ? "text-primary mt-0.5" : "text-gray-400 mt-0.5"}>{meta.icon}</span>
                        <span>
                          <span className={`block text-sm font-semibold ${form.type === t ? "text-primary" : "text-gray-700"}`}>{meta.label}</span>
                          <span className="block text-xs text-gray-500 mt-0.5">{meta.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Mínimo</label>
                  <input type="number" min={0} max={99} value={form.minOptions}
                    onChange={(e) => {
                      const newMin = Number(e.target.value);
                      const newMax = Math.max(form.maxOptions, newMin);
                      setForm({
                        ...form,
                        minOptions: newMin,
                        maxOptions: newMax,
                        multipleChoice: newMin > 1 ? true : form.multipleChoice,
                      });
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Máximo</label>
                  <input type="number" min={1} max={99} value={form.maxOptions}
                    onChange={(e) => {
                      const newMax = Math.max(1, Number(e.target.value));
                      setForm({
                        ...form,
                        maxOptions: newMax,
                        // Aumentar o máximo já liga "múltipla escolha" sozinho —
                        // antes o campo ficava travado até o toggle lá embaixo ser ativado.
                        multipleChoice: newMax > 1 ? true : form.multipleChoice,
                      });
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 text-sm text-gray-900 focus:outline-none focus:border-primary min-h-[44px]" />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <Toggle label="Obrigatório" desc="Cliente deve escolher ao menos uma opção"
                  value={form.required}
                  onChange={(v) => setForm({ ...form, required: v, minOptions: v ? Math.max(1, form.minOptions || 1) : 0 })} />
                <Toggle label="Múltipla escolha" desc="Cliente pode escolher mais de uma opção"
                  value={form.multipleChoice}
                  onChange={(v) => setForm({
                    ...form,
                    multipleChoice: v,
                    maxOptions: v ? Math.max(2, form.maxOptions) : 1,
                    minOptions: v ? form.minOptions : Math.min(form.minOptions, 1),
                  })} />
                <Toggle label="Cobra adicional" desc="Preço das opções soma ao total"
                  value={form.chargesExtra} onChange={(v) => setForm({ ...form, chargesExtra: v })} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setModal("none")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 min-h-[48px]">Cancelar</button>
              <button onClick={saveComplement} disabled={saving} className="flex-1 bg-primary disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 min-h-[48px]">
                <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button type="button" onClick={() => onChange(!value)} className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-gray-300"}`}>
        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
