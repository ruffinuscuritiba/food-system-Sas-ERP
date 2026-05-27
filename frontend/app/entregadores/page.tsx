"use client";

import { useState } from "react";
import {
  Bike, Plus, Phone, MapPin, Star, Clock, CheckCircle,
  XCircle, Search, Filter, TrendingUp, Package, DollarSign,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string;
  zone: string;
  status: "online" | "busy" | "offline";
  rating: number;
  deliveries: number;
  earnings: number;
}

const MOCK_DRIVERS: Driver[] = [
  { id: "1", name: "Carlos Souza",   phone: "(41) 99999-0001", zone: "Centro / Batel",       status: "online",  rating: 4.9, deliveries: 312, earnings: 2840.50 },
  { id: "2", name: "Marcos Lima",    phone: "(41) 99999-0002", zone: "Água Verde / Portão",  status: "busy",    rating: 4.7, deliveries: 198, earnings: 1920.00 },
  { id: "3", name: "Rafael Costa",   phone: "(41) 99999-0003", zone: "Cajuru / Uberaba",     status: "online",  rating: 4.8, deliveries: 421, earnings: 3410.75 },
  { id: "4", name: "André Pereira",  phone: "(41) 99999-0004", zone: "Xaxim / Capão Raso",   status: "offline", rating: 4.5, deliveries: 87,  earnings: 740.00 },
];

const STATUS_LABEL: Record<string, string>  = { online: "Online", busy: "Em entrega", offline: "Offline" };
const STATUS_COLOR: Record<string, string>  = {
  online:  "bg-green-100 text-green-700 border border-green-200",
  busy:    "bg-orange-100 text-orange-700 border border-orange-200",
  offline: "bg-gray-100 text-gray-500 border border-gray-200",
};
const STATUS_DOT: Record<string, string> = {
  online: "bg-green-500", busy: "bg-orange-400", offline: "bg-gray-400",
};

export default function EntregadoresPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "busy" | "offline">("all");

  const filtered = MOCK_DRIVERS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.zone.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter;
    return matchSearch && matchFilter;
  });

  const online  = MOCK_DRIVERS.filter(d => d.status === "online").length;
  const busy    = MOCK_DRIVERS.filter(d => d.status === "busy").length;
  const offline = MOCK_DRIVERS.filter(d => d.status === "offline").length;
  const totalEarnings = MOCK_DRIVERS.reduce((s, d) => s + d.earnings, 0);

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
        <button className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md">
          <Plus size={16} /> Novo Entregador
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Online agora",   value: online,  icon: <CheckCircle size={20} className="text-green-500"  />, color: "text-green-600"  },
          { label: "Em entrega",     value: busy,    icon: <Bike        size={20} className="text-orange-500" />, color: "text-orange-600" },
          { label: "Offline",        value: offline, icon: <XCircle     size={20} className="text-gray-400"   />, color: "text-gray-500"   },
          { label: "Ganhos do mês",  value: `R$ ${totalEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            icon: <DollarSign size={20} className="text-blue-500" />, color: "text-blue-600" },
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
            type="text"
            placeholder="Buscar por nome ou zona..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
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
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(d => (
          <div key={d.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {d.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{d.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                    <Phone size={11} /> {d.phone}
                  </div>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${STATUS_COLOR[d.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status]}`} />
                {STATUS_LABEL[d.status]}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
              <MapPin size={12} className="text-orange-400" /> {d.zone}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-500 mb-0.5">
                  <Star size={12} fill="currentColor" />
                  <span className="text-sm font-bold text-gray-900">{d.rating}</span>
                </div>
                <p className="text-xs text-gray-400">Avaliação</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Package size={12} className="text-blue-400" />
                  <span className="text-sm font-bold text-gray-900">{d.deliveries}</span>
                </div>
                <p className="text-xs text-gray-400">Entregas</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <DollarSign size={12} className="text-green-500" />
                  <span className="text-sm font-bold text-gray-900">
                    {(d.earnings / 1000).toFixed(1)}k
                  </span>
                </div>
                <p className="text-xs text-gray-400">Ganhos</p>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-2 py-16 text-center text-gray-400">
            <Bike size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum entregador encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
