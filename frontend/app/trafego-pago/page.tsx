"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import {
  TrendingUp, Eye, ShoppingBag, Copy, Megaphone, ImageIcon,
} from "lucide-react";
interface ViewedProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  salePrice: number;
  views: number;
}

interface OrderedProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

export default function TrafegoPagoPage() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [totalMenuViews, setTotalMenuViews] = useState(0);
  const [totalProductViews, setTotalProductViews] = useState(0);
  const [topViewed, setTopViewed] = useState<ViewedProduct[]>([]);
  const [topOrdered, setTopOrdered] = useState<OrderedProduct[]>([]);

  async function load() {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const fromIso = from.toISOString();

      const [summaryRes, productsRes] = await Promise.all([
        api.get(`/menu-analytics/summary?from=${fromIso}`),
        api.get(`/reports/products?from=${fromIso}&limit=10`),
      ]);

      setTotalMenuViews(summaryRes.data?.totalMenuViews ?? 0);
      setTotalProductViews(summaryRes.data?.totalProductViews ?? 0);
      setTopViewed(Array.isArray(summaryRes.data?.topViewedProducts) ? summaryRes.data.topViewedProducts : []);
      setTopOrdered(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch {
      toast.error("Erro ao carregar dados de tráfego");
      setTopViewed([]);
      setTopOrdered([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const star = topOrdered[0] ?? null;
  const starViewed = star ? topViewed.find((p) => p.productId === star.productId) : topViewed[0];

  function buildAdBrief(): string {
    const name = star?.productName ?? starViewed?.name ?? "seu produto mais pedido";
    const price = starViewed?.salePrice ? `R$ ${starViewed.salePrice.toFixed(2).replace(".", ",")}` : "";
    return [
      `🔥 ${name}${price ? ` por ${price}` : ""}`,
      "",
      `${name} é o item mais pedido da nossa loja nos últimos ${days} dias — peça agora pelo cardápio digital e receba rapidinho!`,
      "",
      "👉 Peça pelo link do cardápio",
      "📍 Entrega rápida | Pagamento no PIX, cartão ou dinheiro",
    ].join("\n");
  }

  function copyBrief() {
    navigator.clipboard.writeText(buildAdBrief())
      .then(() => toast.success("Texto copiado! Cole no Gerenciador de Anúncios do Facebook."))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <TrendingUp size={28} className="text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Tráfego Pago</h1>
              <p className="text-gray-500 text-sm mt-0.5">Dados prontos pra usar em anúncios no Facebook e Instagram</p>
            </div>
          </div>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button key={p.days} onClick={() => setDays(p.days)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${days === p.days ? "bg-primary text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <Eye size={14} /> Visualizações do cardápio
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? "—" : totalMenuViews}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <ImageIcon size={14} /> Visualizações de produtos
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? "—" : totalProductViews}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">
              <ShoppingBag size={14} /> Produtos vendidos (top 10 somados)
            </div>
            <p className="text-3xl font-black text-gray-900">
              {loading ? "—" : topOrdered.reduce((s, p) => s + p.quantity, 0)}
            </p>
          </div>
        </div>

        {/* Resumo pronto para anúncio */}
        {(star || starViewed) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={18} className="text-primary" />
              <h2 className="font-bold text-gray-800">Resumo pronto para anúncio</h2>
            </div>
            <div className="grid md:grid-cols-[140px_1fr] gap-5">
              {starViewed?.imageUrl ? (
                <img src={starViewed.imageUrl} alt="" className="w-full h-32 md:h-full object-cover rounded-xl border border-gray-100" />
              ) : (
                <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center text-3xl">🍕</div>
              )}
              <div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-4 font-sans">
                  {buildAdBrief()}
                </pre>
                <button onClick={copyBrief}
                  className="mt-3 flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition">
                  <Copy size={14} /> Copiar texto
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  Cole esse texto no Gerenciador de Anúncios do Facebook (business.facebook.com/adsmanager) junto com a foto do produto.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparação: mais visualizados x mais vendidos */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Eye size={14} /> Mais visualizados</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <p className="px-5 py-8 text-center text-gray-400 text-sm">Carregando...</p>
              ) : topViewed.length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-400 text-sm">Sem dados no período</p>
              ) : topViewed.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                  <p className="flex-1 text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <span className="text-xs font-bold text-primary">{p.views} views</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ShoppingBag size={14} /> Mais vendidos</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <p className="px-5 py-8 text-center text-gray-400 text-sm">Carregando...</p>
              ) : topOrdered.length === 0 ? (
                <p className="px-5 py-8 text-center text-gray-400 text-sm">Sem dados no período</p>
              ) : topOrdered.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                  <p className="flex-1 text-sm font-medium text-gray-800 truncate">{p.productName}</p>
                  <span className="text-xs font-bold text-emerald-600">{p.quantity}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          "Visualizações" contam cliques em produtos no cardápio digital (ainda que não virem pedido) — útil pra saber o que chama atenção mas talvez precise de uma foto melhor ou preço revisado.
        </p>
      </div>
    </main>
  );
}
