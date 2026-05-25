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

export default function ThemePage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId;

  const [theme, setTheme] = useState<any>(null);
  const [pdvTheme, setPdvTheme] = useState<PdvThemeConfig>(PDV_THEME_DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) loadTheme();
    setPdvTheme(loadPdvTheme());
  }, [companyId]);

  function updatePdvTheme(patch: Partial<PdvThemeConfig>) {
    const updated = { ...pdvTheme, ...patch };
    setPdvTheme(updated);
    savePdvTheme(updated);
    broadcastPdvTheme(updated);
  }

  async function loadTheme() {
    try {
      const response = await fetch(`${apiBaseUrl}/themes/${companyId}`);
      const data = await response.json();
      setTheme(data);
    } catch {
      toast.error("Erro ao carregar tema.");
    }
  }

  async function saveTheme() {
    if (!companyId) return;
    setSaving(true);
    try {
      await fetch(`${apiBaseUrl}/themes/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      if (theme.primaryColor) {
        document.documentElement.style.setProperty("--color-primary", theme.primaryColor);
      }
      toast.success("Tema atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar tema.");
    } finally {
      setSaving(false);
    }
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
      className="min-h-screen p-8"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold">Tema / Visual</h1>
          <p className="mt-2 opacity-70 text-sm">Personalize a aparência do seu cardápio público</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* ─── Configurações ─────────────────────────────── */}
          <div className="space-y-8">

            {/* Cores */}
            <section className="rounded-3xl p-8 border" style={{ borderColor: theme.primaryColor }}>
              <h2 className="text-2xl font-bold mb-6">Cores</h2>
              <div className="space-y-5">
                {[
                  { label: "Cor Primária", key: "primaryColor" },
                  { label: "Cor Secundária", key: "secondaryColor" },
                  { label: "Fundo", key: "backgroundColor" },
                  { label: "Cor do Texto", key: "textColor" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block mb-2 text-sm font-medium">{label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={theme[key] || "#000000"}
                        onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                        className="h-12 w-20 rounded-xl cursor-pointer border-0"
                      />
                      <span className="font-mono text-sm opacity-60">{theme[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Imagens */}
            <section className="rounded-3xl p-8 border" style={{ borderColor: theme.primaryColor }}>
              <h2 className="text-2xl font-bold mb-6">Imagens</h2>
              <div className="space-y-5">
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

            {/* Rastreamento */}
            <section className="rounded-3xl p-8 border border-gray-200 bg-gray-50">
              <h2 className="text-2xl font-bold mb-2">Rastreamento & Analytics</h2>
              <p className="text-gray-500 text-sm mb-6">
                Configure as integrações de rastreamento para seu cardápio público.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block mb-1 text-sm font-medium">Meta Pixel ID</label>
                  <p className="text-gray-500 text-xs mb-2">
                    Ex: <span className="font-mono">1234567890123456</span> — encontre no Gerenciador de Eventos do Facebook
                  </p>
                  <input
                    value={theme.metaPixelId || ""}
                    onChange={(e) => setTheme({ ...theme, metaPixelId: e.target.value || null })}
                    placeholder="Cole aqui o Pixel ID do Meta"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:border-red-500 placeholder-gray-400 font-mono"
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
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:border-red-500 placeholder-gray-400 font-mono"
                  />
                </div>
              </div>
            </section>

            <button
              onClick={saveTheme}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-bold text-xl transition disabled:opacity-60"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {saving ? "Salvando..." : "Salvar Tema"}
            </button>
          </div>

          {/* ─── Preview ───────────────────────────────────── */}
          <div className="rounded-3xl overflow-hidden border sticky top-8 self-start" style={{ borderColor: theme.primaryColor }}>
            <div className="relative h-56">
              <img
                src={theme.bannerUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591"}
                className="w-full h-full object-cover"
                alt="Banner preview"
              />
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                {theme.logoUrl && (
                  <img src={theme.logoUrl} className="h-24 object-contain mb-4" alt="Logo preview" />
                )}
              </div>
            </div>
            <div className="p-6" style={{ backgroundColor: theme.backgroundColor }}>
              <div className="rounded-2xl p-5" style={{ backgroundColor: theme.secondaryColor }}>
                <h3 className="text-xl font-bold mb-3" style={{ color: theme.textColor }}>
                  Preview do Tema
                </h3>
                <button
                  className="px-5 py-2.5 rounded-xl font-bold text-white"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Adicionar ao carrinho
                </button>
              </div>
              {(theme.metaPixelId || theme.gaId) && (
                <div className="mt-4 space-y-1.5">
                  {theme.metaPixelId && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      Meta Pixel: <span className="font-mono text-blue-400">{theme.metaPixelId}</span>
                    </div>
                  )}
                  {theme.gaId && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 bg-primary rounded-full" />
                      GA4: <span className="font-mono text-primary">{theme.gaId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── PDV / Admin Theme ──────────────────────────────────── */}
      <div className="mt-16 border-t border-gray-200 pt-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Tema PDV / Caixa</h2>
          <p className="mt-1 text-sm text-gray-500">
            Personaliza o visual da tela de PDV. Salvo automaticamente — abra o PDV em outra aba para ver em tempo real.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* ── Left: controls ── */}
          <div className="space-y-8">

            {/* Presets */}
            <section className="rounded-3xl p-6 border border-gray-200 bg-gray-50">
              <h3 className="text-base font-bold text-gray-800 mb-4">Presets</h3>
              <div className="flex flex-wrap gap-2">
                {PDV_THEME_PRESETS.map((p) => (
                  <button key={p.name}
                    onClick={() => updatePdvTheme({ ...PDV_THEME_DEFAULT, ...p.config })}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition hover:border-blue-400"
                    style={{
                      background: p.config.cardBg || PDV_THEME_DEFAULT.cardBg,
                      color: "#fff",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}>
                    {p.name}
                  </button>
                ))}
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
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={pdvTheme[key] as string}
                        onChange={(e) => updatePdvTheme({ [key]: e.target.value })}
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
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={pdvTheme[key] as string}
                        onChange={(e) => updatePdvTheme({ [key]: e.target.value })}
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
              onClick={() => { updatePdvTheme(PDV_THEME_DEFAULT); toast.success("Tema PDV redefinido!"); }}
              className="w-full py-3 rounded-2xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Redefinir Padrões do PDV
            </button>
          </div>

          {/* ── Right: mini preview ── */}
          <div className="sticky top-8 self-start">
            <div className="rounded-3xl overflow-hidden border border-gray-200 shadow-xl"
              style={{ background: pdvTheme.productsBg, fontFamily: `'${pdvTheme.font}', sans-serif` }}>
              {/* Mini header */}
              <div className="h-10 flex items-center px-3 gap-2" style={{ background: pdvTheme.headerBg }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
                  style={{ background: pdvTheme.primary }}>PDV</div>
                <div className="flex-1 h-5 rounded-lg" style={{ background: pdvTheme.cardBg }} />
                <div className="h-7 px-3 rounded-lg text-[10px] font-bold text-white flex items-center"
                  style={{ background: pdvTheme.primary }}>Mesa</div>
                <div className="h-7 px-3 rounded-lg text-[10px] font-bold text-white flex items-center"
                  style={{ background: pdvTheme.accent }}>Carrinho</div>
              </div>
              {/* Mini body */}
              <div className="flex h-56">
                {/* sidebar */}
                <div className="w-8 flex flex-col items-center py-2 gap-1.5" style={{ background: pdvTheme.sidebarBg }}>
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="w-5 h-5 rounded-md" style={{ background: i === 3 ? pdvTheme.primary : "rgba(255,255,255,0.1)" }} />
                  ))}
                </div>
                {/* categories */}
                <div className="w-16 border-r flex flex-col" style={{ background: pdvTheme.categoriesBg, borderColor: pdvTheme.border }}>
                  {["Todos","Pizza","Bebidas","Outros","Sobrem"].map((c, i) => (
                    <div key={c} className="flex-1 flex items-center justify-center text-[7px] font-bold border-b"
                      style={{
                        background: i === 0 ? pdvTheme.primary : "transparent",
                        color: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
                        borderColor: pdvTheme.border,
                      }}>
                      {c}
                    </div>
                  ))}
                </div>
                {/* products */}
                <div className="flex-1 p-2 space-y-1.5 overflow-hidden" style={{ background: pdvTheme.productsBg }}>
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex overflow-hidden"
                      style={{ background: pdvTheme.cardBg, borderRadius: `${pdvTheme.radius / 2}px`, height: 48, border: `1px solid ${pdvTheme.border}`, boxShadow: pdvTheme.shadows ? "0 1px 6px rgba(0,0,0,0.3)" : "none" }}>
                      <div className="w-12 h-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="flex-1 px-2 flex flex-col justify-center gap-1">
                        <div className="h-2 rounded-full w-3/4" style={{ background: "rgba(255,255,255,0.2)" }} />
                        <div className="h-1.5 rounded-full w-1/2" style={{ background: "rgba(255,255,255,0.08)" }} />
                      </div>
                      <div className="pr-2 flex items-center">
                        <div className="px-2 py-0.5 rounded text-[7px] font-black text-white"
                          style={{ background: pdvTheme.primary, borderRadius: `${pdvTheme.radius / 3}px` }}>+</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* cart */}
                <div className="w-20 border-l flex flex-col" style={{ background: pdvTheme.cartBg, borderColor: pdvTheme.border }}>
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
                    <div className="w-full py-1.5 rounded text-[7px] font-black text-white text-center"
                      style={{ background: pdvTheme.primary, borderRadius: `${pdvTheme.radius / 3}px` }}>
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
    </main>
  );
}
