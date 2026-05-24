"use client";
import { apiBaseUrl } from "@/services/env";
import ImageUpload from "@/components/ImageUpload";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

export default function ThemePage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId;

  const [theme, setTheme] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) loadTheme();
  }, [companyId]);

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
      toast.success("Tema atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar tema.");
    } finally {
      setSaving(false);
    }
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
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
            <section className="rounded-3xl p-8 border border-slate-700 bg-slate-900/50">
              <h2 className="text-2xl font-bold mb-2">Rastreamento & Analytics</h2>
              <p className="text-slate-400 text-sm mb-6">
                Configure as integrações de rastreamento para seu cardápio público.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block mb-1 text-sm font-medium">Meta Pixel ID</label>
                  <p className="text-slate-500 text-xs mb-2">
                    Ex: <span className="font-mono">1234567890123456</span> — encontre no Gerenciador de Eventos do Facebook
                  </p>
                  <input
                    value={theme.metaPixelId || ""}
                    onChange={(e) => setTheme({ ...theme, metaPixelId: e.target.value || null })}
                    placeholder="Cole aqui o Pixel ID do Meta"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 placeholder-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Google Analytics ID (GA4)</label>
                  <p className="text-slate-500 text-xs mb-2">
                    Ex: <span className="font-mono">G-XXXXXXXXXX</span> — encontre em Admin → Fluxo de dados
                  </p>
                  <input
                    value={theme.gaId || ""}
                    onChange={(e) => setTheme({ ...theme, gaId: e.target.value || null })}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 placeholder-slate-500 font-mono"
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
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      Meta Pixel: <span className="font-mono text-blue-400">{theme.metaPixelId}</span>
                    </div>
                  )}
                  {theme.gaId && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full" />
                      GA4: <span className="font-mono text-orange-400">{theme.gaId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
