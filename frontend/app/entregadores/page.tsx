"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bike, Plus, Phone, MapPin, Star, CheckCircle,
  XCircle, Search, Package, DollarSign, X, Eye, EyeOff,
  Pencil, Loader2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { api } from "@/services/api";
import toast from "react-hot-toast";

interface Driver {
  id: string;
  phone: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
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

function driverStatus(d: Driver): "online" | "busy" | "offline" {
  if (!d.user.isActive) return "offline";
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

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export default function EntregadoresPage() {
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<"all"|"online"|"busy"|"offline">("all");
  const [showNovo, setShowNovo]       = useState(false);
  const [editDriver, setEditDriver]   = useState<Driver | null>(null);

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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bike size={26} className="text-orange-500" /> Entregadores
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie sua equipe de delivery</p>
        </div>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md"
        >
          <Plus size={16} /> Novo Entregador
        </button>
      </div>

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

      {/* Search + Filter */}
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
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Package size={12} className="text-blue-400" />
                      <span className="text-sm font-bold text-gray-900">{d._count?.orders ?? 0}</span>
                    </div>
                    <p className="text-xs text-gray-400">Entregas</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <DollarSign size={12} className="text-green-500" />
                      <span className="text-sm font-bold text-gray-900">—</span>
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
    </div>
  );
}
