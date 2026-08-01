"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RotateCcw, Layers, ChevronRight,
  Activity, RefreshCw, BarChart3, Calendar,
} from "lucide-react";
import Link from "next/link";
import { use6DData, LAYER_META, type DataLayer } from "@/components/bi6d/use6DData";
import DimensionLegend from "@/components/bi6d/DimensionLegend";

// ── Three.js carrega APENAS nesta rota (dynamic import lazy) ─────────────────
const Scene6D = dynamic(() => import("@/components/bi6d/Scene6D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-3 text-white/40">
      <Activity size={20} className="animate-pulse" />
      <span className="text-sm">Inicializando engine WebGL…</span>
    </div>
  ),
});

// ── Helpers de data ───────────────────────────────────────────────────────────
// toISOString() usa UTC — no fim da tarde/noite no Brasil (UTC-3) o relógio
// UTC já virou o dia seguinte, desalinhando o range pedido (mesma classe de
// bug já corrigida em app/bi/page.tsx e app/financeiro/page.tsx).
function fmtDate(d: Date) { return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
function buildRange(days: number) {
  const to = new Date(); const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: fmtDate(from), to: fmtDate(to) };
}

const PRESETS = [
  { label: "7 d",  days: 7  },
  { label: "30 d", days: 30 },
  { label: "90 d", days: 90 },
];

const ALL_LAYERS: DataLayer[] = ["orders", "stock", "drivers", "loyalty", "visits", "funnel"];

// ── Variantes de entrada em cascata — sem isso, cards/linhas do painel
//    lateral simplesmente "blitavam" na tela assim que os dados chegavam,
//    destoando do resto da cena (que é toda animada). ────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function BiAvancadoPage() {
  const [preset,      setPreset]      = useState(1);
  const [timeFilter,  setTimeFilter]  = useState(1);
  const [showLegend,  setShowLegend]  = useState(true);
  const [activeLayers, setActiveLayers] = useState<Set<DataLayer>>(
    new Set(ALL_LAYERS)
  );
  // Dica de interação some sozinha depois de um tempo — um produto premium
  // não fica repetindo "arraste pra rotacionar" pro sempre, isso é cara de
  // aviso de dev esquecido, não de UI pensada.
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const { from, to } = buildRange(PRESETS[preset].days);

  // useMemo para estabilizar o Set e evitar re-fetch desnecessário
  const layerSet = useMemo(() => activeLayers, [activeLayers]);
  const { data, loading, error } = use6DData(from, to, layerSet);

  const toggleLayer = useCallback((layer: DataLayer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) { if (next.size > 1) next.delete(layer); }
      else next.add(layer);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setTimeFilter(1);
    setPreset(1);
    setActiveLayers(new Set(ALL_LAYERS));
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(ellipse at 20% 50%, #0d1117 0%, #050709 60%, #0a0612 100%)" }}
    >
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/bi" className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm">
            <ArrowLeft size={15} /> BI Clássico
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <h1 className="text-sm font-black text-white tracking-tight">Análise 6D</h1>
            <p className="text-[10px] text-white/30">
              WebGL · {data?.points.length ?? 0} pontos · {PRESETS[preset].days} dias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle de camadas */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] p-1">
            {ALL_LAYERS.map(layer => {
              const active = activeLayers.has(layer);
              const meta   = LAYER_META[layer];
              return (
                <motion.button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  title={`${active ? "Ocultar" : "Mostrar"} ${meta.label}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.15 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    active ? "text-white" : "text-white/20"
                  }`}
                  style={active ? { background: meta.color + "22", color: meta.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: active ? meta.color : "#ffffff22" }} />
                  {meta.label}
                </motion.button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-white/10" />

          {/* Presets de período */}
          {PRESETS.map((p, i) => (
            <motion.button
              key={p.label}
              onClick={() => setPreset(i)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                preset === i ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >{p.label}</motion.button>
          ))}

          <div className="w-px h-4 bg-white/10" />

          <button onClick={handleReset} title="Resetar"
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all">
            <RotateCcw size={13} />
          </button>
          <button
            onClick={() => setShowLegend(v => !v)}
            className={`p-2 rounded-lg transition-all ${showLegend ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
            <Layers size={13} />
          </button>
        </div>
      </header>

      {/* ── Corpo ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas WebGL */}
        <div className="flex-1 relative">
          {/* Estados (erro/carregando/vazio) em crossfade — nunca troca em
              corte seco, e nada disso reaparece pra sempre sem motivo. */}
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center justify-center z-10"
              >
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center max-w-sm backdrop-blur-md">
                  <p className="text-red-400 text-sm font-bold mb-1">Erro ao carregar dados</p>
                  <p className="text-white/40 text-xs">{error}</p>
                </div>
              </motion.div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: "radial-gradient(circle, rgba(6,182,212,0.35) 0%, transparent 70%)" }}
                      animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.5, 0.9, 0.5] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <RefreshCw size={22} className="animate-spin text-cyan-300/80 relative" />
                  </div>
                  <p className="text-white/40 text-xs">
                    Processando {PRESETS[preset].days} dias · {activeLayers.size} camada(s)…
                  </p>
                </div>
              </motion.div>
            ) : data && data.points.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <p className="text-white/30 text-sm">Nenhum dado nas camadas selecionadas</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {!loading && data && data.points.length > 0 && showHint && (
              <motion.div
                key="hint"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="absolute top-4 left-4 z-10 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-md px-4 py-2"
              >
                <p className="text-[11px] text-white/40">
                  🖱 Arraste para rotacionar · Scroll = zoom · Clique na esfera = detalhes
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Suspense fallback={null}>
            {data && data.points.length > 0 && (
              <Scene6D sceneData={data} timeFilter={timeFilter} />
            )}
          </Suspense>
        </div>

        {/* Painel lateral */}
        <AnimatePresence>
          {showLegend && (
            <motion.aside
              initial={{ x: 280, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              exit={{ x: 280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-72 shrink-0 border-l border-white/[0.05] p-6 flex flex-col gap-5 overflow-y-auto"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(14px)" }}
            >
              {/* Contagem por camada */}
              {data && (
                <motion.div
                  className="flex flex-col gap-2"
                  variants={staggerContainer} initial="hidden" animate="show"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1">
                    Pontos por fonte
                  </p>
                  {ALL_LAYERS.map(layer => {
                    const cnt  = data.layers[layer] ?? 0;
                    const meta = LAYER_META[layer];
                    const active = activeLayers.has(layer);
                    return (
                      <motion.div
                        key={layer}
                        variants={staggerItem}
                        whileHover={{ scale: 1.02 }}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all ${active ? "" : "opacity-30"}`}
                        style={{ background: active ? meta.color + "14" : "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                          <span className="text-xs font-medium text-white/70">{meta.label}</span>
                        </div>
                        <span className="text-xs font-black tabular-nums" style={{ color: meta.color }}>{cnt}</span>
                      </motion.div>
                    );
                  })}
                  <p className="text-[10px] text-white/20 mt-1">Total: {data.points.length} pontos 3D</p>
                </motion.div>
              )}

              {/* KPIs rápidos */}
              {data && (
                <motion.div
                  className="grid grid-cols-2 gap-2"
                  variants={staggerContainer} initial="hidden" animate="show"
                >
                  {[
                    { l: "Dias",     v: data.days.toString(),                     c: "#3b82f6", icon: <Calendar size={11} /> },
                    { l: "Camadas",  v: activeLayers.size + "/" + ALL_LAYERS.length, c: "#8b5cf6", icon: <Layers size={11} /> },
                    { l: "Pico",     v: `R$${data.maxValue.toFixed(0)}`,          c: "#22c55e", icon: <BarChart3 size={11} /> },
                    { l: "Pontos",   v: data.points.length.toString(),             c: "#f97316", icon: <Activity size={11} /> },
                  ].map(k => (
                    <motion.div
                      key={k.l}
                      variants={staggerItem}
                      whileHover={{ scale: 1.04, y: -1 }}
                      className="rounded-xl p-3" style={{ background: k.c + "12" }}
                    >
                      <div className="flex items-center gap-1 mb-1" style={{ color: k.c + "99" }}>
                        {k.icon}
                        <p className="text-[10px] uppercase tracking-wider">{k.l}</p>
                      </div>
                      <p className="text-sm font-black tabular-nums" style={{ color: k.c }}>{k.v}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Slider D4 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-white/60">
                    <span className="text-cyan-400 mr-1">D4</span> Navegar no Tempo
                  </p>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    {Math.round(timeFilter * (data?.days ?? 1))}° dia
                  </span>
                </div>
                <input type="range" min={0} max={1} step={0.01}
                  value={timeFilter} onChange={e => setTimeFilter(Number(e.target.value))}
                  className="w-full accent-cyan-400" />
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>{from}</span><span>{to}</span>
                </div>
              </div>

              {/* Legenda dimensões */}
              <DimensionLegend />

              <Link href="/bi"
                className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 text-xs text-white/40 hover:text-white/70 hover:border-white/10 transition-all mt-auto">
                <span>Ver BI Clássico</span>
                <ChevronRight size={13} />
              </Link>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
