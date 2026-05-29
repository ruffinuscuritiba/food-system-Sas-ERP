"use client";

import { useMemo, useState } from "react";

type Flavor = { id: string; name: string; price: number };
type Border = { id: string; name: string; price: number };
type SizeOption = { size: string; label: string; price: number };

type Props = {
  flavors: Flavor[];
  borders: Border[];
  sizes?: SizeOption[];   // real product sizes passed from parent
  onAdd: (pizza: any) => void;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PizzaBuilder({ flavors, borders, sizes, onAdd }: Props) {
  // Use product sizes if provided, otherwise fall back to standard enum labels
  const sizeOptions: SizeOption[] = sizes && sizes.length > 0
    ? sizes
    : [
        { size: "PEQUENA",      label: "Pequena",     price: 0 },
        { size: "MEDIA",        label: "Média",        price: 0 },
        { size: "GRANDE",       label: "Grande",       price: 0 },
        { size: "FAMILIA",      label: "Família",      price: 0 },
        { size: "EXTRA_GRANDE", label: "Extra Grande", price: 0 },
      ];
  const [selectedSize, setSelectedSize] = useState<SizeOption>(sizeOptions[0]);
  const [selectedFlavors, setSelectedFlavors] = useState<Flavor[]>([]);
  const [border, setBorder] = useState<Border | null>(null);
  const [notes, setNotes] = useState("");

  function toggleFlavor(flavor: Flavor) {
    const exists = selectedFlavors.find(f => f.id === flavor.id);
    if (exists) {
      setSelectedFlavors(prev => prev.filter(f => f.id !== flavor.id));
      return;
    }
    if (selectedFlavors.length >= 2) return; // max 2 flavors (meio a meio)
    setSelectedFlavors(prev => [...prev, flavor]);
  }

  const pizzaPrice = useMemo(() => {
    // Base price: use size price if real sizes provided, otherwise use highest flavor price
    const basePrice = selectedSize.price > 0
      ? selectedSize.price
      : Math.max(...selectedFlavors.map(f => f.price), 0);
    return basePrice + (border?.price || 0);
  }, [selectedFlavors, border, selectedSize]);

  function addPizza() {
    if (selectedFlavors.length === 0) return;
    onAdd({
      id: `pizza-${Date.now()}`,
      type: "PIZZA",
      size: selectedSize.size,
      sizeLabel: selectedSize.label,
      flavors: selectedFlavors,
      border,
      notes,
      quantity: 1,
      name: selectedFlavors.map(f => f.name).join(" / "),
      price: pizzaPrice,
      categoryId: flavors[0]?.id,
    });
    setSelectedFlavors([]);
    setBorder(null);
    setNotes("");
  }

  return (
    <div className="space-y-6">

      {/* Tamanho */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Tamanho</p>
        <div className={`grid gap-2 ${sizeOptions.length <= 3 ? "grid-cols-3" : sizeOptions.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
          {sizeOptions.map(opt => (
            <button
              key={opt.size}
              onClick={() => setSelectedSize(opt)}
              className={`py-3 rounded-2xl font-bold text-sm transition text-center ${
                selectedSize.size === opt.size
                  ? "bg-green-500 text-white"
                  : "bg-[#161b2d] text-zinc-300 hover:bg-[#1d2336]"
              }`}
            >
              <span className="block">{opt.label}</span>
              {opt.price > 0 && (
                <span className="block text-xs font-normal opacity-80 mt-0.5">{fmt(opt.price)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sabores */}
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">
          Sabores <span className="font-normal normal-case">(máx. 2 — meio a meio)</span>
        </p>
        {flavors.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">Nenhum sabor cadastrado nesta categoria</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {flavors.map(flavor => {
              const selected = selectedFlavors.some(f => f.id === flavor.id);
              const disabled = !selected && selectedFlavors.length >= 2;
              return (
                <button
                  key={flavor.id}
                  onClick={() => toggleFlavor(flavor)}
                  disabled={disabled}
                  className={`p-3 rounded-xl text-left transition ${
                    selected
                      ? "bg-green-500 text-white"
                      : disabled
                      ? "bg-[#0c101d] text-zinc-600 cursor-not-allowed opacity-50"
                      : "bg-[#161b2d] text-zinc-200 hover:bg-[#1d2336]"
                  }`}
                >
                  <p className="font-semibold text-sm leading-tight">{flavor.name}</p>
                  <p className="text-xs mt-0.5 opacity-75">
                    {fmt(selectedSize.price > 0 ? selectedSize.price : flavor.price)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Borda */}
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

      {/* Observações */}
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

      {/* Total + Adicionar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#161b2d]">
        <div>
          <p className="text-xs text-zinc-500">Total</p>
          <p className="text-2xl font-black text-green-400">{fmt(pizzaPrice)}</p>
        </div>
        <button
          onClick={addPizza}
          disabled={selectedFlavors.length === 0}
          className="px-8 py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
