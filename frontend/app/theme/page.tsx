"use client";
import { apiBaseUrl } from "@/services/env";
import ImageUpload from "@/components/ImageUpload";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import {
  type PdvThemeConfig, PDV_THEME_DEFAULT, PDV_THEME_PRESETS,
  loadPdvTheme, savePdvTheme, broadcastPdvTheme,
} from "@/lib/pdv-theme";
import { api } from "@/services/api";

// Itens da sidebar que podem ser ligados/desligados
const SIDEBAR_ITEMS: { navKey: string; label: string; emoji: string; section: string; alwaysOn?: boolean }[] = [
  // Operação
  { navKey: "pdv",               label: "PDV / Caixa",        emoji: "💰", section: "Operação" },
  { navKey: "orders",            label: "Pedidos",             emoji: "🛒", section: "Operação" },
  { navKey: "kitchen",           label: "Cozinha",             emoji: "🍳", section: "Operação" },
  { navKey: "delivery-tracking", label: "Rastreamento",        emoji: "📍", section: "Operação" },
  { navKey: "tables",            label: "Mesas",               emoji: "🪑", section: "Operação" },
  // Cardápio
  { navKey: "products",          label: "Produtos",            emoji: "📦", section: "Cardápio" },
  { navKey: "categories",        label: "Categorias",          emoji: "🗂️", section: "Cardápio" },
  { navKey: "complements",       label: "Complementos",        emoji: "➕", section: "Cardápio" },
  { navKey: "pizza-borders",     label: "Pizza / Bordas",      emoji: "🍕", section: "Cardápio" },
  // Estoque
  { navKey: "stock",             label: "Movimentações",       emoji: "📊", section: "Estoque" },
  { navKey: "ingredients",       label: "Ingredientes",        emoji: "🧪", section: "Estoque" },
  { navKey: "recipes",           label: "Receitas",            emoji: "📖", section: "Estoque" },
  // IA
  { navKey: "smart-import",      label: "Cadastro por Imagem", emoji: "✨", section: "IA" },
  { navKey: "marketing",         label: "Marketing Digital",   emoji: "📢", section: "IA" },
  // Atendimento
  { navKey: "whatsapp-ia",       label: "Configurar IA",       emoji: "🤖", section: "Atendimento" },
  // Financeiro
  { navKey: "financeiro",        label: "Financeiro",          emoji: "🏦", section: "Relatórios" },
  { navKey: "bi",                label: "Relatórios / BI",     emoji: "📈", section: "Relatórios" },
  { navKey: "historico",         label: "Histórico de Pedidos",emoji: "📜", section: "Relatórios" },
  { navKey: "qrcode-mesas",      label: "QR Code Mesas",       emoji: "🔲", section: "Relatórios" },
  // Marketplace
  { navKey: "modulos",           label: "Módulos",             emoji: "🧩", section: "Marketplace" },
  { navKey: "integracoes",       label: "Integrações",         emoji: "🔌", section: "Marketplace" },
  { navKey: "impressao",         label: "Impressoras",         emoji: "🖨️", section: "Marketplace" },
  { navKey: "tema",              label: "Tema / Visual",       emoji: "🎨", section: "Marketplace" },
];

/** Converte qualquer cor (hex/rgb/rgba) para #rrggbb — exigido por <input type="color">. */
function toHexColor(c?: string): string {
  if (!c) return "#000000";
  if (c.startsWith("#")) return c.slice(0, 7);
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return "#000000";
}

export default function ThemePage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId;
  const isDemo = user?.role === "DEMO";

  const [theme, setTheme] = useState<any>(null);
  const [pdvTheme, setPdvTheme] = useState<PdvThemeConfig>(PDV_THEME_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [sidebarConfig, setSidebarConfig] = useState<Record<string, boolean>>({});
  const [savingSidebar, setSavingSidebar] = useState(false);

  useEffect(() => {
    if (companyId) loadTheme();
    setPdvTheme(loadPdvTheme());
    // Carrega config atual da sidebar
    api.get("/company/settings")
      .then((r) => { if (r.data?.sidebarConfig) setSidebarConfig(r.data.sidebarConfig); })
      .catch(() => {});
  }, [companyId]);

  function isSidebarItemOn(navKey: string) {
    return sidebarConfig[navKey] !== false; // default é true
  }

  function toggleSidebarItem(navKey: string) {
    setSidebarConfig((prev) => ({ ...prev, [navKey]: !isSidebarItemOn(navKey) }));
  }

  async function saveSidebarConfig() {
    if (isDemo) { demoBlock(); return; }
    setSavingSidebar(true);
    try {
      await api.patch("/company/settings", { sidebarConfig });
      toast.success("Menu da loja atualizado!");
    } catch {
      toast.error("Erro ao salvar configuração do menu.");
    } finally {
      setSavingSidebar(false);
    }
  }

  function updatePdvTheme(patch: Partial<PdvThemeConfig>) {
    const updated = { ...pdvTheme, ...patch };
    setPdvTheme(updated);
    savePdvTheme(updated);
    broadcastPdvTheme(updated);
  }

  async function loadTheme() {
    try {
      const res = await api.get(`/themes/${companyId}`);
      setTheme(res.data);
    } catch {
      toast.error("Erro ao carregar tema.");
    }
  }

  // Aplica claro/escuro no <html> (mesma classe que o ClientShell usa).
  // Padrão = claro (mármore). .theme-dark só quando explicitamente escuro.
  function applyMode(isDark?: boolean) {
    const dark = isDark === true;
    document.documentElement.classList.toggle("theme-dark", dark);
  }

  function applyLive(t: any) {
    if (t?.primaryColor) {
      document.documentElement.style.setProperty("--color-primary", t.primaryColor);
    }
    applyMode(t?.darkMode);
  }

  function demoBlock() {
    toast("Modo demonstração — alterações não são salvas.\nEscolha um plano para personalizar seu tema.", { icon: "🔒" });
  }

  async function persistTheme(obj: any) {
    if (!companyId) return false;
    if (isDemo) { demoBlock(); return false; }
    const res = await api.patch(`/themes/${companyId}`, obj);
    return res.status >= 200 && res.status < 300;
  }

  async function saveTheme() {
    if (!companyId) return;
    if (isDemo) { demoBlock(); return; }
    setSaving(true);
    try {
      await persistTheme(theme);
      applyLive(theme);
      toast.success("Tema atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar tema.");
    } finally {
      setSaving(false);
    }
  }

  // Aplica uma cor de accent na hora + salva (usado pelos presets e atalhos).
  async function applyPrimary(primary: string) {
    const updated = { ...theme, primaryColor: primary };
    setTheme(updated);
    document.documentElement.style.setProperty("--color-primary", primary);
    if (isDemo) { demoBlock(); return; }
    try { await persistTheme(updated); toast.success("Cor aplicada!"); }
    catch { toast.error("Erro ao aplicar cor."); }
  }

  // Alterna claro/escuro da loja + salva.
  async function toggleDarkMode(next: boolean) {
    const updated = { ...theme, darkMode: next };
    setTheme(updated);
    applyMode(next);
    if (isDemo) { demoBlock(); return; }
    try { await persistTheme(updated); toast.success(next ? "Modo escuro ativado" : "Modo claro ativado"); }
    catch { toast.error("Erro ao trocar o modo."); }
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Tema / Visual</h1>
          <p className="mt-1 opacity-70 text-sm">Personalize a aparência do seu cardápio público</p>
        </div>

        {/* ─── Grid 2 colunas (md+) / 1 coluna (mobile) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* ── Coluna Esquerda: Cores + Imagens ── */}
          <div className="space-y-4">

            {/* Cores */}
            <section className="rounded-2xl p-5 border" style={{ borderColor: theme.primaryColor }}>
              <h2 className="text-base font-bold mb-4">Cores</h2>
              <div className="space-y-3">
                {[
                  { label: "Cor Primária",   key: "primaryColor"     },
                  { label: "Cor Secundária", key: "secondaryColor"   },
                  { label: "Fundo",          key: "backgroundColor"  },
                  { label: "Cor do Texto",   key: "textColor"        },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block mb-1 text-xs font-semibold opacity-70">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={toHexColor(theme[key]) || "#000000"}
                        onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                        className="h-9 w-16 rounded-lg cursor-pointer border-0"
                      />
                      <span className="font-mono text-xs opacity-60">{theme[key]}</span>
                      {/* Imagem de textura de fundo — só no campo Fundo */}
                      {key === "backgroundColor" && (
                        <label
                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-dashed transition hover:border-solid"
                          style={{ borderColor: `${theme.primaryColor}66`, color: theme.primaryColor }}
                          title="Imagem de fundo (aparecerá com 25% de opacidade)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {theme.backgroundImageUrl ? "Trocar textura" : "+ Textura"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append("file", file);
                              try {
                                const res = await fetch(`${apiBaseUrl}/upload`, { method: "POST", body: formData });
                                const data = await res.json();
                                const url = data.url || data.imageUrl || data.secure_url;
                                if (url) {
                                  setTheme((t: any) => ({ ...t, backgroundImageUrl: url }));
                                  document.documentElement.style.setProperty("--bg-texture-url", `url('${url}')`);
                                  toast.success("Textura carregada!");
                                }
                              } catch {
                                toast.error("Erro ao enviar imagem.");
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {/* Mini preview da textura selecionada */}
                    {key === "backgroundColor" && theme.backgroundImageUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="w-12 h-8 rounded-lg border bg-center bg-cover"
                          style={{ backgroundImage: `url('${theme.backgroundImageUrl}')` }}
                        />
                        <span className="text-[11px] opacity-50">Textura selecionada — 25% opacidade</span>
                        <button
                          type="button"
                          className="text-[11px] text-red-400 hover:text-red-600 ml-auto"
                          onClick={() => {
                            setTheme((t: any) => ({ ...t, backgroundImageUrl: null }));
                            document.documentElement.style.removeProperty("--bg-texture-url");
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Modo claro / escuro da loja */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: `${theme.primaryColor}33` }}>
                <label className="block mb-2 text-xs font-semibold opacity-70">Modo do tema</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDarkMode(true)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition"
                    style={theme.darkMode !== false
                      ? { background: "#0A0B0E", color: "#fff", borderColor: theme.primaryColor }
                      : { background: "transparent", color: "inherit", borderColor: "rgba(127,127,127,0.4)", opacity: 0.6 }}
                  >
                    🌙 Escuro
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDarkMode(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition"
                    style={theme.darkMode === false
                      ? { background: "#ffffff", color: "#111827", borderColor: theme.primaryColor }
                      : { background: "transparent", color: "inherit", borderColor: "rgba(127,127,127,0.4)", opacity: 0.6 }}
                  >
                    ☀️ Claro
                  </button>
                </div>
                <p className="mt-2 text-[11px] opacity-50">Aplica em todas as páginas desta loja (PDV, admin e cardápio).</p>
              </div>
            </section>

            {/* Imagens */}
            <section className="rounded-2xl p-5 border" style={{ borderColor: theme.primaryColor }}>
              <h2 className="text-base font-bold mb-4">Imagens</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">Logo</label>
                  <ImageUpload
                    value={theme.logoUrl}
                    onChange={(url) => setTheme({ ...theme, logoUrl: url })}
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Banner</label>
                  <ImageUpload
                    value={theme.bannerUrl}
                    onChange={(url) => setTheme({ ...theme, bannerUrl: url })}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── Coluna Direita: Preview → Pizza → Analytics ── */}
          <div className="space-y-4">

            {/* Preview do Tema */}
            <div className="rounded-2xl overflow-hidden border md:sticky md:top-6 md:self-start" style={{ borderColor: theme.primaryColor }}>
              <div className="relative h-48">
                <img
                  src={theme.bannerUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591"}
                  className="w-full h-full object-cover"
                  alt="Banner preview"
                />
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  {theme.logoUrl && (
                    <img src={theme.logoUrl} className="h-20 object-contain mb-3" alt="Logo preview" />
                  )}
                </div>
              </div>
              <div className="p-5" style={{ backgroundColor: theme.backgroundColor }}>
                <div className="rounded-xl p-4" style={{ backgroundColor: theme.secondaryColor }}>
                  <h3 className="text-lg font-bold mb-2" style={{ color: theme.textColor }}>
                    Preview do Tema
                  </h3>
                  <button
                    className="px-4 py-2 rounded-xl font-bold text-white text-sm"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    Adicionar ao carrinho
                  </button>
                </div>
                {(theme.metaPixelId || theme.gaId) && (
                  <div className="mt-3 space-y-1.5">
                    {theme.metaPixelId && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                        Meta Pixel: <span className="font-mono text-blue-400">{theme.metaPixelId}</span>
                      </div>
                    )}
                    {theme.gaId && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                        <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                        GA4: <span className="font-mono text-primary">{theme.gaId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Pizza Meio a Meio */}
            <section className="rounded-2xl p-5 border border-gray-200 bg-gray-50">
              <h2 className="text-base font-bold mb-1">🍕 Pizza Meio a Meio</h2>
              <p className="text-gray-500 text-xs mb-4">Como calcular o preço quando o cliente monta pizza com vários sabores</p>
              <div className="space-y-3">
                {[
                  { value: "MAX",  label: "Cobrar o valor cheio", desc: "Cobra o preço do sabor mais caro (padrão do mercado)" },
                  { value: "HALF", label: "Cobrar a média",        desc: "Cobra a média dos preços entre os sabores escolhidos" },
                ].map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border-2 transition ${
                      (theme.pizzaPricingMode || "MAX") === value
                        ? "border-red-400 bg-red-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pizzaPricingMode"
                      value={value}
                      checked={(theme.pizzaPricingMode || "MAX") === value}
                      onChange={() => setTheme({ ...theme, pizzaPricingMode: value })}
                      className="w-4 h-4 accent-red-500 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-sm text-gray-800">{label}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Rastreamento & Analytics */}
            <section className="rounded-2xl p-5 border border-gray-200 bg-gray-50">
              <h2 className="text-base font-bold mb-1">Rastreamento & Analytics</h2>
              <p className="text-gray-500 text-xs mb-4">
                Configure as integrações de rastreamento para seu cardápio público.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">Meta Pixel ID</label>
                  <p className="text-gray-500 text-xs mb-2">
                    Ex: <span className="font-mono">1234567890123456</span> — encontre no Gerenciador de Eventos do Facebook
                  </p>
                  <input
                    value={theme.metaPixelId || ""}
                    onChange={(e) => setTheme({ ...theme, metaPixelId: e.target.value || null })}
                    placeholder="Cole aqui o Pixel ID do Meta"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-red-500 placeholder-gray-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Google Analytics ID (GA4)</label>
                  <p className="text-gray-500 text-xs mb-2">
                    Ex: <span className="font-mono">G-XXXXXXXXXX</span> — encontre em Admin → Fluxo de dados
                  </p>
                  <input
                    value={theme.gaId || ""}
                    onChange={(e) => setTheme({ ...theme, gaId: e.target.value || null })}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-red-500 placeholder-gray-400 font-mono"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── Salvar Tema — largura total, centralizado ── */}
        <div className="mt-5">
          <button
            onClick={saveTheme}
            disabled={saving}
            className="w-full md:w-1/2 md:mx-auto block py-3 rounded-xl font-bold text-base text-white transition disabled:opacity-60"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {saving ? "Salvando..." : "Salvar Tema"}
          </button>
        </div>
      </div>

      {/* ─── PDV / Admin Theme ──────────────────────────────────── */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Tema PDV / Caixa</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Personaliza o visual da tela de PDV. Salvo automaticamente — abra o PDV em outra aba para ver em tempo real.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Left: controls ── */}
          <div className="space-y-5">

            {/* Presets */}
            <section className="rounded-3xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">Presets Premium</h3>
                <p className="text-xs text-gray-400 mt-0.5">Temas profissionais prontos para usar — aplica instantaneamente</p>
              </div>
              <div className="divide-y divide-gray-100">
                {PDV_THEME_PRESETS.map((p) => {
                  const cfg = { ...PDV_THEME_DEFAULT, ...p.config };
                  const isActive = (theme.primaryColor || "").toLowerCase() === cfg.primary.toLowerCase();
                  return (
                    <button key={p.name}
                      onClick={() => applyPrimary(cfg.primary)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      {/* Color swatch preview */}
                      <div className="flex shrink-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ width: 88, height: 48 }}>
                        <div className="h-full" style={{ width: "25%", background: cfg.sidebarBg }} />
                        <div className="h-full" style={{ width: "20%", background: cfg.categoriesBg }} />
                        <div className="h-full border-x border-gray-100" style={{ width: "30%", background: cfg.productsBg }} />
                        <div className="h-full" style={{ width: "25%", background: cfg.primary }} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-gray-800">{p.emoji} {p.name}</span>
                          {isActive && (
                            <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full tracking-widest uppercase">Ativo</span>
                          )}
                          {p.config.glassmorphism && (
                            <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Glass</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 leading-snug truncate">{p.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Fundos */}
            <section className="rounded-3xl p-6 border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Fundos</h3>
              <div className="grid grid-cols-3 gap-4">
                {([
                  { label: "Sidebar",    key: "sidebarBg"    },
                  { label: "Categorias", key: "categoriesBg" },
                  { label: "Produtos",   key: "productsBg"   },
                  { label: "Carrinho",   key: "cartBg"       },
                  { label: "Header",     key: "headerBg"     },
                  { label: "Cards",      key: "cardBg"       },
                ] as { label: string; key: keyof PdvThemeConfig }[]).map(({ label, key }) => (
                  <div key={key}
                    className={`rounded-xl p-2 -m-2 transition-all ${activeKey === key ? "ring-2 ring-blue-400 bg-blue-50" : ""}`}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={toHexColor(pdvTheme[key] as string)}
                        onChange={(e) => updatePdvTheme({ [key]: e.target.value })}
                        onFocus={() => setActiveKey(key)}
                        onBlur={() => setActiveKey(null)}
                        onMouseEnter={() => setActiveKey(key)}
                        onMouseLeave={() => setActiveKey(null)}
                        className="h-9 w-14 rounded-lg cursor-pointer border border-gray-200" />
                      <span className="font-mono text-xs text-gray-400 truncate">{pdvTheme[key] as string}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Cores principais */}
            <section className="rounded-3xl p-6 border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Cores Principais</h3>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { label: "Cor Principal", key: "primary" },
                  { label: "Destaque / Accent", key: "accent" },
                ] as { label: string; key: keyof PdvThemeConfig }[]).map(({ label, key }) => (
                  <div key={key}
                    className={`rounded-xl p-2 -m-2 transition-all ${activeKey === key ? "ring-2 ring-blue-400 bg-blue-50" : ""}`}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={toHexColor(pdvTheme[key] as string)}
                        onChange={(e) => updatePdvTheme({ [key]: e.target.value })}
                        onFocus={() => setActiveKey(key)}
                        onBlur={() => setActiveKey(null)}
                        onMouseEnter={() => setActiveKey(key)}
                        onMouseLeave={() => setActiveKey(null)}
                        className="h-10 w-16 rounded-xl cursor-pointer border border-gray-200" />
                      <span className="font-mono text-sm text-gray-500">{pdvTheme[key] as string}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Border radius */}
            <section className="rounded-3xl p-6 border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-1">Border Radius</h3>
              <p className="text-xs text-gray-400 mb-4">Controla o arredondamento dos cards e botões</p>
              <div className="flex items-center gap-4">
                <input type="range" min={4} max={28} step={2} value={pdvTheme.radius}
                  onChange={(e) => updatePdvTheme({ radius: Number(e.target.value) })}
                  className="flex-1 accent-blue-600" />
                <span className="text-sm font-bold text-gray-700 w-12 text-right">{pdvTheme.radius}px</span>
              </div>
              <div className="mt-3 flex gap-2">
                {[4, 8, 12, 16, 20, 24].map((v) => (
                  <button key={v} onClick={() => updatePdvTheme({ radius: v })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${pdvTheme.radius === v ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </section>

            {/* Tipografia */}
            <section className="rounded-3xl p-6 border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Tipografia</h3>
              <div className="grid grid-cols-2 gap-2">
                {(["Inter", "Poppins", "Nunito", "system-ui"] as const).map((f) => (
                  <button key={f} onClick={() => updatePdvTheme({ font: f })}
                    className={`py-3 rounded-xl text-sm font-semibold border transition ${pdvTheme.font === f ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"}`}
                    style={{ fontFamily: f }}>
                    {f}
                  </button>
                ))}
              </div>
            </section>

            {/* Espaçamento */}
            <section className="rounded-3xl p-6 border border-gray-200">
              <h3 className="text-base font-bold text-gray-800 mb-4">Espaçamento</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["compact", "medium", "spacious"] as const).map((s) => (
                  <button key={s} onClick={() => updatePdvTheme({ spacing: s })}
                    className={`py-3 rounded-xl text-sm font-semibold border capitalize transition ${pdvTheme.spacing === s ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"}`}>
                    {s === "compact" ? "Compacto" : s === "medium" ? "Médio" : "Espaçoso"}
                  </button>
                ))}
              </div>
            </section>

            {/* Efeitos */}
            <section className="rounded-3xl p-6 border border-gray-200 bg-gray-50">
              <h3 className="text-base font-bold text-gray-800 mb-4">Efeitos Visuais</h3>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "shadows",        label: "Sombras suaves",  desc: "Profundidade nos cards e colunas" },
                  { key: "animations",     label: "Animações",       desc: "Transições e hover premium" },
                  { key: "glassmorphism",  label: "Glassmorphism",   desc: "Blur e transparência suave" },
                  { key: "compactMode",    label: "Modo Compacto",   desc: "Categorias menores (64px)" },
                  { key: "darkProducts",  label: "Texto Claro",     desc: "Texto branco para área de produtos escura" },
                ] as { key: keyof PdvThemeConfig; label: string; desc: string }[]).map(({ key, label, desc }) => (
                  <button key={key}
                    onClick={() => updatePdvTheme({ [key]: !pdvTheme[key] })}
                    className={`p-4 rounded-2xl border text-left transition ${pdvTheme[key] ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:border-blue-200"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold ${pdvTheme[key] ? "text-blue-700" : "text-gray-700"}`}>{label}</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${pdvTheme[key] ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                        {pdvTheme[key] && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={() => { updatePdvTheme(PDV_THEME_DEFAULT); toast.success("Tema PDV restaurado!"); }}
              className="w-full py-3 rounded-2xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              ↺ Restaurar Padrão
            </button>
          </div>

          {/* ── Right: mini preview ── */}
          <div className="sticky top-8 self-start">
            {activeKey && (
              <div className="mb-2 text-center text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl py-1.5 px-3 animate-pulse">
                ✦ Editando: {{
                  sidebarBg: "Sidebar", categoriesBg: "Categorias", productsBg: "Produtos",
                  cartBg: "Carrinho", headerBg: "Header", cardBg: "Cards",
                  primary: "Cor Principal", accent: "Destaque / Accent",
                }[activeKey] ?? activeKey}
              </div>
            )}
            <div className="rounded-3xl overflow-hidden border border-gray-200 shadow-xl"
              style={{ background: pdvTheme.productsBg, fontFamily: `'${pdvTheme.font}', sans-serif` }}>
              {/* Mini header */}
              <div className="h-10 flex items-center px-3 gap-2 transition-all"
                style={{ background: pdvTheme.headerBg, boxShadow: activeKey === "headerBg" ? "inset 0 0 0 3px #60a5fa" : "none" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
                  style={{ background: pdvTheme.primary }}>PDV</div>
                <div className="flex-1 h-5 rounded-lg" style={{ background: pdvTheme.cardBg }} />
                <div className="h-7 px-3 rounded-lg text-[10px] font-bold text-white flex items-center"
                  style={{ background: pdvTheme.primary }}>Mesa</div>
                <div className="h-7 px-3 rounded-lg text-[10px] font-bold text-white flex items-center"
                  style={{ background: pdvTheme.accent }}>Carrinho</div>
              </div>
              {/* Mini body */}
              <div className="flex h-56" style={{ boxShadow: activeKey === "productsBg" ? "inset 0 0 0 3px #60a5fa" : "none" }}>
                {/* sidebar */}
                <div className="w-8 flex flex-col items-center py-2 gap-1.5 transition-all"
                  style={{ background: pdvTheme.sidebarBg, boxShadow: activeKey === "sidebarBg" ? "inset 0 0 0 3px #60a5fa" : "none" }}>
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="w-5 h-5 rounded-md transition-all" style={{
                      background: i === 3 ? pdvTheme.primary : "rgba(255,255,255,0.1)",
                      boxShadow: activeKey === "primary" && i === 3 ? "0 0 0 2px #60a5fa" : "none",
                    }} />
                  ))}
                </div>
                {/* categories */}
                <div className="w-16 border-r flex flex-col transition-all"
                  style={{ background: pdvTheme.categoriesBg, borderColor: pdvTheme.border, boxShadow: activeKey === "categoriesBg" ? "inset 0 0 0 3px #60a5fa" : "none" }}>
                  {["Todos","Pizza","Bebidas","Outros","Sobrem"].map((c, i) => (
                    <div key={c} className="flex-1 flex items-center justify-center text-[7px] font-bold border-b transition-all"
                      style={{
                        background: i === 0 ? pdvTheme.primary : "transparent",
                        color: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
                        borderColor: pdvTheme.border,
                        boxShadow: activeKey === "primary" && i === 0 ? "inset 0 0 0 2px #fff" : "none",
                      }}>
                      {c}
                    </div>
                  ))}
                </div>
                {/* products */}
                <div className="flex-1 p-2 space-y-1.5 overflow-hidden" style={{ background: pdvTheme.productsBg }}>
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex overflow-hidden transition-all"
                      style={{
                        background: pdvTheme.cardBg,
                        borderRadius: `${pdvTheme.radius / 2}px`,
                        height: 48,
                        border: `1px solid ${pdvTheme.border}`,
                        boxShadow: activeKey === "cardBg"
                          ? "inset 0 0 0 2px #60a5fa"
                          : pdvTheme.shadows ? "0 1px 6px rgba(0,0,0,0.3)" : "none",
                      }}>
                      <div className="w-12 h-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="flex-1 px-2 flex flex-col justify-center gap-1">
                        <div className="h-2 rounded-full w-3/4" style={{ background: "rgba(255,255,255,0.2)" }} />
                        <div className="h-1.5 rounded-full w-1/2" style={{ background: "rgba(255,255,255,0.08)" }} />
                      </div>
                      <div className="pr-2 flex items-center">
                        <div className="px-2 py-0.5 rounded text-[7px] font-black text-white transition-all"
                          style={{
                            background: pdvTheme.primary,
                            borderRadius: `${pdvTheme.radius / 3}px`,
                            boxShadow: activeKey === "primary" ? "0 0 0 2px #60a5fa" : "none",
                          }}>+</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* cart */}
                <div className="w-20 border-l flex flex-col transition-all"
                  style={{ background: pdvTheme.cartBg, borderColor: pdvTheme.border, boxShadow: activeKey === "cartBg" ? "inset 0 0 0 3px #60a5fa" : "none" }}>
                  <div className="p-1.5 border-b text-[7px] font-black text-white" style={{ borderColor: pdvTheme.border }}>Pedido</div>
                  <div className="flex-1 p-1.5 space-y-1">
                    {[1,2].map((i) => (
                      <div key={i} className="h-6 rounded flex items-center px-1 gap-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                        <div className="text-[6px]" style={{ color: pdvTheme.accent }}>R$</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-1.5">
                    <div className="w-full py-1.5 rounded text-[7px] font-black text-white text-center transition-all"
                      style={{
                        background: pdvTheme.primary,
                        borderRadius: `${pdvTheme.radius / 3}px`,
                        boxShadow: activeKey === "primary" || activeKey === "accent" ? "0 0 0 2px #60a5fa" : "none",
                      }}>
                      Finalizar
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">Preview em tempo real · Salvo automaticamente</p>
          </div>
        </div>
      </div>

      {/* ─── Menu da Loja ──────────────────────────────────────────────────── */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Menu da Loja</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Escolha quais botões aparecem no menu lateral. Itens desativados ficam invisíveis para todos os usuários da loja.
          </p>
        </div>

        {/* Grupos por seção */}
        {(["Operação","Cardápio","Estoque","IA","Atendimento","Relatórios","Marketplace"] as const).map((section) => {
          const items = SIDEBAR_ITEMS.filter((i) => i.section === section);
          return (
            <div key={section} className="mb-6">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{section}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {items.map((item) => {
                  const on = isSidebarItemOn(item.navKey);
                  return (
                    <button
                      key={item.navKey}
                      onClick={() => toggleSidebarItem(item.navKey)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                        on
                          ? "border-green-400 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-gray-50 opacity-50"
                      }`}
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <span className={`text-xs font-bold leading-tight ${on ? "text-gray-800" : "text-gray-400"}`}>
                        {item.label}
                      </span>
                      <div className={`w-8 h-4 rounded-full flex items-center transition-all ${on ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}>
                        <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          onClick={saveSidebarConfig}
          disabled={savingSidebar}
          className="w-full md:w-1/2 py-3 rounded-xl font-bold text-base text-white bg-gray-900 hover:bg-gray-700 transition disabled:opacity-60"
        >
          {savingSidebar ? "Salvando..." : "💾 Salvar Menu da Loja"}
        </button>
      </div>
    </main>
  );
}
