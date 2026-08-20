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
import { X, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

// Grupo "sempre incluso": obrigatório, múltipla escolha, e o mínimo exigido é
// TODAS as opções (min=max=total) — ou seja, não é uma escolha de verdade,
// é a lista de itens que sempre acompanham o prato (ex.: Arroz/Feijão/Salada
// de um marmitex). Renderizado como checklist estático, pré-marcado, sem
// interação — em vez do stepper +/- normal de multipleChoice. Não exige
// campo novo no banco: é só uma leitura do shape que já existe hoje.
function isFixedInclusion(group: ComplementGroup): boolean {
  return (
    group.multipleChoice &&
    group.required &&
    group.options.length > 1 &&
    group.minOptions === group.options.length &&
    group.maxOptions === group.options.length
  );
}

// Grupo "troca": escolha única obrigatória com mais de 1 opção — ex.:
// "Escolha a proteína" (Strogonoff / Frango grelhado / Carne moída).
function isSwapGroup(group: ComplementGroup): boolean {
  return !group.multipleChoice && group.required && group.options.length > 1;
}

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
  // Ativa o visual de "Prato do Dia" (checklist fixo pré-marcado + destaque
  // de troca) pros grupos com o shape certo — produto precisa estar marcado
  // como productType="daily_menu" no cadastro (Marmitaria/Restaurante/
  // Churrascaria). Sem essa prop, comportamento 100% igual ao anterior —
  // nunca infere isso sozinho a partir do shape dos grupos.
  dailyMenuStyle?: boolean;
  onClose: () => void;
  onConfirm: (selections: SelectedComplement[]) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ComplementsModal({
  open, productName, productBasePrice = 0, groups, loading,
  theme = "light", dailyMenuStyle = false, onClose, onConfirm,
}: Props) {
  const [selections, setSelections] = useState<Record<string, SelectedComplement[]>>({});

  useEffect(() => {
    if (!open) return;
    // Grupos "sempre incluso" já nascem 100% marcados — não é uma decisão do
    // cliente, é o que vem no prato por padrão (ver isFixedInclusion acima).
    // Só ativa pra produto marcado como "Prato do Dia" (dailyMenuStyle).
    const initial: Record<string, SelectedComplement[]> = {};
    for (const g of groups) {
      if (!dailyMenuStyle || !isFixedInclusion(g)) continue;
      initial[g.id] = g.options.map((option) => ({
        complementOptionId: option.id,
        complementName:     g.name,
        optionName:         option.name,
        price:              g.chargesExtra ? Number(option.price) : 0,
        quantity:           1,
      }));
    }
    setSelections(initial);
  }, [open, productName, groups, dailyMenuStyle]);

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
    const min = g.minOptions || 1;
    return groupQty(g) >= min;
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

    if (group.maxOptions > 0 && groupQty(group) >= group.maxOptions) {
      toast.error(`Máximo ${group.maxOptions} em "${group.name}"`);
      return;
    }
    setSelections((p) => ({ ...p, [group.id]: [...current, newSel] }));
  }

  // Soma de unidades do grupo — não confundir com current.length: um grupo
  // pode ter só 1 opção selecionada (ex: "Carne") mas com quantity:6 (achado
  // real: 14/08/2026, cliente pediu "6 esfihas de carne" e não tinha como
  // marcar o mesmo sabor mais de uma vez — cada opção era 0 ou 1, nunca N).
  function groupQty(group: ComplementGroup) {
    return (selections[group.id] || []).reduce((s, x) => s + x.quantity, 0);
  }

  // Incrementa a quantidade de UMA opção específica dentro de um grupo de
  // múltipla escolha — permite "6x Carne" em vez de exigir 6 sabores
  // diferentes. Respeita o teto do grupo (maxOptions) como soma total.
  function incrementOption(group: ComplementGroup, option: ComplementOption) {
    if (group.maxOptions > 0 && groupQty(group) >= group.maxOptions) {
      toast.error(`Máximo ${group.maxOptions} em "${group.name}"`);
      return;
    }
    const current = selections[group.id] || [];
    const existing = current.find((s) => s.complementOptionId === option.id);
    if (existing) {
      setSelections((p) => ({
        ...p,
        [group.id]: current.map((s) =>
          s.complementOptionId === option.id ? { ...s, quantity: s.quantity + 1 } : s,
        ),
      }));
      return;
    }
    const newSel: SelectedComplement = {
      complementOptionId: option.id,
      complementName:     group.name,
      optionName:         option.name,
      price:              group.chargesExtra ? Number(option.price) : 0,
      quantity:           1,
    };
    setSelections((p) => ({ ...p, [group.id]: [...current, newSel] }));
  }

  function decrementOption(group: ComplementGroup, option: ComplementOption) {
    const current = selections[group.id] || [];
    const existing = current.find((s) => s.complementOptionId === option.id);
    if (!existing) return;
    if (existing.quantity <= 1) {
      setSelections((p) => ({ ...p, [group.id]: current.filter((s) => s.complementOptionId !== option.id) }));
      return;
    }
    setSelections((p) => ({
      ...p,
      [group.id]: current.map((s) =>
        s.complementOptionId === option.id ? { ...s, quantity: s.quantity - 1 } : s,
      ),
    }));
  }

  function confirm() {
    for (const g of groups) {
      if (!g.required) continue;
      const min = g.minOptions || 1;
      if (groupQty(g) < min) {
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
    optionDisabled: isDark
      ? "bg-[#0c101d] border-[#1d2336] text-zinc-600 opacity-40 cursor-not-allowed"
      : "bg-gray-50 border-gray-100 text-gray-300 opacity-60 cursor-not-allowed",
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
            // Contador regressivo: quantos ainda faltam escolher neste grupo
            // (ex.: "Escolha os 10 Sabores" começa em 10 e vai zerando a cada clique).
            // Soma quantity, não conta opções distintas — "6x Carne" preenche
            // o grupo igual a "1x de 6 sabores diferentes".
            const hasCountdown = group.multipleChoice && group.maxOptions > 1;
            const remaining = hasCountdown ? Math.max(0, group.maxOptions - groupQty(group)) : null;
            const fixedGroup = dailyMenuStyle && isFixedInclusion(group);
            const swapGroup  = dailyMenuStyle && isSwapGroup(group);
            return (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {swapGroup && <RefreshCw size={14} className="text-primary shrink-0" />}
                  <p className="font-bold">{group.name}</p>
                  {fixedGroup ? (
                    <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-500 px-2.5 py-0.5 rounded-full">
                      Sempre incluso
                    </span>
                  ) : swapGroup ? (
                    <span className="text-[11px] font-bold bg-primary/15 text-primary px-2.5 py-0.5 rounded-full">
                      Escolha 1 — pode trocar
                    </span>
                  ) : group.required ? (
                    <span className={cls.badgeReq}>Obrigatório</span>
                  ) : (
                    <span className={cls.badgeOpt}>Opcional</span>
                  )}
                  {!fixedGroup && !swapGroup && hasCountdown && (
                    remaining === 0 ? (
                      <span className="text-[11px] font-bold bg-emerald-500/15 text-emerald-500 px-2.5 py-0.5 rounded-full">
                        ✓ Completo
                      </span>
                    ) : (
                      <span className="text-[12px] font-bold bg-primary/15 text-primary px-2.5 py-0.5 rounded-full">
                        Faltam {remaining}
                      </span>
                    )
                  )}
                </div>

                {fixedGroup ? (
                  // Checklist estático — não são botões, é o que sempre vem
                  // no prato (ver poster de referência: arroz/feijão/salada
                  // sempre marcados com ✓, sem interação nenhuma).
                  <div className="space-y-1.5">
                    {group.options.map((option) => (
                      <div
                        key={option.id}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${
                          isDark
                            ? "bg-[#0c101d]/60 border-[#1d2336] text-zinc-200"
                            : "bg-emerald-50/60 border-emerald-100 text-gray-800"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                        {option.imageUrl && (
                          <img
                            src={option.imageUrl}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-black/10"
                            loading="lazy"
                          />
                        )}
                        <span className="text-sm font-medium truncate">{option.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="space-y-2">
                  {group.options.map((option) => {
                    const sel = selected.find((s) => s.complementOptionId === option.id);
                    const qty = sel?.quantity ?? 0;
                    const isSelected = qty > 0;

                    // Grupo de múltipla escolha: contador +/- por opção, em
                    // vez de um checkbox liga/desliga — permite pedir a
                    // mesma opção mais de uma vez (ex: "6x Carne" num combo
                    // de 6 esfihas, achado real: 14/08/2026, antes só dava
                    // pra marcar cada sabor 1 vez, no máximo 1 de cada).
                    if (group.multipleChoice) {
                      const atMax = hasCountdown && remaining === 0;
                      const disabledInc = atMax && !isSelected;
                      return (
                        <div
                          key={option.id}
                          className={`${cls.optionBase} ${isSelected ? cls.optionOn : cls.optionOff}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {option.imageUrl && (
                              <img
                                src={option.imageUrl}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover shrink-0 border border-black/10"
                                loading="lazy"
                              />
                            )}
                            <span className="text-sm font-medium text-left truncate">{option.name}</span>
                            {group.chargesExtra && Number(option.price) > 0 && (
                              <span className="font-bold text-xs shrink-0 text-primary">
                                +R$ {fmt(Number(option.price))}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {qty > 0 && (
                              <button
                                type="button"
                                onClick={() => decrementOption(group, option)}
                                aria-label={`Diminuir ${option.name}`}
                                className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-lg leading-none ${
                                  isDark ? "border-zinc-600 text-white hover:bg-white/10" : "border-gray-300 text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                −
                              </button>
                            )}
                            {qty > 0 && <span className="w-5 text-center font-bold text-sm">{qty}</span>}
                            <button
                              type="button"
                              onClick={() => !disabledInc && incrementOption(group, option)}
                              disabled={disabledInc}
                              aria-label={`Adicionar ${option.name}`}
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg leading-none transition ${
                                disabledInc
                                  ? isDark ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-gray-100 text-gray-300 cursor-not-allowed"
                                  : "bg-primary text-white hover:opacity-90 active:scale-95"
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Grupo de escolha única (radio) — comportamento original.
                    const disabledByMax = hasCountdown && !isSelected && remaining === 0;
                    return (
                      <button
                        key={option.id}
                        onClick={() => !disabledByMax && toggleOption(group, option)}
                        disabled={disabledByMax}
                        className={`${cls.optionBase} ${isSelected ? cls.optionOn : disabledByMax ? cls.optionDisabled : cls.optionOff}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-primary bg-primary"
                              : isDark ? "border-zinc-600" : "border-gray-300"
                          }`}>
                            {isSelected && <span className="w-2 h-2 bg-white rounded-full" />}
                          </span>
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
                )}
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
