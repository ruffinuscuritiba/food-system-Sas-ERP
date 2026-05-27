"use client";

import { motion } from "framer-motion";

const PALETTE: Record<string, { from: string; to: string; glow: string; ring: string }> = {
  blue:   { from: "#3b82f6", to: "#1d4ed8", glow: "rgba(59,130,246,0.4)",   ring: "rgba(59,130,246,0.2)" },
  violet: { from: "#8b5cf6", to: "#6d28d9", glow: "rgba(139,92,246,0.4)",   ring: "rgba(139,92,246,0.2)" },
  emerald:{ from: "#10b981", to: "#047857", glow: "rgba(16,185,129,0.4)",   ring: "rgba(16,185,129,0.2)" },
  amber:  { from: "#f59e0b", to: "#d97706", glow: "rgba(245,158,11,0.4)",   ring: "rgba(245,158,11,0.2)" },
  rose:   { from: "#f43f5e", to: "#be123c", glow: "rgba(244,63,94,0.4)",    ring: "rgba(244,63,94,0.2)" },
  cyan:   { from: "#06b6d4", to: "#0e7490", glow: "rgba(6,182,212,0.4)",    ring: "rgba(6,182,212,0.2)" },
  orange: { from: "#f97316", to: "#c2410c", glow: "rgba(249,115,22,0.4)",   ring: "rgba(249,115,22,0.2)" },
  indigo: { from: "#6366f1", to: "#4338ca", glow: "rgba(99,102,241,0.4)",   ring: "rgba(99,102,241,0.2)" },
};

interface OrbProps {
  emoji: string;
  color?: keyof typeof PALETTE;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

const SIZES = { sm: 48, md: 64, lg: 80 };
const FONT  = { sm: "1.4rem", md: "1.8rem", lg: "2.2rem" };

export function AnalyticsOrb({ emoji, color = "blue", size = "md", animated = true }: OrbProps) {
  const pal = PALETTE[color] ?? PALETTE.blue;
  const px  = SIZES[size];

  const orb = (
    <div
      style={{
        width: px, height: px, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, ${pal.from}, ${pal.to})`,
        boxShadow: `0 0 0 6px ${pal.ring}, 0 8px 24px ${pal.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: FONT[size], flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Specular highlight */}
      <div style={{
        position: "absolute", top: "14%", left: "20%",
        width: "30%", height: "18%", borderRadius: "50%",
        background: "rgba(255,255,255,0.45)", filter: "blur(2px)",
      }} />
      <span style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }}>
        {emoji}
      </span>
    </div>
  );

  if (!animated) return orb;

  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
      transition={{ duration: 0.4 }}
    >
      {orb}
    </motion.div>
  );
}
