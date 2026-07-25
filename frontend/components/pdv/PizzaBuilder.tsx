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
  displayName: string;
  variants:    Record<string, FlavorVariant>;
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

  const [selectedSize,  setSelectedSize]  = useState<SizeOption>(sizeOptions[0]);
  const [selectedNorms, setSelectedNorms] = useState<NormalizedFlavor[]>([]);
  const [border,        setBorder]        = useState<Border | null>(null);
  const [notes,         setNotes]         = useState("");

  const maxFlavors = sizeConfigs?.[selectedSize.size]?.maxFlavors ?? 2;

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
    setSelectedNorms(prev => prev.slice(0, newMax));
  }

  // ── Price Calculation ───────────────────────────────────────────────────────

  const pizzaPrice = useMemo(() => {
    let base = 0;

    if (selectedSize.price > 0) {
      base = selectedSize.price;
    } else if (selectedNorms.length > 0) {
      // Cobra pelo valor do sabor mais caro selecionado (Regra padrão)
      base = Math.max(
        ...selectedNorms.map(n => resolveVariant(n, selectedSize.size).price),
        0
      );
    }

    return base + (border?.price ?? 0);
  }, [selectedNorms, border, selectedSize]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  function addPizza() {
    if (selectedNorms.length === 0) return;
    const resolved = selectedNorms.map(n => resolveVariant(n, selectedSize.size));
    
    onAdd({
      id:         `pizza-${Date.now()}`,
      type:       "PIZZA",
      size:       selectedSize.size,
      sizeLabel:  selectedSize.label,
      flavors:    resolved,
      border,
      notes,
      quantity:   1,
      name:       `Pizza ${selectedSize.label}: ${selectedNorms.map(n => n.displayName).join(" / ")}`,
      price:      pizzaPrice,
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
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">
          1. Escolha o Tamanho
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {sizeOptions.map(opt => {
            const sizeFlavors = sizeConfigs?.[opt.size]?.maxFlavors;
            const isSelected = selectedSize.size === opt.size;

            return (
              <button
                key={opt.size}
                type="button"
                onClick={() => changeSize(opt)}
                className={`py-3 px-2 rounded-2xl font-bold text-sm transition text-center border ${
                  isSelected
                    ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20"
                    : "bg-[#161b2d] border-[#1d2336] text-zinc-300 hover:bg-[#1d2336]"
                }`}
              >
                <span className="block leading-tight">{opt.label}</span>
                {opt.price > 0 && (
                  <span className="block text-xs font-normal opacity-90 mt-1">
                    {fmt(opt.price)}
                  </span>
                )}
                {sizeFlavors != null && (
                  <span className="block text-[10px] font-medium opacity-70 mt-0.5">
                    {sizeFlavors === 1 ? "1 sabor" : `Até ${sizeFlavors} sabores`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sabores ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            2. Escolha os Sabores
          </p>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
              isComplete
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : selectedNorms.length > 0
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {selectedNorms.length} de {maxFlavors} sabor{maxFlavors !== 1 ? "es" : ""}
          </span>
        </div>

        {/* Dynamic status feedback */}
        {selectedNorms.length > 0 && !isComplete && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
            <span>
              <span className="text-white font-semibold">
                {selectedNorms.map(n => n.displayName).join(", ")}
              </span>
              <span className="text-amber-400 font-medium">
                {" — "}Escolha mais {remaining === 1 ? "1 sabor" : `${remaining} sabores`}
              </span>
            </span>
          </div>
        )}

        {isComplete && (
          <div className="mb-3 flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <span className="text-green-400 font-semibold">
              {selectedNorms.map(n => n.displayName).join(" / ")} — Sabores selecionados! ✓
            </span>
          </div>
        )}

        {/* Flavor grid */}
        {normalizedFlavors.length === 0 ? (
          <p className="text-zinc-500 text-sm py-6 text-center bg-[#161b2d]/50 rounded-xl">
            Nenhum sabor cadastrado nesta categoria
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 touch-pan-y">
            {normalizedFlavors.map(norm => {
              const selected  = selectedNorms.some(n => n.displayName === norm.displayName);
              const disabled  = !selected && isComplete;
              const variant   = resolveVariant(norm, selectedSize.size);
              const showPrice = selectedSize.price > 0 ? selectedSize.price : variant.price;

              return (
                <button
                  key={norm.displayName}
                  type="button"
                  onClick={() => toggleFlavor(norm)}
                  disabled={disabled}
                  className={`p-3 rounded-xl text-left transition flex items-center justify-between border ${
                    selected
                      ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/10"
                      : disabled
                      ? "bg-[#0c101d] border-transparent text-zinc-600 cursor-not-allowed opacity-40"
                      : "bg-[#161b2d] border-[#1d2336] text-zinc-200 hover:bg-[#1d2336]"
                  }`}
                >
                  <div className="flex items-center gap-2 pr-2 min-w-0">
                    {selected && (
                      <CheckCircle2 size={16} className="shrink-0 text-white" />
                    )}
                    <span className="font-semibold text-sm truncate">{norm.displayName}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold opacity-80 shrink-0">
                    {fmt(showPrice)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Borda ───────────────────────────────────────────────────────────── */}
      {borders.length > 0 && (
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
            3. Borda Recheada (Opcional)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setBorder(null)}
              className={`p-3 rounded-xl text-sm font-semibold transition border ${
                !border
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-[#161b2d] border-[#1d2336] text-zinc-300 hover:bg-[#1d2336]"
              }`}
            >
              Sem borda
            </button>
            {borders.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBorder(b)}
                className={`p-3 rounded-xl text-sm transition text-left border ${
                  border?.id === b.id
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-[#161b2d] border-[#1d2336] text-zinc-300 hover:bg-[#1d2336]"
                }`}
              >
                <span className="font-semibold block truncate">{b.name}</span>
                <span className="block text-xs opacity-80">+{fmt(b.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Observações ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
          Observações
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Ex: massa bem assada, sem cebola, cortar em 12 pedaços..."
          className="w-full bg-[#161b2d] border border-[#1d2336] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none resize-none focus:border-green-500 transition"
        />
      </div>

      {/* ── Total + Adicionar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-[#161b2d]">
        <div>
          <p className="text-xs text-zinc-400 font-medium">Total da Pizza</p>
          <p className="text-2xl font-black text-green-400">{fmt(pizzaPrice)}</p>
        </div>
        <button
          type="button"
          onClick={addPizza}
          disabled={selectedNorms.length === 0}
          className="px-8 py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition shadow-lg shadow-green-500/20"
        >
          Adicionar ao Pedido
        </button>
      </div>
    </div>
  );
}