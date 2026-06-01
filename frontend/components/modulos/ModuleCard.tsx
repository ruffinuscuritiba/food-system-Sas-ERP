"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Clock, AlertCircle, Download, MoreHorizontal,
  ChevronRight, Sparkles, Shield, Zap,
} from "lucide-react";
import { AnalyticsOrb } from "./AnalyticsOrb";
import { PremiumBadge, CustomBadge } from "./PremiumBadge";
import { BillingPeriod, getMonthlyPrice, getTotalPrice } from "./PricingSelector";

type ModuleStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "EXPIRED";

export interface Mod {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number | null;
  isFree: boolean;
  badge: string | null;
  badgeColor: string | null;
  benefits: string[];
  isHighlighted: boolean;
  sortOrder: number;
  companyModuleId: string | null;
  status: ModuleStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
}

const ORB_COLOR: Record<string, "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "orange" | "indigo"> = {
  "pdv":                  "blue",
  "delivery":             "emerald",
  "nfce":                 "rose",
  "estoque":              "amber",
  "cozinha":              "orange",
  "multi-loja":           "violet",
  "meta-pixel":           "indigo",
  "google-analytics":     "emerald",
  "fidelidade":           "amber",
  "cupons":               "orange",
  "crm-whatsapp":         "emerald",
  "recuperacao-clientes": "cyan",
  "fluxo-caixa":          "emerald",
  "dashboard-financeiro": "blue",
  "dre":                  "violet",
  "pix-automatico":       "cyan",
  "relatorios-avancados": "indigo",
  "cardapio-ia":          "violet",
  "ifood":                "rose",
  "99food":               "amber",
  "automacao-marketing":  "rose",
  "webhooks":             "indigo",
};

interface Props {
  mod: Mod;
  billing: BillingPeriod;
  loading: boolean;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onTrial: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  index: number;
}

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "/mês",
  quarterly: "/mês · cobrado 3x",
  biannual: "/mês · cobrado 6x",
  annual: "/mês · cobrado 12x",
};

export function ModuleCard({ mod, billing, loading, menuOpen, onToggleMenu, onTrial, onActivate, onDeactivate, index }: Props) {
  const color = ORB_COLOR[mod.slug] ?? "blue";
  const daysLeft = mod.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(mod.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const canTrial = mod.status === "INACTIVE" && !mod.trialEndsAt && !mod.isFree;
  const monthlyPrice = mod.price ? getMonthlyPrice(Number(mod.price), billing) : 0;
  const totalPrice = mod.price ? getTotalPrice(Number(mod.price), billing) : 0;
  const savings = mod.price ? (Number(mod.price) * 12) - (getMonthlyPrice(Number(mod.price), "annual") * 12) : 0;

  const isActive = mod.status === "ACTIVE" || mod.status === "TRIAL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: "easeOut" }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group relative flex flex-col rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #ffffff 0%, #fdf9f3 100%)",
        border: mod.isHighlighted
          ? "1.5px solid rgba(249,115,22,0.25)"
          : "1.5px solid rgba(0,0,0,0.07)",
        boxShadow: isActive
          ? "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)"
          : "0 2px 4px rgba(0,0,0,0.03), 0 12px 28px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Highlighted ribbon */}
      {mod.isHighlighted && (
        <div className="absolute top-4 right-4 z-10">
          <span className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg"
            style={{ boxShadow: "0 4px 12px rgba(249,115,22,0.4)" }}>
            <Sparkles size={8} /> DESTAQUE
          </span>
        </div>
      )}

      {/* Active status bar */}
      {isActive && (
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400" />
      )}

      {/* Card body */}
      <div className="p-6 flex flex-col flex-1">

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <AnalyticsOrb emoji={mod.icon} color={color} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-gray-900 text-[15px] leading-tight tracking-tight">{mod.name}</h3>
              {mod.status === "ACTIVE" && <PremiumBadge variant="active" />}
              {mod.status === "TRIAL" && <PremiumBadge variant="trial" />}
              {mod.status === "EXPIRED" && <PremiumBadge variant="expired" />}
              {mod.status === "INACTIVE" && mod.isFree && <PremiumBadge variant="free" />}
              {mod.status === "INACTIVE" && !mod.isFree && mod.badge && (
                <CustomBadge label={mod.badge} color={mod.badgeColor ?? "blue"} />
              )}
            </div>
            <p className="text-gray-400 text-[12px] mt-1 leading-relaxed line-clamp-2 font-medium">
              {mod.description}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <ul className="space-y-2 flex-1 mb-5">
          {(mod.benefits || []).slice(0, 4).map((b, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 + i * 0.05 + 0.2 }}
              className="flex items-center gap-2.5 text-[12.5px] text-gray-600 font-medium"
            >
              <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check size={9} className="text-emerald-600" />
              </div>
              {b}
            </motion.li>
          ))}
        </ul>

        {/* Pricing block (only for inactive paid) */}
        {mod.status === "INACTIVE" && !mod.isFree && mod.price && (
          <div className="mb-4 p-3.5 rounded-2xl border border-gray-100 bg-gray-50/70">
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-black text-gray-900">
                R$ {monthlyPrice.toFixed(2).replace(".", ",")}
              </span>
              <span className="text-gray-400 text-xs pb-1 font-medium">{PERIOD_LABEL[billing]}</span>
            </div>
            {billing !== "monthly" && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400">
                  Total: R$ {totalPrice.toFixed(2).replace(".", ",")}
                </span>
                {billing === "annual" && savings > 0 && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Economize R$ {savings.toFixed(0)}
                  </span>
                )}
                {billing === "annual" && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={8} /> MAIS ECONÔMICO
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />

        {/* Footer CTA */}
        <FooterCta
          mod={mod}
          loading={loading}
          menuOpen={menuOpen}
          canTrial={canTrial}
          daysLeft={daysLeft}
          onToggleMenu={onToggleMenu}
          onTrial={onTrial}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
        />
      </div>

      {/* Bottom security strip */}
      <div className="px-6 py-2.5 border-t border-gray-100/80 flex items-center gap-1.5 bg-gray-50/50">
        <Shield size={9} className="text-gray-300" />
        <span className="text-[10px] text-gray-400 font-medium">Cancele a qualquer momento · Suporte incluído</span>
      </div>
    </motion.div>
  );
}

function FooterCta({ mod, loading, menuOpen, canTrial, daysLeft, onToggleMenu, onTrial, onActivate, onDeactivate }: {
  mod: Mod; loading: boolean; menuOpen: boolean; canTrial: boolean; daysLeft: number;
  onToggleMenu: (e: React.MouseEvent) => void;
  onTrial: () => void; onActivate: () => void; onDeactivate: () => void;
}) {
  if (mod.status === "ACTIVE") return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-600 font-bold text-sm">Módulo ativo</span>
      </div>
      <ContextMenu open={menuOpen} onToggle={onToggleMenu}>
        <CtaOption label="Gerenciar assinatura" onClick={onActivate} variant="primary" />
        <CtaOption label="Desativar módulo" onClick={onDeactivate} variant="danger" />
      </ContextMenu>
    </div>
  );

  if (mod.status === "TRIAL") return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
          <Clock size={12} /> Teste ativo
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}</p>
      </div>
      <ContextMenu open={menuOpen} onToggle={onToggleMenu}>
        <CtaOption label="Assinar módulo" onClick={onActivate} variant="primary" />
        <CtaOption label="Cancelar teste" onClick={onDeactivate} variant="danger" />
      </ContextMenu>
    </div>
  );

  if (mod.status === "EXPIRED") return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-red-500 font-semibold flex items-center gap-1.5">
        <AlertCircle size={12} /> Teste expirado
      </p>
      <PrimaryBtn onClick={onActivate} loading={loading} label="Assinar" />
    </div>
  );

  if (mod.isFree) return (
    <div className="flex items-center justify-between">
      <span className="text-emerald-600 font-black text-sm flex items-center gap-1.5">
        <Zap size={13} /> 100% Gratuito
      </span>
      <PrimaryBtn onClick={onActivate} loading={loading} label="Ativar grátis" variant="green" />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <PrimaryBtn onClick={onActivate} loading={loading} label="Instalar módulo" icon={<Download size={13} />} fullWidth />
      {canTrial && (
        <button
          onClick={onTrial}
          disabled={loading}
          className="text-xs text-center text-gray-500 hover:text-primary font-semibold transition flex items-center justify-center gap-1"
        >
          <Sparkles size={10} /> Testar 5 dias grátis <ChevronRight size={10} />
        </button>
      )}
    </div>
  );
}

function PrimaryBtn({ onClick, loading, label, icon, fullWidth = false, variant = "primary" }: {
  onClick: () => void; loading: boolean; label: string; icon?: React.ReactNode; fullWidth?: boolean; variant?: "primary" | "green";
}) {
  const base = fullWidth ? "w-full justify-center" : "";
  const color = variant === "green"
    ? "from-emerald-500 to-teal-500"
    : "from-blue-600 to-indigo-600";
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${base}`}
      style={{
        background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
        backgroundImage: `linear-gradient(135deg, ${color.includes("emerald") ? "#10b981, #0d9488" : "#2563eb, #4f46e5"})`,
        boxShadow: `0 4px 14px ${color.includes("emerald") ? "rgba(16,185,129,0.35)" : "rgba(99,102,241,0.35)"}`,
      }}
    >
      {icon} {loading ? "Aguarde..." : label}
    </motion.button>
  );
}

function ContextMenu({ open, onToggle, children }: { open: boolean; onToggle: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
      >
        <MoreHorizontal size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-10 bg-white border border-gray-100 rounded-2xl py-2 w-48 z-30"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CtaOption({ label, onClick, variant }: { label: string; onClick: () => void; variant: "primary" | "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition ${
        variant === "danger" ? "text-red-500 hover:bg-red-50" : "text-blue-600 hover:bg-blue-50"
      }`}
    >
      {label}
    </button>
  );
}
