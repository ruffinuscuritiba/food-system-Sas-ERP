"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChefHat, Pizza, Truck, LayoutGrid, Star, MessageCircle,
  BarChart3, Package, Tag, Zap, RefreshCw, AlertTriangle,
  Check, Loader2, Settings2, ShieldCheck, Users, ChevronRight,
  ToggleLeft, ToggleRight, Grid3x3,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { useCompanyStore } from "@/stores/company.store";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SidebarConfig = Record<string, boolean> | null;

interface CompanyInterface {
  sidebarConfig: SidebarConfig;
  businessSegment: string | null;
}

// ─── Dados estáticos ──────────────────────────────────────────────────────────

/** Perguntas em linguagem do cliente (visão ADMIN/MANAGER) */
const PREFERENCES = [
  {
    id: "mesas",
    icon: "🍽️",
    question: "Você atende clientes em mesas com garçons?",
    hint: "Habilita o módulo de Mesas, Comandas e QR Code de mesa",
    keys: ["tables", "qrcode-mesas"],
  },
  {
    id: "cozinha",
    icon: "👨‍🍳",
    question: "Você tem uma cozinha integrada ao sistema (KDS)?",
    hint: "Exibe o monitor de cozinha onde os pedidos aparecem em tempo real",
    keys: ["kitchen"],
  },
  {
    id: "delivery",
    icon: "🛵",
    question: "Você faz entregas com entregadores próprios?",
    hint: "Ativa o rastreamento de entregadores e o app de rotas",
    keys: ["delivery-tracking"],
  },
  {
    id: "pizza",
    icon: "🍕",
    question: "Você vende pizzas com bordas recheadas?",
    hint: "Exibe o configurador de Bordas Recheadas por tamanho",
    keys: ["pizza-borders"],
  },
  {
    id: "complementos",
    icon: "🧂",
    question: "Seus produtos têm complementos ou adicionais?",
    hint: "Ex: bacon extra, sem cebola, tamanho da batata frita",
    keys: ["complements"],
  },
  {
    id: "estoque",
    icon: "📦",
    question: "Você controla estoque e fichas técnicas de ingredientes?",
    hint: "Habilita Estoque, Ingredientes e Fichas Técnicas no menu",
    keys: ["stock", "ingredients", "recipes"],
  },
  {
    id: "marketing",
    icon: "⭐",
    question: "Você usa programa de fidelidade ou cupons de desconto?",
    hint: "Exibe a seção de Marketing, Fidelidade e Cupons no painel",
    keys: ["marketing"],
  },
  {
    id: "whatsapp",
    icon: "🤖",
    question: "Você usa o WhatsApp IA para atendimento automático?",
    hint: "Exibe o módulo de configuração do robô de atendimento",
    keys: ["whatsapp-ia"],
  },
  {
    id: "bi",
    icon: "📊",
    question: "Você quer ver relatórios de lucratividade e BI?",
    hint: "Exibe a seção de Relatórios, BI e dashboards gerenciais",
    keys: ["bi"],
  },
];

/** Grade técnica completa (visão SUPER_ADMIN / Master) */
const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { key: "pdv",               label: "PDV / Frente de Caixa",       critical: true },
      { key: "orders",            label: "Pedidos",                      critical: true },
      { key: "kitchen",           label: "Cozinha (KDS)",                critical: false },
      { key: "tables",            label: "Mesas",                        critical: false },
      { key: "qrcode-mesas",      label: "QR Code das Mesas",            critical: false },
      { key: "delivery-tracking", label: "Rastreamento de Entrega",      critical: false },
      { key: "historico",         label: "Histórico de Pedidos",         critical: false },
    ],
  },
  {
    label: "Cardápio & Produtos",
    items: [
      { key: "products",     label: "Produtos",                    critical: true  },
      { key: "categories",   label: "Categorias",                  critical: true  },
      { key: "complements",  label: "Complementos / Adicionais",   critical: false },
      { key: "pizza-borders",label: "Bordas Recheadas",            critical: false },
      { key: "smart-import", label: "Importação Inteligente (IA)", critical: false },
    ],
  },
  {
    label: "Estoque & Receitas",
    items: [
      { key: "stock",       label: "Controle de Estoque",   critical: false },
      { key: "ingredients", label: "Ingredientes",           critical: false },
      { key: "recipes",     label: "Fichas Técnicas",        critical: false },
    ],
  },
  {
    label: "Marketing & Atendimento",
    items: [
      { key: "marketing",   label: "Fidelidade & Marketing", critical: false },
      { key: "whatsapp-ia", label: "WhatsApp IA",            critical: false },
    ],
  },
  {
    label: "Financeiro & BI",
    items: [
      { key: "financeiro", label: "Financeiro",       critical: false },
      { key: "bi",         label: "Relatórios & BI",  critical: false },
    ],
  },
];

/** Segmentos + quais chaves ficam ocultas por padrão */
const SEGMENT_HIDDEN: Record<string, string[]> = {
  PIZZARIA:     [],
  RESTAURANTE:  ["pizza-borders"],
  LANCHONETE:   ["pizza-borders"],
  CHURRASCARIA: ["pizza-borders"],
  HOT_DOG:      ["pizza-borders", "tables", "qrcode-mesas"],
  HAMBURGUERIA: ["pizza-borders", "tables", "qrcode-mesas"],
  PASTELARIA:   ["pizza-borders", "tables", "qrcode-mesas"],
  MARMITARIA:   ["pizza-borders", "tables", "qrcode-mesas", "complements"],
  ACAI:         ["pizza-borders", "tables", "qrcode-mesas", "kitchen"],
  PADARIA:      ["pizza-borders", "tables", "qrcode-mesas", "complements"],
  DOCERIA:      ["pizza-borders", "tables", "qrcode-mesas", "complements"],
  CONVENIENCIA: ["pizza-borders", "tables", "qrcode-mesas", "kitchen", "recipes", "ingredients", "complements"],
  MERCADO:      ["pizza-borders", "tables", "qrcode-mesas", "kitchen", "recipes", "ingredients", "complements"],
};

const SEGMENTS_LIST = [
  { value: "RESTAURANTE",  label: "Restaurante",   emoji: "🍽️" },
  { value: "PIZZARIA",     label: "Pizzaria",      emoji: "🍕" },
  { value: "HAMBURGUERIA", label: "Hamburgueria",  emoji: "🍔" },
  { value: "LANCHONETE",   label: "Lanchonete",    emoji: "🥪" },
  { value: "CHURRASCARIA", label: "Churrascaria",  emoji: "🥩" },
  { value: "MARMITARIA",   label: "Marmitaria",    emoji: "🍱" },
  { value: "HOT_DOG",      label: "Hot Dog",       emoji: "🌭" },
  { value: "PASTELARIA",   label: "Pastelaria",    emoji: "🥟" },
  { value: "ACAI",         label: "Açaí",          emoji: "🫐" },
  { value: "PADARIA",      label: "Padaria",       emoji: "🥐" },
  { value: "DOCERIA",      label: "Doceria",       emoji: "🍰" },
  { value: "CONVENIENCIA", label: "Conveniência",  emoji: "🏪" },
  { value: "MERCADO",      label: "Mercado",       emoji: "🛒" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isKeyVisible(config: SidebarConfig, key: string): boolean {
  if (!config) return true; // null = matriz, tudo visível
  return config[key] !== false;
}

function areAllVisible(config: SidebarConfig, keys: string[]): boolean {
  return keys.every((k) => isKeyVisible(config, k));
}

function buildConfigFromSegment(segment: string): Record<string, boolean> {
  const hidden = SEGMENT_HIDDEN[segment] ?? SEGMENT_HIDDEN.RESTAURANTE;
  const cfg: Record<string, boolean> = {};
  for (const k of hidden) cfg[k] = false;
  return cfg;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function InterfaceTab() {
  const { user } = useAuthStore();
  const { setSidebarConfig: setStoreSidebarConfig } = useCompanyStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [config, setConfig] = useState<SidebarConfig>(null);
  const [segment, setSegment] = useState<string>("RESTAURANTE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationStep, setMigrationStep] = useState<0 | 1 | 2 | 3>(0);
  const [pendingSegment, setPendingSegment] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    api
      .get<CompanyInterface>("/company/settings")
      .then((res) => {
        setConfig(res.data.sidebarConfig ?? {});
        setSegment(res.data.businessSegment ?? "RESTAURANTE");
      })
      .catch(() => toast.error("Erro ao carregar configurações"))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  // Auto-save com debounce 600ms
  function scheduleAutoSave(newConfig: SidebarConfig) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.patch("/company/settings", { sidebarConfig: newConfig });
        setStoreSidebarConfig(newConfig as Record<string, boolean>); // guard reage imediatamente
      } catch {
        toast.error("Erro ao salvar preferências");
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  function toggleKeys(keys: string[], visible: boolean) {
    setConfig((prev) => {
      const next = { ...(prev ?? {}) };
      for (const k of keys) {
        if (visible) {
          delete next[k]; // undefined = visível (usa o default)
        } else {
          next[k] = false;
        }
      }
      scheduleAutoSave(next);
      return next;
    });
  }

  // ── Migração de segmento ──
  function startMigration() {
    setPendingSegment(segment);
    setMigrationStep(1);
  }

  async function confirmMigration() {
    const newConfig = buildConfigFromSegment(pendingSegment);
    setSaving(true);
    try {
      await api.patch("/company/settings", {
        businessSegment: pendingSegment,
        sidebarConfig: newConfig,
      });
      setSegment(pendingSegment);
      setConfig(newConfig);
      setMigrationStep(3);
      setTimeout(() => setMigrationStep(0), 2500);
      toast.success("Segmento atualizado — nenhum dado foi alterado");
    } catch {
      toast.error("Erro ao atualizar segmento");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          {isSuperAdmin
            ? <ShieldCheck size={18} className="text-purple-500" />
            : <Settings2 size={18} className="text-orange-500" />
          }
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isSuperAdmin ? "Controle de Interface (Master)" : "Preferências do Painel"}
          </h2>
          {saving && (
            <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Salvando...
            </span>
          )}
          {!saving && config !== null && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
              <Check size={12} /> Sincronizado
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isSuperAdmin
            ? "Acesso total. Você pode ligar/desligar qualquer item da barra lateral sem apagar dados do cliente."
            : "Personalize quais seções aparecem no seu painel. Nenhum dado é apagado ao ocultar uma seção — você pode reativar a qualquer momento."}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          VISÃO ADMIN/MANAGER — Perguntas em linguagem do dia a dia
      ══════════════════════════════════════════════════════════════ */}
      {!isSuperAdmin && (
        <>
          <div className="space-y-3">
            {PREFERENCES.map((pref) => {
              const visible = areAllVisible(config, pref.keys);
              return (
                <button
                  key={pref.id}
                  onClick={() => toggleKeys(pref.keys, !visible)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                    ${visible
                      ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 opacity-70"
                    }`}
                >
                  <span className="text-2xl leading-none">{pref.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${visible ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                      {pref.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{pref.hint}</p>
                  </div>
                  <div className={`flex-shrink-0 transition-colors ${visible ? "text-orange-500" : "text-gray-300 dark:text-gray-600"}`}>
                    {visible
                      ? <ToggleRight size={28} />
                      : <ToggleLeft size={28} />
                    }
                  </div>
                </button>
              );
            })}
          </div>

          {/* Aviso sobre dados */}
          <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <ShieldCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Seus dados estão sempre seguros.</strong> Ocultar uma seção apenas remove o item do menu lateral.
              Produtos, pedidos e histórico financeiro continuam intactos — você pode reativar e tudo volta exatamente como estava.
            </p>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISÃO SUPER_ADMIN — Grade técnica completa
      ══════════════════════════════════════════════════════════════ */}
      {isSuperAdmin && (
        <>
          {/* Grade por grupo */}
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Grid3x3 size={12} /> {group.label}
              </h3>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {group.items.map((item) => {
                  const visible = isKeyVisible(config, item.key);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900"
                    >
                      <code className="text-xs text-gray-400 dark:text-gray-600 font-mono w-36 shrink-0">
                        {item.key}
                      </code>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                        {item.label}
                      </span>
                      {item.critical && (
                        <span className="text-xs bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full mr-1">
                          crítico
                        </span>
                      )}
                      <button
                        onClick={() => !item.critical && toggleKeys([item.key], !visible)}
                        disabled={item.critical}
                        title={item.critical ? "Item crítico — não pode ser desativado" : undefined}
                        className={`flex-shrink-0 transition-colors
                          ${item.critical ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                          ${visible ? "text-orange-500 hover:text-orange-600" : "text-gray-300 dark:text-gray-600 hover:text-gray-400"}
                        `}
                      >
                        {visible ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Migração de Segmento */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <RefreshCw size={12} /> Migração de Segmento
            </h3>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">

              {migrationStep === 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Segmento atual:
                        <span className="ml-2 text-orange-500">
                          {SEGMENTS_LIST.find(s => s.value === segment)?.emoji}{" "}
                          {SEGMENTS_LIST.find(s => s.value === segment)?.label ?? segment}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Alterar o segmento reconfigura a barra lateral com os padrões do novo segmento.
                        Nenhum produto, pedido ou dado financeiro é afetado.
                      </p>
                    </div>
                    <button
                      onClick={startMigration}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                    >
                      <RefreshCw size={14} /> Migrar
                    </button>
                  </div>
                </>
              )}

              {migrationStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <strong>Nenhum dado será apagado.</strong> Apenas a visibilidade do menu lateral será redefinida.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Selecione o novo segmento:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SEGMENTS_LIST.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => { setPendingSegment(s.value); setMigrationStep(2); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all
                          ${s.value === segment
                            ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                            : "border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-gray-700 dark:text-gray-300"
                          }`}
                      >
                        <span>{s.emoji}</span> {s.label}
                        {s.value === segment && <span className="ml-auto text-xs text-gray-400">(atual)</span>}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setMigrationStep(0)}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ← Cancelar
                  </button>
                </div>
              )}

              {migrationStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Você está prestes a migrar de
                    <strong className="text-orange-500 mx-1">
                      {SEGMENTS_LIST.find(s => s.value === segment)?.emoji}{" "}
                      {SEGMENTS_LIST.find(s => s.value === segment)?.label}
                    </strong>
                    para
                    <strong className="text-purple-500 mx-1">
                      {SEGMENTS_LIST.find(s => s.value === pendingSegment)?.emoji}{" "}
                      {SEGMENTS_LIST.find(s => s.value === pendingSegment)?.label}
                    </strong>.
                  </p>

                  {/* Preview do diff */}
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      O que vai mudar na barra lateral:
                    </p>
                    {(() => {
                      const currentHidden = new Set(SEGMENT_HIDDEN[segment] ?? []);
                      const newHidden = new Set(SEGMENT_HIDDEN[pendingSegment] ?? []);
                      const toHide = [...newHidden].filter(k => !currentHidden.has(k));
                      const toShow = [...currentHidden].filter(k => !newHidden.has(k));
                      const allNavKeys = NAV_GROUPS.flatMap(g => g.items);
                      const label = (k: string) => allNavKeys.find(i => i.key === k)?.label ?? k;

                      if (toHide.length === 0 && toShow.length === 0) {
                        return <p className="text-sm text-gray-500">Configuração idêntica — nenhuma mudança visual.</p>;
                      }
                      return (
                        <div className="space-y-1">
                          {toShow.map(k => (
                            <div key={k} className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <Check size={14} /> <span className="font-medium">{label(k)}</span> <span className="text-xs text-gray-400">passará a aparecer</span>
                            </div>
                          ))}
                          {toHide.map(k => (
                            <div key={k} className="flex items-center gap-2 text-sm text-gray-400">
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 inline-block" />
                              <span className="font-medium">{label(k)}</span> <span className="text-xs">será ocultado</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setMigrationStep(1)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={confirmMigration}
                      disabled={saving}
                      className="flex-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirmar Migração"}
                    </button>
                  </div>
                </div>
              )}

              {migrationStep === 3 && (
                <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                  <Check size={20} />
                  <p className="text-sm font-semibold">Migração concluída! Nenhum dado foi alterado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Aviso master */}
          <div className="flex gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <ShieldCheck size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <strong>Acesso Master.</strong> As alterações aplicam-se ao tenant visualizado.
              Itens marcados como <span className="bg-red-100 text-red-600 text-xs px-1.5 rounded-full">crítico</span> não podem ser desativados pois são essenciais para o funcionamento do sistema.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
