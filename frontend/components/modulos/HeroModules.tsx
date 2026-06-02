"use client";

import { motion } from "framer-motion";
import { Sparkles, ChevronRight, Zap } from "lucide-react";
import { FloatingStats } from "./FloatingStats";
import { PricingSelector, BillingPeriod } from "./PricingSelector";

interface HeroModulesProps {
  totalModules: number;
  activeModules: number;
  billing: BillingPeriod;
  onBillingChange: (v: BillingPeriod) => void;
}

export function HeroModules({ totalModules, activeModules, billing, onBillingChange }: HeroModulesProps) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #040d1a 0%, #071530 40%, #0a1f48 70%, #061023 100%)",
        minHeight: 380,
      }}
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-60px] right-[10%] w-[300px] h-[300px] rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
      <div className="absolute top-[20%] right-[5%] w-[200px] h-[200px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }} />

      {/* Particle dots */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.4 + 0.1,
          }}
          animate={{ opacity: [0.1, 0.5, 0.1], y: [0, -10, 0] }}
          transition={{ duration: Math.random() * 4 + 3, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 px-8 py-14 flex flex-col items-center text-center gap-8 max-w-5xl mx-auto">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-white/8 backdrop-blur border border-white/15 rounded-full px-4 py-1.5"
        >
          <Sparkles size={12} className="text-amber-400" />
          <span className="text-white/80 text-xs font-bold tracking-wide">MARKETPLACE DE MÓDULOS</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="space-y-3"
        >
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
            Expanda seu{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #60a5fa, #a78bfa, #60a5fa)", backgroundSize: "200%" }}
            >
              restaurante
            </span>
          </h1>
          <p className="text-white/50 text-base md:text-lg max-w-xl mx-auto leading-relaxed font-medium">
            Módulos enterprise prontos para ativar. Escale sua operação com tecnologia de nível internacional.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
            }}
          >
            <Zap size={14} /> Explorar módulos
          </button>
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white/80 border border-white/15 bg-white/5 hover:bg-white/10 transition-all hover:scale-105 backdrop-blur"
          >
            Ver planos <ChevronRight size={14} />
          </button>
        </motion.div>

        {/* Pricing selector */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-2"
        >
          <p className="text-white/35 text-xs font-semibold tracking-wider">PERÍODO DE COBRANÇA</p>
          <PricingSelector value={billing} onChange={onBillingChange} />
          <p className="text-emerald-400 text-xs font-semibold">💡 Plano anual economiza até 30% — faturado uma vez</p>
        </motion.div>

        {/* Info banner — included vs paid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex items-center gap-3 bg-white/6 border border-white/10 rounded-2xl px-5 py-3 max-w-xl w-full"
        >
          <span className="text-xl shrink-0">💡</span>
          <p className="text-white/60 text-sm leading-relaxed text-left">
            <span className="text-white font-bold">Alguns módulos estão incluídos no seu plano</span>
            {" "}e outros podem ser contratados separadamente.
          </p>
        </motion.div>

        {/* Floating stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="w-full"
        >
          <FloatingStats />
        </motion.div>
      </div>
    </div>
  );
}
