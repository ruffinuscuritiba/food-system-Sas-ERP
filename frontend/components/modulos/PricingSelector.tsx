"use client";

import { motion } from "framer-motion";

export type BillingPeriod = "monthly" | "quarterly" | "biannual" | "annual";

const PERIODS: { key: BillingPeriod; label: string; discount: number; tag?: string }[] = [
  { key: "monthly",   label: "Mensal",      discount: 0 },
  { key: "quarterly", label: "Trimestral",  discount: 0.10, tag: "-10%" },
  { key: "biannual",  label: "Semestral",   discount: 0.18, tag: "-18%" },
  { key: "annual",    label: "Anual",       discount: 0.30, tag: "-30%" },
];

export function getMonthlyPrice(basePrice: number, period: BillingPeriod): number {
  const p = PERIODS.find(p => p.key === period)!;
  return basePrice * (1 - p.discount);
}

export function getTotalPrice(basePrice: number, period: BillingPeriod): number {
  const months = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };
  return getMonthlyPrice(basePrice, period) * months[period];
}

interface PricingSelectorProps {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}

export function PricingSelector({ value, onChange }: PricingSelectorProps) {
  return (
    <div className="inline-flex items-center bg-slate-900/60 backdrop-blur border border-white/10 rounded-2xl p-1 gap-0.5">
      {PERIODS.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className="relative px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-200 flex items-center gap-1.5"
            style={{ color: active ? "#fff" : "rgba(255,255,255,0.5)" }}
          >
            {active && (
              <motion.div
                layoutId="pricing-pill"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600"
                style={{ boxShadow: "0 4px 12px rgba(99,102,241,0.5)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{p.label}</span>
            {p.tag && (
              <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-400"}`}>
                {p.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
