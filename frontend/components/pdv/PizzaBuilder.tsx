"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FlavorVariant = { id: string; name: string; price: number };
type Flavor        = FlavorVariant;
type Border        = { id: string; name: string; price: number };
type SizeOption    = { size: string; label: string; price: number };
type SizeConfig    = { maxFlavors: number };

type Props = {
  flavors:      Flavor[];
  borders:      Border[];
  sizes?:       SizeOption[];
  sizeConfigs?: Record<string, SizeConfig>;
  onAdd:        (pizza: any) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Known size suffixes — checked longest first to avoid partial matches
const SIZE_SUFFIX_MAP: [string, string[]][] = [
  ["EXTRA_GRANDE", ["Extra Grande", "Extra_Grande", "ExtraGrande", "XG"]],
  ["FAMILIA",      ["Família", "Familia", "Famlia"]],
  ["GRANDE",       ["Grande"]],
  ["MEDIA",        ["Média", "Media"]],
  ["PEQUENA",      ["Pequena"]],
];

function stripSizeSuffix(name: string): { baseName: string; sizeKey: string | null } {
  for (const [sizeKey, labels] of SIZE_SUFFIX_MAP) {
    for (const label of labels) {
      // matches: "Calabresa Média", "Calabresa - Média", "Calabresa (Média)"
      const re = new RegExp(`[\\s\\-–()]+${label}[)]*$`, "i");
      if (re.test(name)) {
        return { baseName: name.replace(re, "").trim(), sizeKey };
      }
    }
  }
  return { baseName: name, sizeKey: null };
}

// ── Normalized flavor (one entry per unique base name) ────────────────────────

type NormalizedFlavor = {
  displayName: string;                        // e.g. "Calabresa"
  variants:    Record<string, FlavorVariant>; // sizeKey or "any" → original product
};

function buildNormalizedFlavors(flavors: Flavor[]): NormalizedFlavor[] {
  const map = new Map<string, NormalizedFlavor>();

  for (const f of flavors) {
    const { baseName, sizeKey } = stripSizeSuffix(f.name);
    const key = baseName.toLowerCase().trim();

    if (!map.has(key)) {
      map.set(key, { displayName: baseName, variants: {} });
    }
    const entry = map.get(key)!;
    entry.variants[sizeKey ?? "any"] = { id: f.id, name: f.name, price: f.price };
  }

  return Array.from(map.values());
}

/** Pick the best variant for a given size key */
function resolveVariant(norm: NormalizedFlavor, sizeKey: string): FlavorVariant {
  return (
    norm.variants[sizeKey] ??
    norm.variants["any"] ??
    Object.values(norm.variants)[0]
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PizzaBuilder({ flavors, borders, sizes, sizeConfigs, onAdd }: Props) {
  const sizeOptions: SizeOption[] =
    sizes && sizes.length > 0
      ? sizes
      : [
          { size: "PEQUENA",      label: "Pequena",     price: 0 },
          { size: "MEDIA",        label: "Média",       price: 0 },
          { size: "GRANDE",       label: "Grande",      price: 0 },
          { size: "FAMILIA",      label: "Família",     price: 0 },
          { size: "EXTRA_GRANDE", label: "Extra Grande",price: 0 },
        ];

  const [selectedSize,   setSelectedSize]   = useState<SizeOption>(sizeOptions[0]);
  const [selectedNorms,  setSelectedNorms]  = useState<NormalizedFlavor[]>([]);
  const [border,         setBorder]         = useState<Border | null>(null);
  const [notes,          setNotes]          = useState("");

  // maxFlavors from sizeConfig or fallback 2
  const maxFlavors = sizeConfigs?.[selectedSize.size]?.maxFlavors ?? 2;

  // Deduplicated flavor list — computed once per flavors prop change
  const normalizedFlavors = useMemo(
    () => buildNormalizedFlavors(flavors),
    [flavors],
  );

  // ── Interaction ─────────────────────────────────────────────────────────────

  function toggleFlavor(norm: NormalizedFlavor) {
    const isSelected = selectedNorms.some(n => n.displayName === norm.displayName);
    if (isSelected) {
      setSelectedNorms(prev => prev.filter(n => n.displayName !== norm.displayName));
      return;
    }
    if (selectedNorms.length >= maxFlavors) return;
    setSelectedNorms(prev => [...prev, norm]);
  }

  function changeSize(opt: SizeOption) {
    setSelectedSize(opt);
    const newMax = sizeConfigs?.[opt.size]?.maxFlavors ?? 2;
    // trim flavors if new max is smaller
    setSelectedNorms(prev => prev.slice(0, newMax));
  }

  // ── Price ────────────────────────────────────────────────────────────────────

  const pizzaPrice = useMemo(() => {
    const base =
      selectedSize.price > 0
        ? selectedSize.price
        : Math.max(
            ...selectedNorms.map(n => resolveVariant(n, selectedSize.size).price),
            0,
          );
    return base + (border?.price ?? 0);
  }, [selectedNorms, border, selectedSize]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  function addPizza() {
    if (selectedNorms.length === 0) return;
    const resolved = selectedNorms.map(n => resolveVariant(n, selectedSize.size));
    onAdd({
      id:        `pizza-${Date.now()}`,
      type:      "PIZZA",
      size:      selectedSize.size,
      sizeLabel: selectedSize.label,
      flavors:   resolved,
      border,
      notes,
      quantity:  1,
      name:      selectedNorms.map(n => n.displayName).join(" / "),
      price:     pizzaPrice,
      categoryId: resolved[0]?.id,
    });
    setSelectedNorms([]);
    setBorder(null);
    setNotes("");
  }

  // ── Derived state for UI ──────────────────────────────────────────────────────

  const remaining  = maxFlavors - selectedNorms.length;
  const isComplete = selectedNorms.length === maxFlavors;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Tamanho ─────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Tamanho</p>
        <div
          className={`grid gap-2 ${
            sizeOptions.length <= 3
              ? "grid-cols-3"
              : sizeOptions.length === 4
              ? "grid-cols-4"
              : "grid-cols-5"
          }`}
        >
          {sizeOptions.map(opt => {
            const sizeFlavors = sizeConfigs?.[opt.size]?.maxFlavors;
            return (
              <button
                key={opt.size}
                onClick={() => changeSize(opt)}
                className={`py-3 rounded-2xl font-bold text-sm transition text-center ${
                  selectedSize.size === opt.size
                    ? "bg-green-500 text-white"
                    : "bg-[#161b2d] text-zinc-300 hover:bg-[#1d2336]"
                }`}
              >
                <span className="block">{opt.label}</span>
                {opt.price > 0 && (
                  <span className="block text-xs font-normal opacity-80 mt-0.5">
                    {fmt(opt.price)}
                  </span>
                )}
                {sizeFlavors != null && (
                  <span className="block text-xs font-normal opacity-60 mt-0.5">
                    {sizeFlavors === 1 ? "1 sabor" : `até ${sizeFlavors} sabores`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sabores ─────────────────────────────────────────────────────────── */}
      <div>
        {/* Header + counter */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Sabores</p>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
              isComplete
                ? "bg-green-500/20 text-green-400"
                : selectedNorms.length > 0
                ? "bg-amber-500/20 text-amber-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {selectedNorms.length} de {maxFlavors} sabor{maxFlavors !== 1 ? "es" : ""} selecionado{maxFlavors !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Status hint */}
        {selectedNorms.length > 0 && !isComplete && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-amber-500/10 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span>
              <span className="text-green-400 font-semibold">
                {selectedNorms.map(n => n.displayName).join(", ")}
              </span>
              <span className="text-amber-400">
                {" — "}Escolha mais{" "}
                {remaining === 1 ? "1 sabor" : `${remaining} sabores`}
              </span>
            </span>
          </div>
        )}

        {isComplete && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-green-500/10 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-green-400 font-semibold">
              {selectedNorms.map(n => n.displayName).join(" / ")} — Pizza completa! ✓
            </span>
          </div>
        )}

        {/* Flavor grid */}
        {normalizedFlavors.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">
            Nenhum sabor cadastrado nesta categoria
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {normalizedFlavors.map(norm => {
              const selected  = selectedNorms.some(n => n.displayName === norm.displayName);
              const disabled  = !selected && isComplete;
              const variant   = resolveVariant(norm, selectedSize.size);
              const showPrice = selectedSize.price > 0 ? selectedSize.price : variant.price;

              return (
                <button
                  key={norm.displayName}
                  onClick={() => toggleFlavor(norm)}
                  disabled={disabled}
                  className={`p-3 rounded-xl text-left transition ${
                    selected
                      ? "bg-green-500 text-white"
                      : disabled
                      ? "bg-[#0c101d] text-zinc-600 cursor-not-allowed opacity-40"
                      : "bg-[#161b2d] text-zinc-200 hover:bg-[#1d2336]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {selected && (
                      <CheckCircle2 size={13} className="shrink-0 opacity-90" />
                    )}
                    <p className="font-semibold text-sm leading-tight">{norm.displayName}</p>
                  </div>
                  <p className="text-xs mt-0.5 opacity-70">{fmt(showPrice)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Borda ───────────────────────────────────────────────────────────── */}
      {borders.length > 0 && (
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Borda</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setBorder(null)}
              className={`p-3 rounded-xl text-sm font-semibold transition ${
                !border ? "bg-blue-600 text-white" : "bg-[#161b2d] text-zinc-300"
              }`}
            >
              Sem borda
            </button>
            {borders.map(b => (
              <button
                key={b.id}
                onClick={() => setBorder(b)}
                className={`p-3 rounded-xl text-sm transition text-left ${
                  border?.id === b.id ? "bg-blue-600 text-white" : "bg-[#161b2d] text-zinc-300"
                }`}
              >
                <span className="font-semibold">{b.name}</span>
                <span className="block text-xs opacity-75">+{fmt(b.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Observações ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Observações</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Ex: sem cebola, massa fina..."
          className="w-full bg-[#161b2d] border border-[#1d2336] rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none focus:border-blue-500"
        />
      </div>

      {/* ── Total + Adicionar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-[#161b2d]">
        <div>
          <p className="text-xs text-zinc-500">Total</p>
          <p className="text-2xl font-black text-green-400">{fmt(pizzaPrice)}</p>
        </div>
        <button
          onClick={addPizza}
          disabled={selectedNorms.length === 0}
          className="px-8 py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
