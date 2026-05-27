"use client";

import { motion } from "framer-motion";
import { TrendingUp, ShoppingBag, Star, Zap } from "lucide-react";

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
  color: string;
  delay: number;
}

const CARDS: StatCard[] = [
  { icon: <ShoppingBag size={14} />, label: "Pedidos ativos",  value: "1.2k+",  delta: "+18%",  color: "from-blue-500 to-indigo-600",   delay: 0 },
  { icon: <TrendingUp  size={14} />, label: "Faturamento",     value: "R$89k",  delta: "+31%",  color: "from-emerald-500 to-teal-600",  delay: 0.15 },
  { icon: <Star        size={14} />, label: "Satisfação",      value: "4.9 ★",  delta: "TOP",   color: "from-amber-500 to-orange-600",  delay: 0.3 },
  { icon: <Zap         size={14} />, label: "Módulos ativos",  value: "12",     delta: "Live",  color: "from-violet-500 to-purple-600", delay: 0.45 },
];

export function FloatingStats() {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {CARDS.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: card.delay, duration: 0.6, ease: "easeOut" }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl min-w-[130px]"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" }}
        >
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-lg`}>
            {card.icon}
          </div>
          <div>
            <p className="text-white/60 text-[10px] font-semibold">{card.label}</p>
            <p className="text-white font-black text-sm leading-tight">{card.value}</p>
          </div>
          {card.delta && (
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/15 px-1.5 py-0.5 rounded-full ml-auto">
              {card.delta}
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}
