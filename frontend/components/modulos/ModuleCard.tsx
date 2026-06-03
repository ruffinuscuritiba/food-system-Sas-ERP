"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Clock, AlertCircle, X, Sparkles, Shield, Zap,
  ChevronRight, Info,
} from "lucide-react";
import { BillingPeriod, getMonthlyPrice } from "./PricingSelector";

// ─── Tipos (inalterado para compatibilidade) ──────────────────────────────────

type ModuleStatus = "ACTIVE" | "INACTIVE" | "TRIAL" | "EXPIRED";

export interface Mod {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priceLabel(mod: Mod, billing: BillingPeriod): string {
  if (mod.isFree)                                 return "Incluso";
  if (mod.status === "TRIAL")                     return "Teste ativo";
  if (!mod.price)                                 return "Consultar";
  const monthly = getMonthlyPrice(mod.price, billing);
  return `R$ ${monthly.toFixed(2).replace(".", ",")}/mês`;
}

function typeBadge(mod: Mod): { label: string; cls: string } {
  if (mod.isFree && mod.status === "ACTIVE")
    return { label: "Incluído no Plano",   cls: "bg-blue-50 text-blue-600 border-blue-100" };
  if (mod.isFree)
    return { label: "Gratuito",            cls: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  if (mod.status === "ACTIVE")
    return { label: "Módulo Ativo",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (mod.status === "TRIAL")
    return { label: "Teste Gratuito",      cls: "bg-amber-50 text-amber-600 border-amber-200" };
  if (mod.status === "EXPIRED")
    return { label: "Teste Expirado",      cls: "bg-red-50 text-red-500 border-red-100" };
  return   { label: "Módulo Avulso",       cls: "bg-gray-50 text-gray-500 border-gray-200" };
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

export function ModuleCard({
  mod, billing, loading, onTrial, onActivate, onDeactivate, index,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const isActive  = mod.status === "ACTIVE" || mod.status === "TRIAL";
  const isFailed  = mod.status === "EXPIRED";
  const badge     = typeBadge(mod);
  const price     = priceLabel(mod, billing);
  const benefits  = (mod.benefits ?? []).slice(0, 3);
  const daysLeft  = mod.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(mod.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="relative flex flex-col rounded-2xl overflow-hidden bg-white"
        style={{
          border:     isActive ? "1.5px solid #d1fae5" : isFailed ? "1.5px solid #fee2e2" : "1.5px solid rgba(0,0,0,0.07)",
          boxShadow:  isActive
            ? "0 4px 6px rgba(0,0,0,0.03),0 16px 32px rgba(16,185,129,0.08)"
            : "0 2px 4px rgba(0,0,0,0.03),0 10px 24px rgba(0,0,0,0.06)",
        }}
      >
        {/* Status bar top */}
        {mod.status === "ACTIVE"  && <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />}
        {mod.status === "TRIAL"   && <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 to-orange-400" />}
        {mod.status === "EXPIRED" && <div className="h-0.5 w-full bg-gradient-to-r from-red-400 to-rose-400" />}

        {/* Highlighted glow */}
        {mod.isHighlighted && !isActive && (
          <div className="absolute top-3 right-3 z-10">
            <span className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
              <Sparkles size={7} /> DESTAQUE
            </span>
          </div>
        )}

        <div className="p-5 flex flex-col gap-3.5 flex-1">

          {/* ── HEADER: ícone + nome + preço ── */}
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{
                background: isActive
                  ? "linear-gradient(135deg,#ecfdf5,#d1fae5)"
                  : "linear-gradient(135deg,#f8faff,#f1f5ff)",
                border:     isActive ? "1px solid #a7f3d0" : "1px solid #e2e8ff",
              }}
            >
              {mod.icon || "📦"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-gray-900 text-[14px] leading-snug tracking-tight">
                  {mod.name || mod.slug}
                </h3>
                <span
                  className={`text-[12px] font-black shrink-0 whitespace-nowrap ${
                    mod.isFree || mod.status === "ACTIVE"
                      ? "text-emerald-600"
                      : mod.status === "TRIAL"
                        ? "text-amber-500"
                        : "text-gray-900"
                  }`}
                >
                  {price}
                </span>
              </div>
              <p className="text-gray-500 text-[12.5px] mt-0.5 leading-relaxed line-clamp-2 font-medium">
                {mod.description || "Expanda as funcionalidades do seu sistema."}
              </p>
            </div>
          </div>

          {/* ── BENEFÍCIOS ── */}
          {benefits.length > 0 && (
            <ul className="space-y-1.5">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check size={9} className="text-emerald-600" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {/* ── TRIAL COUNTDOWN ── */}
          {mod.status === "TRIAL" && mod.trialEndsAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
              <Clock size={11} /> {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""} de teste
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* ── TYPE BADGE ── */}
          <div>
            <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg border ${badge.cls}`}>
              {mod.status === "ACTIVE" ? <Check size={9} /> : mod.status === "TRIAL" ? <Clock size={9} /> : mod.status === "EXPIRED" ? <AlertCircle size={9} /> : <Zap size={9} />}
              {badge.label}
            </span>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* ── CTA DUPLO ── */}
          <div className="flex items-center gap-2">
            {/* Saiba Mais (secundário) */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-bold text-gray-500 border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 transition"
            >
              <Info size={12} /> Saiba Mais
            </button>

            {/* CTA primário */}
            <div className="flex-1">
              <PrimaryAction
                mod={mod}
                loading={loading}
                daysLeft={daysLeft}
                onTrial={onTrial}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
              />
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="px-5 py-2 border-t border-gray-50 bg-gray-50/50 flex items-center gap-1.5">
          <Shield size={9} className="text-gray-300" />
          <span className="text-[10px] text-gray-400 font-medium">
            Cancele quando quiser · Suporte incluído
          </span>
        </div>
      </motion.div>

      {/* ── MODAL SAIBA MAIS ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)" }}
                  >
                    {mod.icon || "📦"}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg">{mod.name}</h3>
                    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-lg border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                >
                  <X size={14} className="text-gray-500" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 overflow-y-auto flex-1">
                <p className="text-gray-600 text-sm leading-relaxed mb-5">
                  {mod.longDescription ?? mod.description}
                </p>

                {(mod.benefits ?? []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">
                      O que está incluído
                    </p>
                    <ul className="space-y-2">
                      {mod.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Check size={10} className="text-emerald-600" />
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Price block */}
                <div className="mt-5 rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">Preço mensal</p>
                    <p className="font-black text-lg text-gray-900">{price}</p>
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold">
                      <Check size={11} /> Ativo
                    </span>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="p-6 border-t border-gray-100">
                <PrimaryAction
                  mod={mod}
                  loading={loading}
                  daysLeft={daysLeft}
                  onTrial={onTrial}
                  onActivate={onActivate}
                  onDeactivate={() => { onDeactivate(); setShowModal(false); }}
                  fullWidth
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── PrimaryAction ────────────────────────────────────────────────────────────

function PrimaryAction({ mod, loading, daysLeft, onTrial, onActivate, onDeactivate, fullWidth = false }: {
  mod: Mod; loading: boolean; daysLeft: number;
  onTrial: () => void; onActivate: () => void; onDeactivate: () => void;
  fullWidth?: boolean;
}) {
  const w = fullWidth ? "w-full justify-center" : "w-full justify-center";

  if (mod.status === "ACTIVE") return (
    <button
      onClick={onDeactivate}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition disabled:opacity-50 ${w}`}
    >
      <Check size={12} /> {loading ? "…" : "Ativo"}
    </button>
  );

  if (mod.status === "TRIAL") return (
    <button
      onClick={onActivate}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition disabled:opacity-50 ${w}`}
      style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}
    >
      <Zap size={12} /> {loading ? "…" : "Assinar Agora"}
    </button>
  );

  if (mod.status === "EXPIRED") return (
    <button
      onClick={onActivate}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition disabled:opacity-50 ${w}`}
      style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}
    >
      <ChevronRight size={12} /> {loading ? "…" : "Contratar"}
    </button>
  );

  if (mod.isFree) return (
    <button
      onClick={onActivate}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition disabled:opacity-50 ${w}`}
      style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
    >
      <Zap size={12} /> {loading ? "…" : "Ativar Grátis"}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${w}`}>
      <button
        onClick={onActivate}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-white transition disabled:opacity-50 ${w}`}
        style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
      >
        <Zap size={12} /> {loading ? "…" : "Contratar"}
      </button>
      {!mod.trialEndsAt && (
        <button
          onClick={onTrial}
          disabled={loading}
          className={`text-[10.5px] text-gray-400 hover:text-indigo-500 font-semibold transition text-center ${w}`}
        >
          <Sparkles size={9} className="inline mr-1" />Testar 5 dias grátis
        </button>
      )}
    </div>
  );
}
