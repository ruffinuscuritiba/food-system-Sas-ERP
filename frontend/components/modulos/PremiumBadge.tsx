"use client";

import { Check, Clock, AlertCircle, Zap, Star, Lock } from "lucide-react";

type BadgeVariant = "active" | "trial" | "expired" | "free" | "premium" | "available" | "new";

const CONFIG: Record<BadgeVariant, { label: string; icon: React.ReactNode; cls: string }> = {
  active:    { label: "ATIVO",        icon: <Check size={9} />,         cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  trial:     { label: "TESTE GRÁTIS", icon: <Clock size={9} />,         cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  expired:   { label: "EXPIRADO",     icon: <AlertCircle size={9} />,   cls: "bg-red-500/15 text-red-500 border-red-500/20" },
  free:      { label: "GRATUITO",     icon: <Check size={9} />,         cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  premium:   { label: "PREMIUM",      icon: <Star size={9} />,          cls: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  available: { label: "DISPONÍVEL",   icon: <Zap size={9} />,           cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  new:       { label: "NOVO",         icon: <Zap size={9} />,           cls: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
};

export function PremiumBadge({ variant }: { variant: BadgeVariant }) {
  const c = CONFIG[variant];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border tracking-wide ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

export function CustomBadge({ label, color }: { label: string; color: string }) {
  const MAP: Record<string, string> = {
    green:  "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
    blue:   "bg-indigo-500/15 text-indigo-600 border-indigo-500/20",
    orange: "bg-amber-500/15 text-amber-600 border-amber-500/20",
    red:    "bg-red-500/15 text-red-500 border-red-500/20",
    purple: "bg-violet-500/15 text-violet-600 border-violet-500/20",
    yellow: "bg-yellow-500/15 text-yellow-600 border-yellow-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border tracking-wide ${MAP[color] ?? MAP.blue}`}>
      {label}
    </span>
  );
}
