"use client";

import { useState, useCallback } from "react";
import { X, CreditCard, Banknote, QrCode, SplitSquareHorizontal, Plus, Minus } from "lucide-react";
import { OrderDetailsForm, OrderDetails } from "@/components/shared/OrderDetailsForm";

const METHODS = [
  { value: "PIX",         label: "PIX",            icon: <QrCode     size={16} /> },
  { value: "CASH",        label: "Dinheiro",        icon: <Banknote   size={16} /> },
  { value: "CREDIT_CARD", label: "Crédito",         icon: <CreditCard size={16} /> },
  { value: "DEBIT_CARD",  label: "Débito",          icon: <CreditCard size={16} /> },
  { value: "TRANSFER",    label: "Transferência",   icon: <Banknote   size={16} /> },
];

type SplitEntry = { method: string; amount: string };

// Re-export for backward compatibility with imports across the app
export type PdvOrderType = "DINE_IN" | "DELIVERY" | "PICKUP";
export type PdvOrderDetails = OrderDetails;

type Props = {
  open: boolean;
  total: number;
  onClose: () => void;
  orderDetails?: PdvOrderDetails;
  onConfirm: (method: string, received: number, splits: SplitEntry[] | undefined, details: PdvOrderDetails) => void;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PaymentModal({ open, total, onClose, orderDetails, onConfirm }: Props) {
  const [split, setSplit]     = useState(false);
  const [method, setMethod]   = useState("PIX");
  const [received, setReceived] = useState("");
  const [localDetails, setLocalDetails] = useState<PdvOrderDetails>({
    orderType: "DINE_IN",
    tableNumber: "",
    customerName: "",
    customerPhone: "",
    address: "",
    addressNumber: "",
    complement: "",
    bairro: "",
    cidade: "",
    cep: "",
  });
  const [splits, setSplits] = useState<SplitEntry[]>([
    { method: "PIX",  amount: "" },
    { method: "CASH", amount: "" },
  ]);

  // Use passed-in orderDetails if provided (PDV cart already has them), else use local state
  const details: PdvOrderDetails = orderDetails ?? localDetails;

  const change = !split && method === "CASH"
    ? Math.max(0, (parseFloat(received) || 0) - total)
    : 0;

  const splitTotal = splits.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0);
  const splitDiff  = total - splitTotal;

  const updateSplit = useCallback((idx: number, patch: Partial<SplitEntry>) => {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }, []);

  function addSplit() {
    if (splits.length >= 3) return;
    setSplits(prev => [...prev, { method: "DEBIT_CARD", amount: "" }]);
  }

  function removeSplit(idx: number) {
    if (splits.length <= 2) return;
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }

  function autoFill(idx: number) {
    const otherSum = splits.reduce((a, s, i) => i === idx ? a : a + (parseFloat(s.amount) || 0), 0);
    const remaining = Math.max(0, total - otherSum);
    updateSplit(idx, { amount: remaining.toFixed(2) });
  }

  function isValid(): boolean {
    const d = details;
    if (d.orderType === "DINE_IN" && !d.tableNumber?.trim()) return false;
    if (d.orderType === "DELIVERY" && !d.address?.trim()) return false;
    if (split && Math.abs(splitDiff) > 0.01) return false;
    return true;
  }

  function handleConfirm() {
    if (!isValid()) return;
    if (split) {
      onConfirm("SPLIT", total, splits, details);
    } else {
      onConfirm(method, parseFloat(received) || total, undefined, details);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#050816] border border-[#1d2336] rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#161b2d] shrink-0">
          <div>
            <h2 className="text-xl font-black text-white">Pagamento</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Total: <span className="text-blue-400 font-bold">{fmt(total)}</span></p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Order details — only shown when not pre-filled by caller */}
          {!orderDetails && (
            <OrderDetailsForm
              value={localDetails}
              onChange={setLocalDetails}
              compact
            />
          )}

          {/* Toggle: single / split */}
          <div className="flex gap-2">
            <button
              onClick={() => setSplit(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${
                !split ? "bg-blue-600 border-blue-600 text-white" : "bg-[#0c101d] border-[#1d2336] text-zinc-400"
              }`}
            >
              Pagamento único
            </button>
            <button
              onClick={() => setSplit(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition flex items-center justify-center gap-2 ${
                split ? "bg-blue-600 border-blue-600 text-white" : "bg-[#0c101d] border-[#1d2336] text-zinc-400"
              }`}
            >
              <SplitSquareHorizontal size={14} /> Dividir conta
            </button>
          </div>

          {/* Single payment */}
          {!split && (
            <>
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                        method === m.value
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-[#0c101d] border-[#1d2336] text-zinc-400 hover:border-blue-600/40"
                      }`}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {method === "CASH" && (
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Valor recebido</p>
                  <input
                    type="number"
                    value={received}
                    onChange={e => setReceived(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
                  />
                  {change > 0 && (
                    <div className="mt-3 flex items-center justify-between bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-4 py-3">
                      <span className="text-zinc-400 text-sm">Troco</span>
                      <span className="text-yellow-400 font-black text-lg">{fmt(change)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Split payment — up to 3 */}
          {split && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 font-semibold uppercase">Divisão — {fmt(total)}</p>
                {splits.length < 3 && (
                  <button
                    onClick={addSplit}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition"
                  >
                    <Plus size={13} /> 3ª forma
                  </button>
                )}
              </div>

              {splits.map((s, i) => (
                <div key={i} className="bg-[#0c101d] border border-[#1d2336] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-sm text-zinc-400 font-medium">Pagamento {i + 1}</span>
                    </div>
                    {i >= 2 && (
                      <button onClick={() => removeSplit(i)} className="w-6 h-6 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-700/40 flex items-center justify-center transition">
                        <Minus size={12} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={s.method}
                      onChange={e => updateSplit(i, { method: e.target.value })}
                      className="bg-[#161b2d] border border-[#1d2336] text-white rounded-xl px-3 py-2 text-sm"
                    >
                      {METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        value={s.amount}
                        onChange={e => updateSplit(i, { amount: e.target.value })}
                        placeholder="R$ 0,00"
                        className="w-full bg-[#161b2d] border border-[#1d2336] text-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 pr-12"
                      />
                      <button
                        onClick={() => autoFill(i)}
                        title="Preencher com o restante"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-600/10 px-1.5 py-0.5 rounded-md"
                      >
                        resto
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Remaining */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                Math.abs(splitDiff) < 0.01
                  ? "bg-green-900/20 border-green-700/30"
                  : "bg-red-900/10 border-red-700/20"
              }`}>
                <span className="text-sm text-zinc-400">
                  {splitDiff > 0.01 ? "Faltam" : splitDiff < -0.01 ? "Excesso" : "✓ Total conferido"}
                </span>
                {Math.abs(splitDiff) > 0.01 && (
                  <span className={`font-black text-lg ${splitDiff > 0 ? "text-red-400" : "text-yellow-400"}`}>
                    {fmt(Math.abs(splitDiff))}
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-3 grid grid-cols-2 gap-3 shrink-0 border-t border-[#161b2d]">
          <button
            onClick={onClose}
            className="py-3.5 rounded-2xl bg-[#0c101d] border border-[#1d2336] text-zinc-400 hover:text-white font-bold text-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid()}
            className="py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition"
          >
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
