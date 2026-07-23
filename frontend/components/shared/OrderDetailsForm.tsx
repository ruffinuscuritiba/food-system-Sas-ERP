"use client";

import { useRef, useState, useEffect } from "react";
import { Loader2, UtensilsCrossed, Bike, PackageCheck, User, Clock, MapPin, X } from "lucide-react";
import { apiBaseUrl } from "@/services/env";

export type PdvOrderType = "DINE_IN" | "DELIVERY" | "PICKUP";

export type OrderDetails = {
  orderType: PdvOrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  /** Taxa de entrega (string para preservar vírgula digitada pelo operador) */
  deliveryFee?: string;
  /** ID da DeliveryZone resolvida automaticamente pelo bairro */
  deliveryZoneId?: string;
};

type CustomerLookup = {
  name: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  cep: string;
  lastOrder: { total: number; createdAt: string } | null;
};

type AddressSuggestion = {
  rua: string;
  bairro: string;
  cidade: string;
  cep: string;
};

type DeliveryZone = {
  id: string;
  name: string;
  neighborhood: string | null;
  clientFee: number;
  type: string;
};

type Props = {
  value: OrderDetails;
  onChange: (v: OrderDetails) => void;
  compact?: boolean;
  companyId?: string;
  token?: string;
  /** Cidade/UF da loja — usados pra dar contexto geográfico à busca de rua (Nominatim erra fácil sem isso). */
  cityHint?: string;
  stateHint?: string;
};

export function OrderDetailsForm({ value, onChange, compact, companyId, token, cityHint, stateHint }: Props) {
  const [cepLoading,       setCepLoading]       = useState(false);
  const [phoneLoading,     setPhoneLoading]      = useState(false);
  const [ruaSuggestions,   setRuaSuggestions]    = useState<AddressSuggestion[]>([]);
  const [ruaLoading,       setRuaLoading]        = useState(false);
  const [showSuggestions,  setShowSuggestions]   = useState(false);
  const [lastOrder,        setLastOrder]         = useState<{ total: number; createdAt: string } | null>(null);
  const [foundName,        setFoundName]         = useState("");
  const [zones,            setZones]             = useState<DeliveryZone[]>([]);
  const [matchedZone,      setMatchedZone]       = useState<DeliveryZone | null>(null);

  const cepDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ruaDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPhone     = useRef<string>("");

  // Fetch delivery zones once when component mounts with companyId
  useEffect(() => {
    if (!companyId) return;
    fetch(`${apiBaseUrl}/delivery-config/public?companyId=${companyId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: DeliveryZone[]) => setZones(data))
      .catch(() => {});
  }, [companyId]);

  function set(patch: Partial<OrderDetails>) {
    onChange({ ...value, ...patch });
  }

  function matchZoneByNeighborhood(bairro: string) {
    if (!bairro || zones.length === 0) return;
    const lower = bairro.toLowerCase().trim();
    const zone = zones.find(z => z.neighborhood?.toLowerCase().trim() === lower) ?? null;
    setMatchedZone(zone);
    onChange({
      ...value,
      bairro,
      deliveryFee: zone ? String(Number(zone.clientFee).toFixed(2)).replace(".", ",") : value.deliveryFee,
      deliveryZoneId: zone?.id ?? undefined,
    });
  }

  function onBairroChange(bairro: string) {
    matchZoneByNeighborhood(bairro);
    if (!zones.length) set({ bairro, deliveryZoneId: undefined });
  }

  // ── CEP autocomplete (secundário) ──────────────────────────────────────────
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
        bairro:  d.bairro     || value.bairro,
        cidade:  d.localidade || value.cidade,
      });
    } catch { /* silent */ }
    finally { setCepLoading(false); }
  }

  function onCepChange(v: string) {
    set({ cep: v });
    if (cepDebounce.current) clearTimeout(cepDebounce.current);
    cepDebounce.current = setTimeout(() => fetchCep(v), 600);
  }

  // ── Rua autocomplete (principal) ───────────────────────────────────────────
  async function fetchRuaSuggestions(term: string) {
    if (term.length < 4) { setRuaSuggestions([]); return; }
    setRuaLoading(true);
    try {
      const params = new URLSearchParams({ q: term });
      if (cityHint) params.set("city", cityHint);
      if (stateHint) params.set("state", stateHint);
      const r = await fetch(`/api/address/search?${params.toString()}`);
      if (!r.ok) return;
      const data: AddressSuggestion[] = await r.json();
      setRuaSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch { /* silent */ }
    finally { setRuaLoading(false); }
  }

  function onRuaChange(v: string) {
    set({ address: v });
    if (ruaDebounce.current) clearTimeout(ruaDebounce.current);
    ruaDebounce.current = setTimeout(() => fetchRuaSuggestions(v), 500);
  }

  function selectRuaSuggestion(s: AddressSuggestion) {
    const bairro = s.bairro || value.bairro || "";
    setShowSuggestions(false);
    setRuaSuggestions([]);
    const zone = zones.find(z => z.neighborhood?.toLowerCase().trim() === bairro.toLowerCase().trim()) ?? null;
    setMatchedZone(zone);
    onChange({
      ...value,
      address: s.rua,
      bairro,
      cidade:  s.cidade  || value.cidade,
      cep:     s.cep     || value.cep,
      deliveryFee: zone ? String(Number(zone.clientFee).toFixed(2)).replace(".", ",") : value.deliveryFee,
      deliveryZoneId: zone?.id ?? undefined,
    });
  }

  // ── Phone lookup ───────────────────────────────────────────────────────────
  async function lookupPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || !companyId) return;
    if (digits === lastPhone.current) return;
    lastPhone.current = digits;

    setPhoneLoading(true);
    setLastOrder(null);
    setFoundName("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(
        `${apiBaseUrl}/orders/customer-lookup?phone=${encodeURIComponent(digits)}`,
        { headers },
      );
      if (!r.ok) return;
      const data: CustomerLookup = await r.json();
      if (!data) return;

      console.log("LOOKUP RESPONSE", data);

      if (data.name)        setFoundName(data.name);
      if (data.lastOrder)   setLastOrder(data.lastOrder);

      // Sobrescreve todos os campos com os dados do cliente encontrado
      const patch: Partial<OrderDetails> = {};
      if (data.name)        patch.customerName  = data.name;
      if (data.rua)         patch.address       = data.rua;
      if (data.numero)      patch.addressNumber = data.numero;
      if (data.complemento) patch.complement    = data.complemento;
      if (data.bairro)      patch.bairro        = data.bairro;
      if (data.cidade)      patch.cidade        = data.cidade;
      if (data.cep)         patch.cep           = data.cep;
      if (Object.keys(patch).length > 0) {
        const newBairro = (patch.bairro ?? value.bairro ?? "").toLowerCase().trim();
        const zone = newBairro ? zones.find(z => z.neighborhood?.toLowerCase().trim() === newBairro) ?? null : null;
        if (zone) {
          setMatchedZone(zone);
          patch.deliveryFee  = String(Number(zone.clientFee).toFixed(2)).replace(".", ",");
          patch.deliveryZoneId = zone.id;
        }
        set(patch);
      }

      // Auto-enrich: se rua presente mas bairro/cidade ausentes, busca Nominatim
      if (data.rua && (!data.bairro || !data.cidade)) {
        enrichFromNominatim(data.rua);
      }
    } catch { /* silent */ }
    finally { setPhoneLoading(false); }
  }

  // Enriquece bairro/cidade/cep via Nominatim quando voltam vazios do lookup
  async function enrichFromNominatim(rua: string) {
    try {
      const params = new URLSearchParams({ q: rua });
      if (cityHint) params.set("city", cityHint);
      if (stateHint) params.set("state", stateHint);
      const r = await fetch(`/api/address/search?${params.toString()}`);
      if (!r.ok) return;
      const suggestions: AddressSuggestion[] = await r.json();
      if (suggestions.length === 0) return;
      const best = suggestions[0];
      const patch: Partial<OrderDetails> = {};
      if (best.bairro) patch.bairro = best.bairro;
      if (best.cidade) patch.cidade = best.cidade;
      if (best.cep)    patch.cep    = best.cep;
      if (Object.keys(patch).length > 0) {
        console.log("NOMINATIM ENRICH", patch);
        set(patch);
      }
    } catch { /* silent */ }
  }

  function onPhoneChange(v: string) {
    set({ customerPhone: v });
    if (v.replace(/\D/g, "") !== lastPhone.current) {
      setLastOrder(null);
      setFoundName("");
    }
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    phoneDebounce.current = setTimeout(() => lookupPhone(v), 500);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const gap      = compact ? "space-y-3" : "space-y-4";
  const inputCls = "w-full bg-[#0c101d] border border-[#1d2336] text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 placeholder-zinc-600";
  const labelCls = "block text-xs text-zinc-500 font-semibold uppercase mb-1.5 tracking-wide";

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString("pt-BR"); }
    catch { return ""; }
  }

  return (
    <div className={gap}>
      {/* Tipo de atendimento */}
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

      {/* DINE_IN: número da mesa */}
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

      {/* DELIVERY / PICKUP: campos de cliente */}
      {value.orderType !== "DINE_IN" && (
        <>
          {/* 1. Telefone */}
          <div>
            <p className={labelCls}>
              Telefone *
              {phoneLoading && <Loader2 size={11} className="inline ml-1.5 animate-spin text-green-400" />}
            </p>
            <input
              value={value.customerPhone ?? ""}
              onChange={e => onPhoneChange(e.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="tel"
              className={inputCls}
            />
            {/* Último pedido / cliente encontrado */}
            {(lastOrder || foundName) && (
              <div className="mt-1.5 flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <User size={12} className="text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {foundName && (
                    <p className="text-xs text-green-300 font-semibold truncate">{foundName}</p>
                  )}
                  {lastOrder && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} className="shrink-0" />
                      Último pedido: R$ {Number(lastOrder.total).toFixed(2).replace(".", ",")} — {fmtDate(lastOrder.createdAt)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setLastOrder(null); setFoundName(""); lastPhone.current = ""; }}
                  className="text-zinc-600 hover:text-zinc-400 shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* 2. Nome */}
          <div>
            <p className={labelCls}>Nome *</p>
            <input
              value={value.customerName ?? ""}
              onChange={e => set({ customerName: e.target.value })}
              placeholder="Nome do cliente"
              className={inputCls}
            />
          </div>
        </>
      )}

      {/* DELIVERY: endereço */}
      {value.orderType === "DELIVERY" && (
        <>
          {/* 3. Rua + Número */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 relative">
              <p className={labelCls}>
                Rua / Logradouro *
                {ruaLoading && <Loader2 size={11} className="inline ml-1.5 animate-spin text-blue-400" />}
              </p>
              <input
                value={value.address ?? ""}
                onChange={e => onRuaChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => ruaSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Ex: Rua das Flores"
                className={inputCls}
                autoComplete="off"
              />
              {showSuggestions && ruaSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#0c101d] border border-[#1d2336] rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {ruaSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => selectRuaSuggestion(s)}
                      className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-[#1d2336] transition text-xs border-b border-[#1d2336] last:border-0"
                    >
                      <MapPin size={11} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{s.rua}</p>
                        {(s.bairro || s.cidade) && (
                          <p className="text-zinc-500 truncate">{[s.bairro, s.cidade].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className={labelCls}>Número *</p>
              <input
                value={value.addressNumber ?? ""}
                onChange={e => set({ addressNumber: e.target.value })}
                placeholder="123"
                className={inputCls}
              />
            </div>
          </div>

          {/* 4. Complemento + Bairro */}
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
              <p className={labelCls}>
                Bairro *
                {matchedZone && (
                  <span className="ml-1.5 text-green-400 font-normal normal-case">
                    · Taxa: R$ {Number(matchedZone.clientFee).toFixed(2).replace(".", ",")}
                  </span>
                )}
              </p>
              <input
                value={value.bairro ?? ""}
                onChange={e => onBairroChange(e.target.value)}
                placeholder="Bairro"
                className={inputCls}
              />
            </div>
          </div>

          {/* 5. Cidade */}
          <div>
            <p className={labelCls}>Cidade *</p>
            <input
              value={value.cidade ?? ""}
              onChange={e => set({ cidade: e.target.value })}
              placeholder="Cidade"
              className={inputCls}
            />
          </div>

          {/* 6. CEP (secundário — preenche se digitado) */}
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

          {/* 7. Taxa de entrega */}
          <div>
            <p className={labelCls}>Taxa de entrega (R$)</p>
            <input
              value={value.deliveryFee ?? ""}
              onChange={e => set({ deliveryFee: e.target.value })}
              placeholder="0,00"
              inputMode="decimal"
              className={inputCls}
            />
          </div>
        </>
      )}
    </div>
  );
}
