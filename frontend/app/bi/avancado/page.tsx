"use client";

/**
 * /bi/avancado — Visualização 6D
 *
 * Three.js + React Three Fiber carregados APENAS nesta rota via dynamic import.
 * O bundle global do sistema NÃO é afetado.
 *
 * Dimensões:
 *   D1 (X)      → Hora do dia (0–23)
 *   D2 (Y)      → Receita normalizada
 *   D3 (Z)      → Tipo de pedido (Delivery / Mesa / Balcão)
 *   D4 (slider) → Posição temporal (navegar pelo período)
 *   D5 (raio)   → Volume de pedidos
 *   D6 (cor)    → Saúde da margem (vermelho → amarelo → verde)
 */

import dynamic from "next/dynamic";
import { Suspense, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Maximize2, RotateCcw, Info,
  Activity, RefreshCw, Layers, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { use6DData } from "@/components/bi6d/use6DData";
import DimensionLegend from "@/components/bi6d/DimensionLegend";

// ── Lazy load: Three.js só é baixado quando o usuário acessa /bi/avancado ──
const Scene6D = dynamic(() => import("@/components/bi6d/Scene6D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-3 text-white/40">
      <Activity size={20} className="animate-pulse" />
      <span className="text-sm">Inicializando engine WebGL…</span>
    </div>
  ),
});

// ── Datas helper ──────────────────────────────────────────────────────────────
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function buildPreset(days: number) {
  const to   = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: fmtDate(from), to: fmtDate(to) };
}

const PRESETS = [
  { label: "7 dias",  days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function BiAvancadoPage() {
  const [preset,     setPreset]     = useState(1);          // 30 dias default
  const [timeFilter, setTimeFilter] = useState(1);          // D4: slider (0=passado, 1=hoje)
  const [showLegend, setShowLegend] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const { from, to } = buildPreset(PRESETS[preset].days);
  const { data, loading, error } = use6DData(from, to);

  const handleReset = useCallback(() => {
    setTimeFilter(1);
    setPreset(1);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(ellipse at 20% 50%, #0d1117 0%, #050709 60%, #0a0612 100%)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/bi"
            className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            BI Clássico
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <h1 className="text-sm font-black text-white tracking-tight">
              Análise 6D
            </h1>
            <p className="text-[10px] text-white/30">
              WebGL · {data?.points.length ?? 0} pontos · {PRESETS[preset].label}
            </p>
          </div>
        </div>

        {/* Controles de período */}
        <div className="flex items-center gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                preset === i
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={handleReset}
            title="Resetar câmera e filtros"
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setShowLegend(v => !v)}
            title={showLegend ? "Ocultar legenda" : "Mostrar legenda"}
            className={`p-2 rounded-lg transition-all ${
              showLegend
                ? "bg-white/10 text-white"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            <Layers size={14} />
          </button>
        </div>
      </header>

      {/* ── Corpo principal ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas 3D */}
        <div className="flex-1 relative">
          {/* Estado de erro */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center max-w-sm">
                <p className="text-red-400 text-sm font-bold mb-2">Erro ao carregar dados</p>
                <p className="text-white/40 text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-white/40" />
                <p className="text-white/40 text-xs">Processando {PRESETS[preset].days} dias de dados…</p>
              </div>
            </div>
          )}

          {/* Instrução de uso */}
          {!loading && data && data.points.length > 0 && (
            <div className="absolute top-4 left-4 z-10 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-md px-4 py-2">
              <p className="text-[11px] text-white/40">
                🖱 Arraste para rotacionar · Scroll para zoom · Clique na esfera para detalhes
              </p>
            </div>
          )}

          {/* Sem dados */}
          {!loading && data && data.points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-white/30 text-sm mb-1">Nenhum dado encontrado</p>
                <p className="text-white/20 text-xs">Faça pedidos para ver a visualização 6D</p>
              </div>
            </div>
          )}

          <Suspense fallback={null}>
            {data && data.points.length > 0 && (
              <Scene6D sceneData={data} timeFilter={timeFilter} />
            )}
          </Suspense>
        </div>

        {/* Painel lateral — legenda + controle D4 */}
        <AnimatePresence>
          {showLegend && (
            <motion.aside
              initial={{ x: 280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-72 shrink-0 border-l border-white/[0.05] p-6 flex flex-col gap-6 overflow-y-auto"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)" }}
            >
              {/* KPIs rápidos */}
              {data && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Pontos",  value: data.points.length.toString(),                     color: "#f97316" },
                    { label: "Dias",    value: data.days.toString(),                              color: "#3b82f6" },
                    { label: "Pico R$", value: `R$ ${data.maxRevenue.toFixed(0)}`,               color: "#22c55e" },
                    { label: "Vol max", value: data.maxOrders.toString() + " ped",               color: "#8b5cf6" },
                  ].map(k => (
                    <div
                      key={k.label}
                      className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: `${k.color}22` }}
                    >
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{k.label}</p>
                      <p className="text-sm font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Slider D4 — dimensão temporal */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-white/60">
                    <span className="text-cyan-400 mr-1">D4</span> Navegar no Tempo
                  </p>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    {Math.round(timeFilter * (data?.days ?? 1))}° dia
                  </span>
                </div>
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={timeFilter}
                  onChange={e => setTimeFilter(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>{from}</span>
                  <span>{to}</span>
                </div>
              </div>

              {/* Legenda das 6 dimensões */}
              <DimensionLegend />

              {/* Link de volta */}
              <Link
                href="/bi"
                className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 text-xs text-white/40 hover:text-white/70 hover:border-white/10 transition-all mt-auto"
              >
                <span>Ver BI Clássico</span>
                <ChevronRight size={14} />
              </Link>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
