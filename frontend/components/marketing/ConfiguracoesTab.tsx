"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { BarChart3, Loader2, Star } from "lucide-react";

/** Rastreamento & Analytics — movido de Configurações → Aparência (não tinha
 *  nada a ver com tema visual). metaPixelId/googleAnalyticsId são campos de
 *  Company, salvos via PATCH /company/settings (mesmo endpoint de antes). */
export default function ConfiguracoesTab() {
  const { user } = useAuthStore();
  const isDemo = user?.role === "DEMO";

  const [analytics, setAnalytics] = useState<{ metaPixelId: string; googleAnalyticsId: string; googleTagManagerId: string }>({
    metaPixelId: "",
    googleAnalyticsId: "",
    googleTagManagerId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    api.get("/company/settings")
      .then((r) => {
        setAnalytics({
          metaPixelId: r.data?.metaPixelId ?? "",
          googleAnalyticsId: r.data?.googleAnalyticsId ?? "",
          googleTagManagerId: r.data?.googleTagManagerId ?? "",
        });
        setGoogleReviewUrl(r.data?.googleReviewUrl ?? "");
      })
      .catch(() => toast.error("Erro ao carregar configurações."))
      .finally(() => setLoading(false));
  }, []);

  async function saveAnalytics() {
    if (isDemo) { toast.error("Ação bloqueada na demonstração."); return; }
    setSaving(true);
    try {
      await api.patch("/company/settings", {
        metaPixelId: analytics.metaPixelId || null,
        googleAnalyticsId: analytics.googleAnalyticsId || null,
        googleTagManagerId: analytics.googleTagManagerId || null,
      });
      toast.success("Rastreamento atualizado!");
    } catch {
      toast.error("Erro ao salvar rastreamento.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReviewUrl() {
    if (isDemo) { toast.error("Ação bloqueada na demonstração."); return; }
    setSavingReview(true);
    try {
      await api.patch("/company/settings", {
        googleReviewUrl: googleReviewUrl || null,
      });
      toast.success("Link de avaliação atualizado!");
    } catch {
      toast.error("Erro ao salvar o link de avaliação.");
    } finally {
      setSavingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <section className="rounded-2xl p-5 border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-primary" />
          <h2 className="text-base font-bold text-gray-900">Rastreamento & Analytics</h2>
        </div>
        <p className="text-gray-500 text-xs mb-4">
          Configure as integrações de rastreamento para o seu cardápio público.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Google Tag Manager (Container ID)</label>
            <p className="text-gray-500 text-xs mb-2">
              Ex: <span className="font-mono">GTM-XXXXXXX</span> — encontre em tagmanager.google.com, no topo do espaço de trabalho. Cole só o ID do contêiner aqui — não precisa colar o script/código.
            </p>
            <input
              value={analytics.googleTagManagerId}
              onChange={(e) => setAnalytics({ ...analytics, googleTagManagerId: e.target.value })}
              placeholder="GTM-XXXXXXX"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-primary placeholder-gray-400 font-mono"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Meta Pixel ID</label>
            <p className="text-gray-500 text-xs mb-2">
              Ex: <span className="font-mono">1234567890123456</span> — encontre no Gerenciador de Eventos do Facebook
            </p>
            <input
              value={analytics.metaPixelId}
              onChange={(e) => setAnalytics({ ...analytics, metaPixelId: e.target.value })}
              placeholder="Cole aqui o Pixel ID do Meta"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-primary placeholder-gray-400 font-mono"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Google Analytics ID (GA4)</label>
            <p className="text-gray-500 text-xs mb-2">
              Ex: <span className="font-mono">G-XXXXXXXXXX</span> — encontre em Admin → Fluxo de dados
            </p>
            <input
              value={analytics.googleAnalyticsId}
              onChange={(e) => setAnalytics({ ...analytics, googleAnalyticsId: e.target.value })}
              placeholder="G-XXXXXXXXXX"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-primary placeholder-gray-400 font-mono"
            />
          </div>
          {(analytics.googleTagManagerId || analytics.metaPixelId || analytics.googleAnalyticsId) && (
            <div className="space-y-1.5">
              {analytics.googleTagManagerId && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
                  GTM: <span className="font-mono text-indigo-500">{analytics.googleTagManagerId}</span>
                </div>
              )}
              {analytics.metaPixelId && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  Meta Pixel: <span className="font-mono text-blue-500">{analytics.metaPixelId}</span>
                </div>
              )}
              {analytics.googleAnalyticsId && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  GA4: <span className="font-mono text-primary">{analytics.googleAnalyticsId}</span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={saveAnalytics}
            disabled={saving}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar Rastreamento"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl p-5 border border-gray-200 bg-white shadow-sm mt-4">
        <div className="flex items-center gap-2 mb-1">
          <Star size={16} className="text-primary" />
          <h2 className="text-base font-bold text-gray-900">Link de Avaliação do Google</h2>
        </div>
        <p className="text-gray-500 text-xs mb-4">
          Link que a Kely (IA) manda pro cliente pedir avaliação depois de um pedido entregue com feedback positivo — nunca envia se o cliente reclamar de algo.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">Link de avaliação</label>
            <p className="text-gray-500 text-xs mb-2">
              No Google Maps ou Google Meu Negócio, busque sua loja → "Pedir avaliações" → copie o link e cole aqui.
            </p>
            <input
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-sm outline-none focus:border-primary placeholder-gray-400 font-mono"
            />
          </div>
          {googleReviewUrl && (
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
              Link ativo: <span className="font-mono text-amber-600 truncate">{googleReviewUrl}</span>
            </div>
          )}
          <button
            onClick={saveReviewUrl}
            disabled={savingReview}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
          >
            {savingReview ? "Salvando..." : "Salvar Link de Avaliação"}
          </button>
        </div>
      </section>
    </div>
  );
}
