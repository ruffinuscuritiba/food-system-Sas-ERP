"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { Ticket, Plus, X, Loader2, Copy, Power } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: string | number;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const TYPE_OPTIONS = [
  { v: "PERCENTAGE" as const, label: "%", desc: "Percentual" },
  { v: "FIXED_AMOUNT" as const, label: "R$", desc: "Valor fixo" },
  { v: "FREE_SHIPPING" as const, label: "🚚", desc: "Frete grátis" },
];

function couponValueLabel(c: Coupon) {
  if (c.type === "FREE_SHIPPING") return "Frete grátis";
  if (c.type === "PERCENTAGE") return `${Number(c.value)}% OFF`;
  return `R$ ${Number(c.value).toFixed(2)} OFF`;
}

function gerarCodigoCupom() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CuponsTab() {
  const { user } = useAuthStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: gerarCodigoCupom(),
    type: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING",
    value: "",
    usageLimit: "",
    expiresAt: "",
  });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/coupons");
      setCoupons(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openForm() {
    setForm({ code: gerarCodigoCupom(), type: "PERCENTAGE", value: "", usageLimit: "", expiresAt: "" });
    setShowForm(true);
  }

  async function saveCupom() {
    if (form.type !== "FREE_SHIPPING" && (!form.value || Number(form.value) <= 0)) {
      toast.error("Informe o valor do desconto"); return;
    }
    if (!form.code.trim()) {
      toast.error("Informe o código do cupom"); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: form.type === "FREE_SHIPPING" ? 0 : Number(form.value),
      };
      if (form.usageLimit) payload.usageLimit = Number(form.usageLimit);
      if (form.expiresAt) payload.expiresAt = form.expiresAt;
      await api.post("/coupons", payload);
      toast.success(`Cupom ${payload.code} criado!`);
      setShowForm(false);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erro ao criar cupom";
      toast.error(Array.isArray(msg) ? msg.join(" | ") : String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCupom(id: string) {
    setTogglingId(id);
    try {
      await api.patch(`/coupons/${id}/toggle`);
      await load();
    } catch {
      toast.error("Erro ao alternar cupom");
    } finally {
      setTogglingId(null);
    }
  }

  function copyLink(code: string) {
    const link = `${window.location.origin}/menu/${user?.companyId}?cupom=${encodeURIComponent(code)}`;
    navigator.clipboard?.writeText(link);
    toast.success("Link do cupom copiado!");
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Ticket size={18} className="text-primary" /> Cupons de desconto
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cupons nunca descontam bebidas nem itens já em promoção acima de 40% off.
          </p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus size={16} /> Novo Cupom
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-sm">
          Nenhum cupom criado ainda.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Desconto</th>
                <th className="px-5 py-3">Usos</th>
                <th className="px-5 py-3">Validade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-mono font-black text-gray-900 tracking-wider">{c.code}</td>
                  <td className="px-5 py-3 text-gray-700">{couponValueLabel(c)}</td>
                  <td className="px-5 py-3 text-gray-500">{c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("pt-BR") : "Sem validade"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                      {c.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyLink(c.code)}
                        className="flex items-center gap-1 text-primary hover:opacity-80 font-semibold text-xs"
                      >
                        <Copy size={13} /> Link
                      </button>
                      <button
                        onClick={() => toggleCupom(c.id)}
                        disabled={togglingId === c.id}
                        className={`flex items-center gap-1 font-semibold text-xs disabled:opacity-50 ${c.active ? "text-red-500 hover:text-red-600" : "text-emerald-600 hover:text-emerald-700"}`}
                      >
                        {togglingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                        {c.active ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Novo Cupom</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Código do cupom</label>
                <div className="flex gap-2">
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="flex-1 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold uppercase tracking-widest outline-none focus:border-primary"
                    placeholder="PROMO10"
                  />
                  <button
                    onClick={() => setForm((f) => ({ ...f, code: gerarCodigoCupom() }))}
                    title="Gerar código aleatório"
                    className="px-3 py-2.5 rounded-xl border border-gray-300 text-gray-500 hover:text-gray-800 transition text-xs font-bold"
                  >↻</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de desconto</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setForm((f) => ({ ...f, type: opt.v }))}
                      className={`py-2.5 rounded-xl border text-xs font-semibold transition flex flex-col items-center gap-0.5 ${
                        form.type === opt.v ? "bg-primary border-primary text-white" : "border-gray-300 text-gray-500 hover:border-primary/40"
                      }`}
                    >
                      <span className="text-base">{opt.label}</span><span className="text-[9px]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {form.type !== "FREE_SHIPPING" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {form.type === "PERCENTAGE" ? "Percentual de desconto (%)" : "Valor do desconto (R$)"}
                  </label>
                  <input
                    type="number" min={0} max={form.type === "PERCENTAGE" ? 100 : undefined}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder={form.type === "PERCENTAGE" ? "Ex: 10" : "Ex: 5.00"}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Limite de usos</label>
                  <input
                    type="number" min={1} value={form.usageLimit}
                    onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                    placeholder="Ilimitado"
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Validade</label>
                  <input
                    type="date" value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveCupom}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Criar Cupom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
