"use client";

import { motion } from "framer-motion";
import { LayoutGrid, ShoppingBag, Megaphone, DollarSign, Sparkles, Puzzle, Search, Package } from "lucide-react";
import { ModuleCard, Mod } from "./ModuleCard";
import { BillingPeriod } from "./PricingSelector";

const IA_SLUGS  = ["cardapio-ia", "automacao-marketing"];
const INT_SLUGS = ["ifood", "99food", "webhooks"];

type CatKey = "Todos" | "Operação" | "Marketing" | "Financeiro" | "IA" | "Integrações";

const CATS: { key: CatKey; icon: React.ReactNode; match: (m: Mod) => boolean }[] = [
  { key: "Todos",       icon: <LayoutGrid size={13} />,  match: () => true },
  { key: "Operação",    icon: <ShoppingBag size={13} />, match: m => m.category === "OPERACAO" },
  { key: "Marketing",   icon: <Megaphone size={13} />,   match: m => m.category === "MARKETING" && !IA_SLUGS.includes(m.slug) },
  { key: "Financeiro",  icon: <DollarSign size={13} />,  match: m => m.category === "FINANCEIRO" },
  { key: "IA",          icon: <Sparkles size={13} />,    match: m => IA_SLUGS.includes(m.slug) },
  { key: "Integrações", icon: <Puzzle size={13} />,      match: m => INT_SLUGS.includes(m.slug) },
];

interface ModuleGridProps {
  modules: Mod[];
  billing: BillingPeriod;
  search: string;
  onSearchChange: (v: string) => void;
  activeCategory: CatKey;
  onCategoryChange: (v: CatKey) => void;
  loading: boolean;
  busy: Record<string, boolean>;
  openMenu: string | null;
  onToggleMenu: (slug: string, e: React.MouseEvent) => void;
  onTrial: (slug: string) => void;
  onActivate: (slug: string) => void;
  onDeactivate: (slug: string) => void;
}

export function ModuleGrid({
  modules, billing, search, onSearchChange, activeCategory, onCategoryChange,
  loading, busy, openMenu, onToggleMenu, onTrial, onActivate, onDeactivate,
}: ModuleGridProps) {
  const cat = CATS.find(c => c.key === activeCategory) ?? CATS[0];

  const filtered = modules.filter(m => {
    const q = search.toLowerCase();
    return (!search || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q))
      && cat.match(m);
  });

  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {CATS.map(c => {
            const active = activeCategory === c.key;
            const count = modules.filter(c.match).length;
            return (
              <motion.button
                key={c.key}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onCategoryChange(c.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                  active
                    ? "text-white shadow-lg"
                    : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
                }`}
                style={active ? {
                  background: "linear-gradient(135deg, #1e40af, #4f46e5)",
                  boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
                } : {}}
              >
                {c.icon} {c.key}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar módulo..."
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition w-52 shadow-sm"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl h-80 animate-pulse bg-white border border-gray-100 shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-28 text-gray-300"
        >
          <Package size={56} className="mb-4" />
          <p className="text-lg font-black text-gray-400">Nenhum módulo encontrado</p>
          <p className="text-sm mt-1 text-gray-300">Tente outro filtro ou busca</p>
        </motion.div>
      ) : activeCategory === "Todos" && !search ? (
        <SectionedGrid
          modules={filtered}
          billing={billing}
          busy={busy}
          openMenu={openMenu}
          onToggleMenu={onToggleMenu}
          onTrial={onTrial}
          onActivate={onActivate}
          onDeactivate={onDeactivate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((mod, i) => (
            <ModuleCard
              key={mod.slug}
              mod={mod}
              billing={billing}
              loading={!!busy[mod.slug]}
              menuOpen={openMenu === mod.slug}
              onToggleMenu={e => onToggleMenu(mod.slug, e)}
              onTrial={() => onTrial(mod.slug)}
              onActivate={() => onActivate(mod.slug)}
              onDeactivate={() => onDeactivate(mod.slug)}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SectionedGrid ───────────────────────────────────────────────────────────

interface SectionedGridProps {
  modules: Mod[];
  billing: BillingPeriod;
  busy: Record<string, boolean>;
  openMenu: string | null;
  onToggleMenu: (slug: string, e: React.MouseEvent) => void;
  onTrial: (slug: string) => void;
  onActivate: (slug: string) => void;
  onDeactivate: (slug: string) => void;
}

function SectionedGrid({
  modules, billing, busy, openMenu, onToggleMenu, onTrial, onActivate, onDeactivate,
}: SectionedGridProps) {
  const included = modules.filter(m => m.isFree);
  const paid     = modules.filter(m => !m.isFree);

  function cards(list: Mod[], offset = 0) {
    return list.map((mod, i) => (
      <ModuleCard
        key={mod.slug}
        mod={mod}
        billing={billing}
        loading={!!busy[mod.slug]}
        menuOpen={openMenu === mod.slug}
        onToggleMenu={e => onToggleMenu(mod.slug, e)}
        onTrial={() => onTrial(mod.slug)}
        onActivate={() => onActivate(mod.slug)}
        onDeactivate={() => onDeactivate(mod.slug)}
        index={offset + i}
      />
    ));
  }

  return (
    <div className="space-y-10">
      {included.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Incluídos no Plano</h2>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {included.length} módulo{included.length !== 1 ? "s" : ""} gratuito{included.length !== 1 ? "s" : ""}
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {cards(included, 0)}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Módulos Avulsos</h2>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {paid.length} disponíve{paid.length !== 1 ? "is" : "l"}
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {cards(paid, included.length)}
          </div>
        </div>
      )}
    </div>
  );
}

export type { CatKey };
