"use client";

import { useRef, useState } from "react";
import { Loader2, UtensilsCrossed, Bike, PackageCheck } from "lucide-react";

export type PdvOrderType = "DINE_IN" | "DELIVERY" | "PICKUP";

export type OrderDetails = {
  orderType: PdvOrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  // Address fields (used for DELIVERY)
  address?: string;       // full street line (rua + número)
  addressNumber?: string;
  complement?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
};

type Props = {
  value: OrderDetails;
  onChange: (v: OrderDetails) => void;
  /** compact = less spacing (used inside PaymentModal) */
  compact?: boolean;
};

export function OrderDetailsForm({ value, onChange, compact }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(patch: Partial<OrderDetails>) {
    onChange({ ...value, ...patch });
  }

  async function fetchCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.erro) return;
      set({
        address: d.logradouro || value.address,
        bairro: d.bairro || value.bairro,
        cidade: d.localidade || value.cidade,
      });
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }

  function onCepChange(v: string) {
    set({ cep: v });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCep(v), 600);
  }

  const gap = compact ? "space-y-3" : "space-y-4";
  const inputCls = "w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 placeholder-zinc-600";
  const labelCls = "block text-xs text-zinc-500 font-semibold uppercase mb-1.5 tracking-wide";

  return (
    <div className={gap}>
      {/* Order type selector */}
      <div>
        <p className={labelCls}>Tipo de atendimento</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "DINE_IN"  as const, label: "Mesa",     icon: <UtensilsCrossed size={14} /> },
            { value: "DELIVERY" as const, label: "Entrega",  icon: <Bike            size={14} /> },
            { value: "PICKUP"   as const, label: "Retirada", icon: <PackageCheck    size={14} /> },
          ]).map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => set({ orderType: item.value })}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition ${
                value.orderType === item.value
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-[#0c101d] border-[#1d2336] text-zinc-400 hover:border-green-600/40"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* DINE_IN: table number */}
      {value.orderType === "DINE_IN" && (
        <div>
          <p className={labelCls}>Mesa *</p>
          <input
            value={value.tableNumber ?? ""}
            onChange={e => set({ tableNumber: e.target.value })}
            placeholder="Número da mesa"
            inputMode="numeric"
            className={inputCls}
          />
        </div>
      )}

      {/* DELIVERY / PICKUP: customer info */}
      {value.orderType !== "DINE_IN" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 sm:col-span-1">
            <p className={labelCls}>Cliente</p>
            <input
              value={value.customerName ?? ""}
              onChange={e => set({ customerName: e.target.value })}
              placeholder="Nome do cliente"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className={labelCls}>Telefone</p>
            <input
              value={value.customerPhone ?? ""}
              onChange={e => set({ customerPhone: e.target.value })}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* DELIVERY: full address */}
      {value.orderType === "DELIVERY" && (
        <>
          {/* CEP */}
          <div>
            <p className={labelCls}>
              CEP
              {cepLoading && <Loader2 size={11} className="inline ml-1.5 animate-spin text-blue-400" />}
            </p>
            <input
              value={value.cep ?? ""}
              onChange={e => onCepChange(e.target.value)}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              className={inputCls}
            />
          </div>

          {/* Rua + Número */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <p className={labelCls}>Rua / Logradouro *</p>
              <input
                value={value.address ?? ""}
                onChange={e => set({ address: e.target.value })}
                placeholder="Ex: Rua das Flores"
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>Número</p>
              <input
                value={value.addressNumber ?? ""}
                onChange={e => set({ addressNumber: e.target.value })}
                placeholder="123"
                className={inputCls}
              />
            </div>
          </div>

          {/* Complemento + Bairro */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={labelCls}>Complemento</p>
              <input
                value={value.complement ?? ""}
                onChange={e => set({ complement: e.target.value })}
                placeholder="Apto, bloco..."
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>Bairro *</p>
              <input
                value={value.bairro ?? ""}
                onChange={e => set({ bairro: e.target.value })}
                placeholder="Bairro"
                className={inputCls}
              />
            </div>
          </div>

          {/* Cidade */}
          <div>
            <p className={labelCls}>Cidade</p>
            <input
              value={value.cidade ?? ""}
              onChange={e => set({ cidade: e.target.value })}
              placeholder="Cidade"
              className={inputCls}
            />
          </div>
        </>
      )}
    </div>
  );
}
