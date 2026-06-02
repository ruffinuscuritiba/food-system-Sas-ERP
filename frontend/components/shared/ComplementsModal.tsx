"use client";

/**
 * ComplementsModal — UI única de seleção de complementos.
 * Usado por PDV e Cardápio Digital. Tema controlado via prop `theme`:
 *   - "dark"  → PDV (visual atual)
 *   - "light" → Cardápio Digital
 * Botões com min-h-[56px] para touch (tablet/celular).
 * Validações de min/max/required são feitas no submit; backend valida novamente.
 */

import { useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

export interface ComplementOption {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
  imageUrl?: string | null;
}

export interface ComplementGroup {
  id: string;
  name: string;
  type?: string;
  required: boolean;
  chargesExtra: boolean;
  multipleChoice: boolean;
  minOptions: number;
  maxOptions: number;
  options: ComplementOption[];
}

export interface SelectedComplement {
  complementOptionId: string;
  complementName: string;
  optionName: string;
  price: number;
  quantity: number;
}

interface Props {
  open: boolean;
  productName: string;
  productBasePrice?: number;
  groups: ComplementGroup[];
  loading?: boolean;
  theme?: "dark" | "light";
  onClose: () => void;
  onConfirm: (selections: SelectedComplement[]) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ComplementsModal({
  open, productName, productBasePrice = 0, groups, loading,
  theme = "light", onClose, onConfirm,
}: Props) {
  const [selections, setSelections] = useState<Record<string, SelectedComplement[]>>({});

  useEffect(() => {
    if (open) setSelections({});
  }, [open, productName]);

  const isDark = theme === "dark";

  // Subtotal vivo: base + extras
  const extrasTotal = useMemo(
    () => Object.values(selections).flat().reduce((s, c) => s + Number(c.price) * c.quantity, 0),
    [selections],
  );
  const subtotal = Number(productBasePrice) + extrasTotal;

  // Contagem de obrigatórios atendidos (header de progresso)
  const requiredTotal   = groups.filter((g) => g.required).length;
  const requiredFilled  = groups.filter((g) => {
    if (!g.required) return false;
    const sel = selections[g.id] || [];
    const min = g.minOptions || 1;
    return sel.length >= min;
  }).length;

  if (!open) return null;

  function toggleOption(group: ComplementGroup, option: ComplementOption) {
    const current = selections[group.id] || [];
    const isSelected = current.some((s) => s.complementOptionId === option.id);

    if (isSelected) {
      setSelections((p) => ({ ...p, [group.id]: current.filter((s) => s.complementOptionId !== option.id) }));
      return;
    }

    const newSel: SelectedComplement = {
      complementOptionId: option.id,
      complementName:     group.name,
      optionName:         option.name,
      price:              group.chargesExtra ? Number(option.price) : 0,
      quantity:           1,
    };

    if (!group.multipleChoice) {
      setSelections((p) => ({ ...p, [group.id]: [newSel] }));
      return;
    }

    if (group.maxOptions > 0 && current.length >= group.maxOptions) {
      toast.error(`Máximo ${group.maxOptions} em "${group.name}"`);
      return;
    }
    setSelections((p) => ({ ...p, [group.id]: [...current, newSel] }));
  }

  function confirm() {
    for (const g of groups) {
      if (!g.required) continue;
      const sel = selections[g.id] || [];
      const min = g.minOptions || 1;
      if (sel.length < min) {
        toast.error(`Selecione ao menos ${min} em "${g.name}"`);
        return;
      }
    }
    onConfirm(Object.values(selections).flat());
  }

  // ── Classes ──────────────────────────────────────────────────────────────────
  const cls = {
    backdrop:  "fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center sm:p-4",
    panel:     isDark
      ? "w-full sm:max-w-lg bg-[#050816] border border-[#1d2336] text-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] flex flex-col"
      : "w-full sm:max-w-lg bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] sm:max-h-[90dvh] flex flex-col shadow-2xl",
    header:    isDark
      ? "px-5 py-4 border-b border-[#161b2d] shrink-0"
      : "px-5 py-4 border-b border-gray-100 shrink-0",
    body:      "flex-1 overflow-y-auto px-5 py-4 space-y-5",
    footer:    isDark
      ? "px-5 py-4 border-t border-[#161b2d] shrink-0 bg-[#050816]"
      : "px-5 py-4 border-t border-gray-100 shrink-0 bg-white",
    optionBase: "w-full flex items-center justify-between px-4 rounded-2xl border transition min-h-[56px]",
    optionOff:  isDark
      ? "bg-[#0c101d] border-[#1d2336] text-zinc-300 hover:border-zinc-600"
      : "bg-white border-gray-200 text-gray-800 hover:border-gray-400 active:bg-gray-50",
    optionOn:   isDark
      ? "bg-primary/20 border-primary text-white"
      : "bg-primary/10 border-primary text-gray-900",
    cta:        "w-full rounded-2xl bg-primary hover:opacity-90 active:scale-[0.99] transition font-bold text-base text-white flex items-center justify-center gap-2 min-h-[56px]",
    closeBtn:   isDark ? "text-zinc-400 hover:text-white" : "text-gray-400 hover:text-gray-700",
    muted:      isDark ? "text-zinc-400" : "text-gray-500",
    badgeReq:   isDark
      ? "text-[11px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full"
      : "text-[11px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full",
    badgeOpt:   isDark
      ? "text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full"
      : "text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full",
  };

  return (
    <div className={cls.backdrop} onClick={onClose}>
      <div className={cls.panel} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={cls.header}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-lg truncate">{productName}</h2>
              <p className={`text-xs ${cls.muted}`}>
                {requiredTotal > 0
                  ? `${requiredFilled}/${requiredTotal} obrigatório${requiredTotal > 1 ? "s" : ""} preenchido${requiredFilled === 1 ? "" : "s"}`
                  : "Selecione os complementos"}
              </p>
            </div>
            <button onClick={onClose} className={cls.closeBtn} aria-label="Fechar">
              <X size={22} />
            </button>
          </div>

          {/* Progress bar (apenas se há obrigatórios) */}
          {requiredTotal > 0 && (
            <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((requiredFilled / requiredTotal) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className={cls.body}>
          {loading ? (
            <div className="py-10 text-center text-sm opacity-60">Carregando…</div>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-sm opacity-60">Nenhum complemento.</div>
          ) : groups.map((group) => {
            const selected = selections[group.id] || [];
            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <p className="font-bold">{group.name}</p>
                  {group.required ? (
                    <span className={cls.badgeReq}>Obrigatório</span>
                  ) : (
                    <span className={cls.badgeOpt}>Opcional</span>
                  )}
                  {group.maxOptions > 1 && (
                    <span className={`text-[11px] ${cls.muted}`}>
                      {selected.length}/{group.maxOptions}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const isSelected = selected.some((s) => s.complementOptionId === option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option)}
                        className={`${cls.optionBase} ${isSelected ? cls.optionOn : cls.optionOff}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Radio/Checkbox visual */}
                          <span className={`w-5 h-5 rounded-${group.multipleChoice ? "md" : "full"} border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-primary bg-primary"
                              : isDark ? "border-zinc-600" : "border-gray-300"
                          }`}>
                            {isSelected && (
                              group.multipleChoice
                                ? <span className="text-white text-xs leading-none">✓</span>
                                : <span className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </span>
                          {/* M-01 — imagem da opção quando cadastrada */}
                          {option.imageUrl && (
                            <img
                              src={option.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-black/10"
                              loading="lazy"
                            />
                          )}
                          <span className="text-sm font-medium text-left truncate">{option.name}</span>
                        </div>
                        {group.chargesExtra && Number(option.price) > 0 && (
                          <span className="font-bold text-sm shrink-0 ml-3 text-primary">
                            +R$ {fmt(Number(option.price))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className={cls.footer}>
          {productBasePrice > 0 && (
            <div className={`flex items-center justify-between text-sm mb-3 ${cls.muted}`}>
              <span>Subtotal</span>
              <span className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>
                R$ {fmt(subtotal)}
              </span>
            </div>
          )}
          <button onClick={confirm} className={cls.cta}>
            Adicionar ao Carrinho
            {extrasTotal > 0 && (
              <span className="opacity-90 font-normal text-sm">
                +R$ {fmt(extrasTotal)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
