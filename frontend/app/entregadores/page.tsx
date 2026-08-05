"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bike, Plus, Phone, MapPin, Star, CheckCircle,
  XCircle, Search, Package, DollarSign, X, Eye, EyeOff,
  Pencil, Loader2, ToggleLeft, ToggleRight, Receipt, CheckCheck, Link2,
} from "lucide-react";
import { api } from "@/services/api";
import toast from "react-hot-toast";

interface Driver {
  id: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
  lastSeenAt?: string | null;
  companyId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  // computed stats (may be absent)
  _count?: { orders: number };
  // FIX: total já pago em ganhos, vindo do backend (drivers.service.ts findAll)
  totalEarnings?: number;
}

const STATUS_COLOR: Record<string, string> = {
  online:  "bg-green-100 text-green-700 border border-green-200",
  busy:    "bg-orange-100 text-orange-700 border border-orange-200",
  offline: "bg-gray-100 text-gray-500 border border-gray-200",
};
const STATUS_DOT: Record<string, string> = {
  online: "bg-green-500",
  busy:   "bg-orange-400",
  offline:"bg-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  busy:   "Em entrega",
  offline:"Offline",
};

// Janela de "recentemente ativo" — o app do entregador manda heartbeat a
// cada 30s (foreground) e o GPS atualiza a cada ~5s enquanto em rota; 3 min
// dá margem real pra rede instável sem deixar "Online" pra sempre.
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function driverStatus(d: Driver): "online" | "busy" | "offline" {
  if (!d.user.isActive) return "offline";
  const recentlyActive =
    !!d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
  // Sem lastSeenAt (nunca abriu o app) ou fora da janela recente = offline,
  // mesmo que isAvailable ainda esteja true (default do schema, nunca muda
  // sozinho) -- achado real: entregador que nunca logou aparecia "Online".
  if (!recentlyActive) return "offline";
  if (d.isAvailable) return "online";
  return "busy";
}

const VEHICLE_TYPES = ["Moto", "Bicicleta", "Carro", "Van", "A pé"];

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400 bg-white";
const label = "block text-xs text-gray-500 font-semibold uppercase mb-1 tracking-wide";

/* ─── Nova entregador modal ─────────────────────────────────────────────────── */
function NovoEntregadorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (d: Driver) => void;
}) {
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    vehicleType: "Moto", vehiclePlate: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim())  { toast.error("Nome obrigatório"); return; }
    if (!form.email.trim()) { toast.error("E-mail obrigatório"); return; }
    setSaving(true);
    try {
      const res = await api.post("/drivers", {
        name:        form.name.trim(),
        email:       form.email.trim().toLowerCase(),
        password:    form.password || undefined,
        phone:       form.phone.trim() || undefined,
        vehicleType: form.vehicleType || undefined,
        vehiclePlate:form.vehiclePlate.trim() || undefined,
      });
      toast.success(`Entregador ${form.name} cadastrado!`);
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao cadastrar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Bike size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-900">Novo Entregador</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className={label}>Nome completo *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: João Silva" className={inp} />
          </div>

          {/* Email */}
          <div>
            <label className={label}>E-mail (login) *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="joao@empresa.com" className={inp} />
          </div>

          {/* Password */}
          <div>
            <label className={label}>Senha (deixe em branco para usar padrão)</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Padrão: Entregador@123"
                className={`${inp} pr-10`}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={label}>Telefone / WhatsApp</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(00) 00000-0000" inputMode="tel" className={inp} />
          </div>

          {/* Vehicle type */}
          <div>
            <label className={label}>Tipo de veículo</label>
            <select value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
              className={inp}>
              {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Plate */}
          <div>
            <label className={label}>Placa do veículo</label>
            <input
              value={form.vehiclePlate}
              onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value.toUpperCase() }))}
              placeholder="Ex: ABC-1234"
              className={inp}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? "Cadastrando…" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Editar entregador modal ───────────────────────────────────────────────── */
function EditarDriverModal({
  driver,
  onClose,
  onUpdated,
}: {
  driver: Driver;
  onClose: () => void;
  onUpdated: (d: Driver) => void;
}) {
  const [form, setForm] = useState({
    name:        driver.user.name,
    phone:       driver.phone ?? "",
    vehicleType: driver.vehicleType ?? "Moto",
    vehiclePlate:driver.vehiclePlate ?? "",
    isActive:    driver.user.isActive,
    isAvailable: driver.isAvailable,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await api.patch(`/drivers/${driver.id}`, {
        name:        form.name.trim(),
        phone:       form.phone.trim() || undefined,
        vehicleType: form.vehicleType,
        vehiclePlate:form.vehiclePlate.trim(),
        isActive:    form.isActive,
        isAvailable: form.isAvailable,
      });
      toast.success("Entregador atualizado!");
      onUpdated(res.data);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao atualizar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-orange-500" />
            <h2 className="font-bold text-gray-900">Editar Entregador</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={label}>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={label}>Telefone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="(00) 00000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Tipo veículo</label>
              <select value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))} className={inp}>
                {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Placa</label>
              <input value={form.vehiclePlate} onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value.toUpperCase() }))} className={inp} />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm text-gray-700 font-medium">Conta ativa</span>
              <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`transition ${form.isActive ? "text-green-500" : "text-gray-400"}`}>
                {form.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm text-gray-700 font-medium">Disponível para entregas</span>
              <button onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                className={`transition ${form.isAvailable ? "text-orange-500" : "text-gray-400"}`}>
                {form.isAvailable ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TodayDelivery {
  id: string;
  number: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  total: number;
  driverFee: number | null;
  deliveredAt: string | null;
  createdAt: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

/**
 * Lista de entregas concluídas hoje por um entregador — aberta ao clicar no
 * número do card "Entregas". Antes só existia a contagem, sem jeito nenhum
 * de conferir quais pedidos são (pedido explícito do usuário depois de
 * desconfiar que a contagem estava errada/misturando dia anterior).
 */
function EntregasHojeModal({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const [items, setItems] = useState<TodayDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/drivers/${driver.id}/deliveries-today`)
      .then((res) => { if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancelled) toast.error("Erro ao carregar entregas de hoje"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [driver.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-500" />
            <h2 className="font-bold text-gray-900">Entregas de hoje — {driver.user.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nenhuma entrega concluída hoje ainda.</p>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="border border-gray-100 rounded-xl p-3.5 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      {it.number ? `Pedido #${it.number}` : `#${it.id.slice(-6).toUpperCase()}`}
                    </span>
                    <span className="text-xs text-gray-400">{fmtTime(it.deliveredAt)}</span>
                  </div>
                  {it.customerName && (
                    <p className="text-sm text-gray-700">{it.customerName}</p>
                  )}
                  {it.deliveryAddress && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-orange-400 shrink-0" />
                      {it.deliveryAddress}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-500">Total: <span className="font-semibold text-gray-800">R$ {it.total.toFixed(2)}</span></span>
                    {it.driverFee != null && (
                      <span className="text-green-600 font-semibold">Repasse: R$ {it.driverFee.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DriverEarningRow {
  id: string;
  driverAmount: number;
  customerFee: number;
  status: "PENDING" | "PAID";
  createdAt: string;
  order: { id: string; createdAt: string; total: number; deliveryAddress: string | null } | null;
}

interface DriverPaymentRow {
  id: string;
  totalAmount: number;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  createdAt: string;
}

// Chave "YYYY-MM-DD" no fuso de Brasília (mesma técnica do backend
// toBrazilDateKey) -- necessário pro agrupamento por dia ordenar certo;
// "DD/MM/YYYY" (toLocaleDateString pt-BR puro) não ordena lexicograficamente.
function brazilDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function brazilDateLabel(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Histórico de entregas (agrupado por dia, pra decidir/conferir o
 * pagamento) + fluxo de pagamento do entregador — pedido explícito do
 * usuário: "puxar histórico de entregas para fazer o pagamento e ver
 * quantas entregas foram feitas por dia/total". O backend (DriverEarning/
 * DriverPayment) já existia e já era usado no app do PRÓPRIO entregador
 * (/driver/earnings) — só não tinha nenhuma tela equivalente pro admin.
 */
function HistoricoPagamentoModal({
  driver,
  onClose,
  onPaid,
}: {
  driver: Driver;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [earnings, setEarnings] = useState<DriverEarningRow[]>([]);
  const [payments, setPayments] = useState<DriverPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingPayment, setClosingPayment] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"resumo" | "pagamentos">("resumo");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, p] = await Promise.all([
        api.get(`/drivers/${driver.id}/earnings`),
        api.get(`/drivers/${driver.id}/payments`),
      ]);
      setEarnings(Array.isArray(e.data) ? e.data : []);
      setPayments(Array.isArray(p.data) ? p.data : []);
    } catch {
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [driver.id]);

  useEffect(() => { load(); }, [load]);

  const pending = earnings.filter((e) => e.status === "PENDING");
  const pendingTotal = pending.reduce((s, e) => s + Number(e.driverAmount), 0);
  const paidTotal = earnings
    .filter((e) => e.status === "PAID")
    .reduce((s, e) => s + Number(e.driverAmount), 0);

  // Agrupa TODAS as entregas (não só as pendentes) por dia -- responde
  // "quantas entregas foram feitas por dia", não só o saldo a pagar.
  const byDay = new Map<string, { count: number; total: number }>();
  for (const e of earnings) {
    const key = brazilDateKey(e.createdAt);
    const cur = byDay.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(e.driverAmount);
    byDay.set(key, cur);
  }
  const dayRows = [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => b.date.localeCompare(a.date));

  async function closePayment() {
    setClosingPayment(true);
    try {
      await api.post(`/drivers/${driver.id}/payments`);
      toast.success("Pagamento fechado! Confirme quando pagar de verdade.");
      await load();
      setTab("pagamentos");
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join("; ") : (msg || "Erro ao fechar pagamento"));
    } finally {
      setClosingPayment(false);
    }
  }

  async function confirmPaid(paymentId: string) {
    setPayingId(paymentId);
    try {
      await api.patch(`/drivers/payments/${paymentId}/pay`);
      toast.success("Pagamento marcado como pago!");
      await load();
      onPaid();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao confirmar pagamento");
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-green-600" />
            <h2 className="font-bold text-gray-900">Histórico & Pagamento — {driver.user.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 p-6 pb-3">
              <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-100">
                <p className="text-lg font-bold text-yellow-700">R$ {pendingTotal.toFixed(2)}</p>
                <p className="text-[11px] text-yellow-600 font-medium">A pagar ({pending.length})</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                <p className="text-lg font-bold text-green-700">R$ {paidTotal.toFixed(2)}</p>
                <p className="text-[11px] text-green-600 font-medium">Já pago</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <p className="text-lg font-bold text-gray-800">{earnings.length}</p>
                <p className="text-[11px] text-gray-500 font-medium">Entregas no total</p>
              </div>
            </div>

            {pending.length > 0 && (
              <div className="px-6 pb-4">
                <button
                  onClick={closePayment}
                  disabled={closingPayment}
                  className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  {closingPayment ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                  Fechar pagamento de R$ {pendingTotal.toFixed(2)} ({pending.length} entrega{pending.length > 1 ? "s" : ""})
                </button>
              </div>
            )}

            <div className="px-6 flex gap-4 border-b border-gray-100">
              <button
                onClick={() => setTab("resumo")}
                className={`pb-2 text-xs font-semibold border-b-2 transition ${tab === "resumo" ? "border-green-600 text-green-700" : "border-transparent text-gray-400"}`}
              >
                Entregas por dia
              </button>
              <button
                onClick={() => setTab("pagamentos")}
                className={`pb-2 text-xs font-semibold border-b-2 transition ${tab === "pagamentos" ? "border-green-600 text-green-700" : "border-transparent text-gray-400"}`}
              >
                Pagamentos ({payments.length})
              </button>
            </div>

            <div className="p-6 pt-4">
              {tab === "resumo" ? (
                dayRows.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhuma entrega registrada ainda.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayRows.map((r) => (
                      <div key={r.date} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="text-sm font-medium text-gray-700">{brazilDateLabel(r.date)}</span>
                        <span className="text-xs text-gray-500">{r.count} entrega{r.count > 1 ? "s" : ""}</span>
                        <span className="text-sm font-bold text-gray-800">R$ {r.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : payments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum pagamento fechado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="text-sm font-bold text-gray-800">R$ {Number(p.totalAmount).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">
                          {p.status === "PAID" && p.paidAt
                            ? `Pago em ${new Date(p.paidAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                            : `Fechado em ${new Date(p.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                        </p>
                      </div>
                      {p.status === "PAID" ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                          <CheckCheck size={12} /> Pago
                        </span>
                      ) : (
                        <button
                          onClick={() => confirmPaid(p.id)}
                          disabled={payingId === p.id}
                          className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                        >
                          {payingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                          Marcar como pago
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export default function EntregadoresPage() {
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<"all"|"online"|"busy"|"offline">("all");
  const [showNovo, setShowNovo]       = useState(false);
  const [editDriver, setEditDriver]   = useState<Driver | null>(null);
  const [deliveriesDriver, setDeliveriesDriver] = useState<Driver | null>(null);
  const [historyDriver, setHistoryDriver] = useState<Driver | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/drivers");
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Erro ao carregar entregadores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = drivers.filter(d => {
    const s = driverStatus(d);
    const matchSearch =
      d.user.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone ?? "").includes(search) ||
      (d.vehicleType ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s === filter;
    return matchSearch && matchFilter;
  });

  const online  = drivers.filter(d => driverStatus(d) === "online").length;
  const busy    = drivers.filter(d => driverStatus(d) === "busy").length;
  const offline = drivers.filter(d => driverStatus(d) === "offline").length;

  function onCreated(d: Driver) { setDrivers(prev => [d, ...prev]); }
  function onUpdated(d: Driver) { setDrivers(prev => prev.map(x => x.id === d.id ? d : x)); }

  const [copyingInvite, setCopyingInvite] = useState<string | null>(null);
  async function copyInviteLink(driverId: string) {
    setCopyingInvite(driverId);
    try {
      const { data } = await api.post(`/drivers/${driverId}/invite-link`);
      await navigator.clipboard.writeText(data.link);
      toast.success("Link de convite copiado! Mande pro entregador.");
    } catch {
      toast.error("Erro ao gerar link de convite");
    } finally {
      setCopyingInvite(null);
    }
  }

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Online agora",  value: online,  icon: <CheckCircle size={20} className="text-green-500"  />, color: "text-green-600"  },
          { label: "Em entrega",    value: busy,    icon: <Bike        size={20} className="text-orange-500" />, color: "text-orange-600" },
          { label: "Offline",       value: offline, icon: <XCircle     size={20} className="text-gray-400"   />, color: "text-gray-500"   },
          { label: "Total",         value: drivers.length, icon: <Package size={20} className="text-blue-500" />, color: "text-blue-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Novo Entregador */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por nome, telefone ou veículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "online", "busy", "offline"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                filter === f
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
              }`}
            >
              {{ all: "Todos", online: "Online", busy: "Em entrega", offline: "Offline" }[f]}
            </button>
          ))}
        </div>
        {/* FIX: botão "Novo Entregador" agora fica sempre visível aqui,
            não só quando a lista está vazia. Antes era impossível cadastrar
            um novo entregador se já existisse pelo menos um na lista. */}
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition whitespace-nowrap"
        >
          <Plus size={16} />
          Novo Entregador
        </button>
      </div>

      {/* Driver cards */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <Bike size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-lg">
            {drivers.length === 0 ? "Nenhum entregador cadastrado" : "Nenhum entregador encontrado"}
          </p>
          {drivers.length === 0 && (
            <button
              onClick={() => setShowNovo(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition"
            >
              + Cadastrar primeiro entregador
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(d => {
            const status = driverStatus(d);
            return (
              <div key={d.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                      {d.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{d.user.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Phone size={11} /> {d.phone ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${STATUS_COLOR[status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                      {STATUS_LABEL[status]}
                    </span>
                    <button
                      onClick={() => setHistoryDriver(d)}
                      className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 flex items-center justify-center transition"
                      title="Histórico & Pagamento"
                    >
                      <Receipt size={14} />
                    </button>
                    <button
                      onClick={() => copyInviteLink(d.id)}
                      disabled={copyingInvite === d.id}
                      className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-500 flex items-center justify-center transition disabled:opacity-50"
                      title="Copiar link de convite (entregador define a própria senha)"
                    >
                      {copyingInvite === d.id ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    </button>
                    <button
                      onClick={() => setEditDriver(d)}
                      className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-orange-100 text-gray-500 hover:text-orange-500 flex items-center justify-center transition"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                {(d.vehicleType || d.vehiclePlate) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                    <MapPin size={12} className="text-orange-400" />
                    {[d.vehicleType, d.vehiclePlate].filter(Boolean).join(" — ")}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-500 mb-0.5">
                      <Star size={12} fill="currentColor" />
                      <span className="text-sm font-bold text-gray-900">—</span>
                    </div>
                    <p className="text-xs text-gray-400">Avaliação</p>
                  </div>
                  {/* FIX: agora mostra a contagem real de entregas finalizadas
                      (vem de d._count.orders, preenchido pelo backend) —
                      clicável, abre a lista de quais pedidos são (pedido do
                      usuário depois de desconfiar da contagem parecer errada) */}
                  <button
                    type="button"
                    onClick={() => setDeliveriesDriver(d)}
                    disabled={!d._count?.orders}
                    className="bg-gray-50 rounded-xl p-2.5 text-center hover:bg-gray-100 transition disabled:cursor-default disabled:hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Package size={12} className="text-blue-400" />
                      <span className="text-sm font-bold text-gray-900">{d._count?.orders ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-400">Entregas</p>
                  </button>
                  {/* FIX: agora mostra o total real já pago em ganhos
                      (vem de d.totalEarnings, preenchido pelo backend) */}
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <DollarSign size={12} className="text-green-500" />
                      <span className="text-sm font-bold text-gray-900">
                        {d.totalEarnings ? `R$ ${d.totalEarnings.toFixed(2)}` : "R$ 0,00"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">Ganhos</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNovo && (
        <NovoEntregadorModal onClose={() => setShowNovo(false)} onCreated={onCreated} />
      )}
      {editDriver && (
        <EditarDriverModal
          driver={editDriver}
          onClose={() => setEditDriver(null)}
          onUpdated={onUpdated}
        />
      )}
      {deliveriesDriver && (
        <EntregasHojeModal
          driver={deliveriesDriver}
          onClose={() => setDeliveriesDriver(null)}
        />
      )}
      {historyDriver && (
        <HistoricoPagamentoModal
          driver={historyDriver}
          onClose={() => setHistoryDriver(null)}
          onPaid={() => load()}
        />
      )}
    </div>
  );
}