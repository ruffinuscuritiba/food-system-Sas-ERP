"use client";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Store, Layout, ChevronUp, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Palette, Columns, CircleDot, Copy,
  Check, LayoutGrid, LayoutList,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  businessSegment?: string;
  layoutType?: string;
  buttonRadius?: string;
  plan?: string;
}

interface LayoutBlock {
  id: "banner" | "categories" | "featured" | "products";
  label: string;
  visible: boolean;
  order: number;
}

interface LayoutConfig {
  layoutType: "GRID" | "LIST";
  buttonRadius: "SM" | "MD" | "LG" | "FULL";
  blocks: LayoutBlock[];
}

// ─── Default segments ─────────────────────────────────────────────────────────

const DEFAULT_BLOCKS: LayoutBlock[] = [
  { id: "banner",     label: "🖼️ Banner",      visible: true,  order: 0 },
  { id: "categories", label: "📂 Categorias",  visible: true,  order: 1 },
  { id: "featured",   label: "⭐ Destaques",   visible: false, order: 2 },
  { id: "products",   label: "🛒 Produtos",    visible: true,  order: 3 },
];

const SEGMENT_TEMPLATES: Record<string, LayoutConfig> = {
  PIZZARIA: {
    layoutType: "GRID", buttonRadius: "MD",
    blocks: [
      { id: "banner",     label: "🖼️ Banner",     visible: true,  order: 0 },
      { id: "categories", label: "📂 Categorias", visible: true,  order: 1 },
      { id: "products",   label: "🛒 Produtos",   visible: true,  order: 2 },
      { id: "featured",   label: "⭐ Destaques",  visible: false, order: 3 },
    ],
  },
  LANCHONETE: {
    layoutType: "GRID", buttonRadius: "LG",
    blocks: [
      { id: "banner",     label: "🖼️ Banner",     visible: true, order: 0 },
      { id: "featured",   label: "⭐ Destaques",  visible: true, order: 1 },
      { id: "categories", label: "📂 Categorias", visible: true, order: 2 },
      { id: "products",   label: "🛒 Produtos",   visible: true, order: 3 },
    ],
  },
  PADARIA: {
    layoutType: "LIST", buttonRadius: "SM",
    blocks: [
      { id: "featured",   label: "⭐ Destaques",  visible: true, order: 0 },
      { id: "categories", label: "📂 Categorias", visible: true, order: 1 },
      { id: "banner",     label: "🖼️ Banner",     visible: true, order: 2 },
      { id: "products",   label: "🛒 Produtos",   visible: true, order: 3 },
    ],
  },
  CONVENIENCIA: {
    layoutType: "GRID", buttonRadius: "FULL",
    blocks: [
      { id: "categories", label: "📂 Categorias", visible: true,  order: 0 },
      { id: "products",   label: "🛒 Produtos",   visible: true,  order: 1 },
      { id: "featured",   label: "⭐ Destaques",  visible: true,  order: 2 },
      { id: "banner",     label: "🖼️ Banner",     visible: false, order: 3 },
    ],
  },
  MERCADO: {
    layoutType: "LIST", buttonRadius: "MD",
    blocks: [
      { id: "categories", label: "📂 Categorias", visible: true,  order: 0 },
      { id: "featured",   label: "⭐ Destaques",  visible: true,  order: 1 },
      { id: "products",   label: "🛒 Produtos",   visible: true,  order: 2 },
      { id: "banner",     label: "🖼️ Banner",     visible: false, order: 3 },
    ],
  },
  RESTAURANTE: {
    layoutType: "LIST", buttonRadius: "MD",
    blocks: [
      { id: "banner",     label: "🖼️ Banner",     visible: true, order: 0 },
      { id: "categories", label: "📂 Categorias", visible: true, order: 1 },
      { id: "products",   label: "🛒 Produtos",   visible: true, order: 2 },
      { id: "featured",   label: "⭐ Destaques",  visible: true, order: 3 },
    ],
  },
};

const RADIUS_OPTIONS = [
  { value: "SM",   label: "Quadrado",    preview: "rounded-sm" },
  { value: "MD",   label: "Suave",       preview: "rounded-md" },
  { value: "LG",   label: "Arredondado", preview: "rounded-lg" },
  { value: "FULL", label: "Pílula",      preview: "rounded-full" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function sortedBlocks(blocks: LayoutBlock[]) {
  return [...blocks].sort((a, b) => a.order - b.order);
}

function getSaToken() {
  if (typeof window === "undefined") return "";
  try {
    return JSON.parse(localStorage.getItem("sa_session") ?? "{}").token ?? "";
  } catch { return ""; }
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
}

// ─── Mini preview ─────────────────────────────────────────────────────────────

function LayoutPreview({ config }: { config: LayoutConfig }) {
  const sorted = sortedBlocks(config.blocks).filter(b => b.visible);
  const radiusMap: Record<string, string> = {
    SM: "rounded", MD: "rounded-md", LG: "rounded-xl", FULL: "rounded-full",
  };
  const radius = radiusMap[config.buttonRadius] ?? "rounded-md";

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 text-xs font-medium w-full max-w-[200px]">
      <div className="bg-gray-100 px-2 py-1 flex items-center gap-1 text-gray-400">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
        <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        <span className="ml-1 text-[9px]">Cardápio Digital</span>
      </div>
      <div className="p-2 space-y-1.5">
        {sorted.map((b) => (
          <div key={b.id} className={`w-full py-1 px-2 text-center text-[9px] ${
            b.id === "banner"     ? "bg-gray-200 text-gray-500 h-8 flex items-center justify-center" :
            b.id === "categories" ? "bg-blue-100 text-blue-600" :
            b.id === "featured"   ? "bg-amber-100 text-amber-600" :
                                    "bg-orange-100 text-orange-600"
          } ${radius}`}>
            {b.label}
          </div>
        ))}
        {config.layoutType === "GRID" ? (
          <div className="grid grid-cols-2 gap-1 mt-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`bg-orange-50 border border-orange-200 h-6 ${radius}`} />
            ))}
          </div>
        ) : (
          <div className="space-y-1 mt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`bg-orange-50 border border-orange-200 h-4 w-full ${radius}`} />
            ))}
          </div>
        )}
        <div className={`bg-orange-400 text-white text-[9px] text-center py-0.5 mt-1 ${radius}`}>
          Ver pedido
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConstrutorPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [config, setConfig] = useState<LayoutConfig>({
    layoutType: "LIST",
    buttonRadius: "MD",
    blocks: DEFAULT_BLOCKS,
  });
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const saToken = getSaToken();
  const apiBase = getApiBase();

  // Load companies
  useEffect(() => {
    fetch(`${apiBase}/company`, {
      headers: { Authorization: `Bearer ${saToken}` },
    })
      .then(r => r.json())
      .then((data: Company[]) => {
        const filtered = data.filter(c => !c.id.startsWith("demo-"));
        setCompanies(filtered);
        if (filtered.length > 0) setSelectedId(filtered[0].id);
      })
      .catch(() => toast.error("Erro ao carregar empresas"));
  }, []);

  // Load company layout when selection changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/company/layout/public?companyId=${selectedId}`).then(r => r.json()),
      fetch(`${apiBase}/company/settings`, {
        headers: { Authorization: `Bearer ${saToken}` },
      }).then(r => r.json()),
    ])
      .then(([layout, settings]) => {
        const raw = layout?.layoutConfig as (LayoutConfig & { googleReviewUrl?: string }) | null;
        setGoogleReviewUrl(layout?.googleReviewUrl ?? settings?.googleReviewUrl ?? "");
        if (raw && raw.blocks && raw.blocks.length > 0) {
          setConfig({
            layoutType: raw.layoutType ?? layout?.layoutType ?? "LIST",
            buttonRadius: raw.buttonRadius ?? layout?.buttonRadius ?? "MD",
            blocks: raw.blocks,
          });
        } else {
          // No config yet — use segment template or default
          const seg = companies.find(c => c.id === selectedId)?.businessSegment ?? "RESTAURANTE";
          const tpl = SEGMENT_TEMPLATES[seg] ?? SEGMENT_TEMPLATES["RESTAURANTE"];
          setConfig({
            layoutType: layout?.layoutType ?? tpl.layoutType,
            buttonRadius: layout?.buttonRadius ?? tpl.buttonRadius,
            blocks: tpl.blocks,
          });
        }
      })
      .catch(() => toast.error("Erro ao carregar layout"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // Move block up/down
  const moveBlock = useCallback((idx: number, dir: -1 | 1) => {
    const sorted = sortedBlocks(config.blocks);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const newBlocks = sorted.map((b, i) => ({
      ...b,
      order: i === idx ? target : i === target ? idx : b.order,
    }));
    setConfig(c => ({ ...c, blocks: newBlocks }));
  }, [config.blocks]);

  const toggleVisible = useCallback((id: string) => {
    setConfig(c => ({
      ...c,
      blocks: c.blocks.map(b => b.id === id ? { ...b, visible: !b.visible } : b),
    }));
  }, []);

  const applyTemplate = (seg: string) => {
    const tpl = SEGMENT_TEMPLATES[seg];
    if (tpl) setConfig({ ...tpl });
    toast.success(`Template "${seg}" aplicado`);
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await fetch(`${apiBase}/layout-templates/company/${selectedId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${saToken}`,
        },
        body: JSON.stringify(config),
      });
      // Also save googleReviewUrl via company settings — uses company's own token would be needed
      // For super-admin: direct company update endpoint
      if (googleReviewUrl !== undefined) {
        await fetch(`${apiBase}/company/${selectedId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${saToken}`,
          },
          body: JSON.stringify({ googleReviewUrl }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Layout salvo com sucesso!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!customTemplateName.trim()) {
      toast.error("Dê um nome ao template");
      return;
    }
    setSavingTemplate(true);
    try {
      await fetch(`${apiBase}/layout-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${saToken}`,
        },
        body: JSON.stringify({ name: customTemplateName, config }),
      });
      setCustomTemplateName("");
      toast.success("Template salvo na biblioteca!");
    } catch {
      toast.error("Erro ao salvar template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const sorted = sortedBlocks(config.blocks);
  const selectedCompany = companies.find(c => c.id === selectedId);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layout size={24} className="text-orange-400" />
              Construtor de Lojas
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Personalize o layout e aparência do cardápio digital de cada loja
            </p>
          </div>
          <a
            href="/super-admin/dashboard"
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 border border-slate-700 rounded-lg transition"
          >
            ← Dashboard
          </a>
        </div>

        {/* Company selector */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
          <label className="text-xs text-slate-400 font-semibold mb-2 block">
            Selecionar empresa
          </label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.businessSegment ? `(${c.businessSegment})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Carregando configurações...
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left — Controls */}
            <div className="xl:col-span-2 space-y-5">

              {/* Quick templates */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <Store size={14} className="text-orange-400" />
                  Templates por Segmento
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.keys(SEGMENT_TEMPLATES).map(seg => (
                    <button
                      key={seg}
                      onClick={() => applyTemplate(seg)}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                        selectedCompany?.businessSegment === seg
                          ? "border-orange-500 bg-orange-900/20 text-orange-300"
                          : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </section>

              {/* Layout type */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <Columns size={14} className="text-orange-400" />
                  Tipo de Exibição
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "GRID", label: "Grade", icon: <LayoutGrid size={18} />, desc: "Cards em colunas (2–4)" },
                    { value: "LIST", label: "Lista", icon: <LayoutList size={18} />, desc: "Itens em linha horizontal" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, layoutType: opt.value as "GRID" | "LIST" }))}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition ${
                        config.layoutType === opt.value
                          ? "border-orange-500 bg-orange-900/20 text-white"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {opt.icon}
                      <div className="text-left">
                        <p className="font-semibold text-sm">{opt.label}</p>
                        <p className="text-xs opacity-70">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Button radius */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <CircleDot size={14} className="text-orange-400" />
                  Formato dos Botões
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RADIUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, buttonRadius: opt.value as LayoutConfig["buttonRadius"] }))}
                      className={`p-3 border transition text-center ${opt.preview} ${
                        config.buttonRadius === opt.value
                          ? "border-orange-500 bg-orange-900/20 text-orange-300"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <span className="text-xs font-semibold block">{opt.label}</span>
                      <span className={`mt-2 block h-5 bg-orange-400 ${opt.preview}`} />
                    </button>
                  ))}
                </div>
              </section>

              {/* Block order */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-1 flex items-center gap-2">
                  <Palette size={14} className="text-orange-400" />
                  Ordem dos Blocos
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Use as setas para reorganizar como o cardápio digital será exibido para o cliente
                </p>
                <div className="space-y-2">
                  {sorted.map((block, idx) => (
                    <div
                      key={block.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                        block.visible
                          ? "border-slate-600 bg-slate-800"
                          : "border-slate-700/50 bg-slate-800/50 opacity-50"
                      }`}
                    >
                      <span className="text-lg w-6 text-center select-none">{block.label.split(" ")[0]}</span>
                      <span className="flex-1 text-sm font-medium text-slate-200">
                        {block.label.split(" ").slice(1).join(" ")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveBlock(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveBlock(idx, 1)}
                          disabled={idx === sorted.length - 1}
                          className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => toggleVisible(block.id)}
                          className={`p-1.5 rounded-lg transition ${
                            block.visible
                              ? "hover:bg-slate-700 text-slate-300"
                              : "text-slate-500 hover:bg-slate-700"
                          }`}
                          title={block.visible ? "Ocultar bloco" : "Exibir bloco"}
                        >
                          {block.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Google Review URL */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-1 flex items-center gap-2">
                  ⭐ Link de Avaliação Google
                </h2>
                <p className="text-xs text-slate-500 mb-3">
                  Após cada entrega, o sistema envia automaticamente este link por WhatsApp para o cliente
                </p>
                <input
                  value={googleReviewUrl}
                  onChange={e => setGoogleReviewUrl(e.target.value)}
                  placeholder="https://g.page/r/..."
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                {googleReviewUrl && (
                  <p className="text-xs text-green-400 mt-1">
                    ✓ Enviado automaticamente via WhatsApp após entrega
                  </p>
                )}
              </section>

              {/* Save as template */}
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <Copy size={14} className="text-orange-400" />
                  Salvar como Template
                </h2>
                <div className="flex gap-2">
                  <input
                    value={customTemplateName}
                    onChange={e => setCustomTemplateName(e.target.value)}
                    placeholder="Nome do template (ex: Pizza Premium)"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={saveAsTemplate}
                    disabled={savingTemplate || !customTemplateName.trim()}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-sm font-medium transition"
                  >
                    {savingTemplate ? "..." : "Salvar"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Templates salvos ficam disponíveis para aplicar em outras lojas
                </p>
              </section>

              {/* Save button */}
              <button
                onClick={save}
                disabled={saving || !selectedId}
                className="w-full py-3.5 rounded-2xl font-bold text-base transition flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white"
              >
                {saved ? (
                  <><Check size={18} /> Salvo!</>
                ) : saving ? (
                  <><RefreshCw size={18} className="animate-spin" /> Salvando...</>
                ) : (
                  <><Save size={18} /> Salvar Layout da Loja</>
                )}
              </button>
            </div>

            {/* Right — Preview */}
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sticky top-6">
                <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                  <Eye size={14} className="text-orange-400" />
                  Preview do Cardápio
                </h2>
                <div className="flex justify-center">
                  <LayoutPreview config={config} />
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Exibição:</span>
                    <span className="text-white font-medium">
                      {config.layoutType === "GRID" ? "Grade" : "Lista"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Botões:</span>
                    <span className="text-white font-medium">
                      {RADIUS_OPTIONS.find(r => r.value === config.buttonRadius)?.label ?? config.buttonRadius}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blocos visíveis:</span>
                    <span className="text-white font-medium">
                      {config.blocks.filter(b => b.visible).length}/{config.blocks.length}
                    </span>
                  </div>
                </div>

                {selectedCompany && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-500 mb-2">Testar cardápio:</p>
                    <a
                      href={`/menu/${selectedCompany.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2"
                    >
                      Abrir cardápio da loja ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
