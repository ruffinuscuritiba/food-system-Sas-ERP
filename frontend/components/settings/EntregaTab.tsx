"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Loader2, MapPin, Save,
  ToggleLeft, ToggleRight, ChevronDown, X, Check,
} from "lucide-react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import type { DeliveryZone } from "@/components/settings/DeliveryZoneMap";

// Leaflet only runs client-side
const DeliveryZoneMap = dynamic(
  () => import("@/components/settings/DeliveryZoneMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
        <div className="text-center text-gray-400">
          <MapPin size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">Carregando mapa…</p>
        </div>
      </div>
    ),
  },
);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DeliverySettings {
  deliveryMethod: string;
  freeDeliveryAbove: number | null;
  ownDelivery: boolean;
  maxDeliveryRadius: number | null;
  storeLat: number | null;
  storeLng: number | null;
}

type ZoneForm = {
  name: string;
  type: string;
  neighborhood: string;
  clientFee: string;
  driverShare: string;
  radiusKm: string;
  lat: string;
  lng: string;
  color: string;
  isActive: boolean;
};

const EMPTY_FORM: ZoneForm = {
  name: "", type: "NEIGHBORHOOD", neighborhood: "",
  clientFee: "0.00", driverShare: "0.00",
  radiusKm: "3", lat: "", lng: "",
  color: "#f97316", isActive: true,
};

const ZONE_COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7",
  "#eab308", "#ef4444", "#06b6d4", "#ec4899",
];

const DELIVERY_METHODS = [
  { value: "NEIGHBORHOOD", label: "Por bairro", desc: "Taxa fixa por bairro atendido" },
  { value: "RADIUS",       label: "Por raio",   desc: "Círculos de km a partir da loja" },
  { value: "ROUTE",        label: "Por rota",   desc: "Taxa calculada pela distância real" },
];

// ─── Utilitários ─────────────────────────────────────────────────────────────

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        on ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Modal de zona ───────────────────────────────────────────────────────────

function ZoneModal({
  initial,
  storeLat,
  storeLng,
  onSave,
  onClose,
}: {
  initial?: DeliveryZone;
  storeLat: number | null;
  storeLng: number | null;
  onSave: (data: ZoneForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ZoneForm>(
    initial
      ? {
          name:         initial.name,
          type:         initial.type,
          neighborhood: initial.neighborhood ?? "",
          clientFee:    Number(initial.clientFee).toFixed(2),
          driverShare:  Number(initial.driverShare).toFixed(2),
          radiusKm:     initial.radiusKm ? String(initial.radiusKm) : "3",
          lat:          initial.lat ? String(initial.lat) : "",
          lng:          initial.lng ? String(initial.lng) : "",
          color:        initial.color ?? "#f97316",
          isActive:     initial.isActive,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ZoneForm>(k: K, v: ZoneForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (!form.name.trim()) { toast.error("Informe o nome da zona"); return; }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch { /* toast shown by parent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {initial ? "Editar zona" : "Nova zona de entrega"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Nome da zona *
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: Centro, Zona Sul, Raio 5km…"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Tipo de zona
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "NEIGHBORHOOD", l: "Bairro" },
                { v: "RADIUS",       l: "Raio" },
                { v: "ROUTE",        l: "Por rota" },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => set("type", v)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    form.type === v
                      ? "bg-orange-50 dark:bg-orange-950/30 border-orange-400 text-orange-600"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Bairro — só para NEIGHBORHOOD */}
          {form.type === "NEIGHBORHOOD" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Nome do bairro
              </label>
              <input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                placeholder="Ex: Água Verde"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          {/* Raio — só para RADIUS */}
          {form.type === "RADIUS" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Raio (km)
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.radiusKm}
                onChange={(e) => set("radiusKm", e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                O círculo será desenhado a partir das coordenadas da loja no mapa
              </p>
            </div>
          )}

          {/* Taxas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Taxa do cliente (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.50"
                value={form.clientFee}
                onChange={(e) => set("clientFee", e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Repasse entregador (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.50"
                value={form.driverShare}
                onChange={(e) => set("driverShare", e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Cor no mapa
            </label>
            <div className="flex gap-2 flex-wrap">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set("color", c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.color === c ? "border-gray-900 scale-110" : "border-transparent"
                  }`}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="w-7 h-7 rounded-full border border-gray-200 cursor-pointer"
                title="Cor personalizada"
              />
            </div>
          </div>

          {/* Ativa */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Zona ativa</p>
              <p className="text-xs text-gray-400">Zona inativa não aparece no cardápio</p>
            </div>
            <Toggle on={form.isActive} onToggle={() => set("isActive", !form.isActive)} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:opacity-80"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {initial ? "Salvar" : "Criar zona"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function EntregaTab() {
  const [settings, setSettings] = useState<DeliverySettings>({
    deliveryMethod: "NEIGHBORHOOD",
    freeDeliveryAbove: null,
    ownDelivery: true,
    maxDeliveryRadius: null,
    storeLat: null,
    storeLng: null,
  });
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [modalZone, setModalZone] = useState<DeliveryZone | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clickMode, setClickMode] = useState<"store" | null>(null);
  const [freeDeliveryInput, setFreeDeliveryInput] = useState("");

  // ── Fetch inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<DeliverySettings>("/company/settings"),
      api.get<DeliveryZone[]>("/delivery-config"),
    ])
      .then(([s, z]) => {
        const d = s.data;
        setSettings(d);
        setFreeDeliveryInput(
          d.freeDeliveryAbove != null ? String(d.freeDeliveryAbove) : "",
        );
        setZones(z.data);
      })
      .catch(() => toast.error("Erro ao carregar configurações de entrega"))
      .finally(() => setLoading(false));
  }, []);

  // ── Salvar configurações globais ──────────────────────────────────────────
  async function saveSettings() {
    setSavingSettings(true);
    try {
      await api.patch("/company/settings", {
        deliveryMethod:    settings.deliveryMethod,
        freeDeliveryAbove: freeDeliveryInput ? Number(freeDeliveryInput) : null,
        ownDelivery:       settings.ownDelivery,
        maxDeliveryRadius: settings.maxDeliveryRadius,
        storeLat:          settings.storeLat,
        storeLng:          settings.storeLng,
      });
      toast.success("Configurações de entrega salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingSettings(false);
    }
  }

  // ── CRUD zonas ────────────────────────────────────────────────────────────
  async function handleSaveZone(form: ZoneForm) {
    const payload = {
      name:         form.name.trim(),
      type:         form.type,
      neighborhood: form.neighborhood || null,
      clientFee:    Number(form.clientFee),
      driverShare:  Number(form.driverShare),
      radiusKm:     form.type === "RADIUS" ? Number(form.radiusKm) : null,
      lat:          form.lat ? Number(form.lat) : settings.storeLat,
      lng:          form.lng ? Number(form.lng) : settings.storeLng,
      color:        form.color,
      isActive:     form.isActive,
    };

    if (modalZone && modalZone !== "new") {
      // edit
      const res = await api.patch<DeliveryZone>(
        `/delivery-config/${modalZone.id}`,
        payload,
      ).catch(() => { toast.error("Erro ao atualizar zona"); throw new Error(); });
      setZones((prev) =>
        prev.map((z) => (z.id === modalZone.id ? res.data : z)),
      );
      toast.success("Zona atualizada!");
    } else {
      // create
      const res = await api.post<DeliveryZone>("/delivery-config", payload)
        .catch(() => { toast.error("Erro ao criar zona"); throw new Error(); });
      setZones((prev) => [...prev, res.data]);
      toast.success("Zona criada!");
    }
  }

  async function handleDelete(zone: DeliveryZone) {
    if (!confirm(`Excluir a zona "${zone.name}"?`)) return;
    setDeletingId(zone.id);
    try {
      await api.delete(`/delivery-config/${zone.id}`);
      setZones((prev) => prev.filter((z) => z.id !== zone.id));
      toast.success("Zona removida");
    } catch {
      toast.error("Erro ao remover zona");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    const updated = { ...zone, isActive: !zone.isActive };
    setZones((prev) => prev.map((z) => (z.id === zone.id ? updated : z)));
    await api
      .patch(`/delivery-config/${zone.id}`, { isActive: !zone.isActive })
      .catch(() => {
        setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
        toast.error("Erro ao atualizar zona");
      });
  }

  function handleMapClick(lat: number, lng: number) {
    if (clickMode === "store") {
      setSettings((p) => ({ ...p, storeLat: lat, storeLng: lng }));
      setClickMode(null);
      toast.success("Localização da loja definida! Salve para confirmar.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 max-w-6xl">
      {/* ── Painel de configurações globais ─────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Configurações globais de entrega
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Define o comportamento padrão para todos os pedidos delivery
            </p>
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-60"
          >
            {savingSettings
              ? <Loader2 size={13} className="animate-spin" />
              : <Save size={13} />}
            Salvar
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Método */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Método de cobrança
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_METHODS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() =>
                    setSettings((p) => ({ ...p, deliveryMethod: value }))
                  }
                  className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-colors ${
                    settings.deliveryMethod === value
                      ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      settings.deliveryMethod === value
                        ? "text-orange-600"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frete grátis */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Frete grátis acima de
            </label>
            <div className="flex items-center gap-2">
              <Toggle
                on={freeDeliveryInput !== ""}
                onToggle={() =>
                  setFreeDeliveryInput((v) => (v ? "" : "50"))
                }
              />
              <span className="text-xs text-gray-500">
                {freeDeliveryInput ? `R$ ${freeDeliveryInput}` : "Desativado"}
              </span>
            </div>
            {freeDeliveryInput !== "" && (
              <input
                type="number"
                min="0"
                step="5"
                value={freeDeliveryInput}
                onChange={(e) => setFreeDeliveryInput(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: 50.00"
              />
            )}
          </div>

          {/* Entrega própria */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Tipo de operação
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 dark:text-gray-300">Entrega própria</span>
                <Toggle
                  on={settings.ownDelivery}
                  onToggle={() =>
                    setSettings((p) => ({ ...p, ownDelivery: !p.ownDelivery }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 dark:text-gray-300">Raio máximo (km)</span>
                <input
                  type="number"
                  min="1"
                  value={settings.maxDeliveryRadius ?? ""}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      maxDeliveryRadius: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="Sem limite"
                  className="w-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Split: lista + mapa ──────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: "520px" }}>
        {/* Lista de zonas */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
              Zonas de entrega
              <span className="ml-2 text-gray-400 font-normal">({zones.length})</span>
            </h3>
            <button
              onClick={() => setModalZone("new")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600"
            >
              <Plus size={12} /> Nova zona
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {zones.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <MapPin size={24} className="mb-2 opacity-40" />
                <p className="text-xs text-center">
                  Nenhuma zona cadastrada.<br />Clique em "Nova zona" para começar.
                </p>
              </div>
            )}

            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`rounded-xl border p-3 transition-colors ${
                  zone.isActive
                    ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 opacity-60"
                }`}
              >
                {/* Header do card */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: zone.color }}
                  />
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate">
                    {zone.name}
                  </span>
                  <Toggle
                    on={zone.isActive}
                    onToggle={() => toggleZone(zone)}
                  />
                </div>

                {/* Detalhe */}
                <div className="flex items-center justify-between mt-2">
                  <div className="space-y-0.5">
                    {zone.type === "NEIGHBORHOOD" && zone.neighborhood && (
                      <p className="text-[10px] text-gray-400">{zone.neighborhood}</p>
                    )}
                    {zone.type === "RADIUS" && zone.radiusKm && (
                      <p className="text-[10px] text-gray-400">Raio: {zone.radiusKm} km</p>
                    )}
                    <p className="text-[11px] font-semibold text-orange-600">
                      {currency(Number(zone.clientFee))}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Repasse: {currency(Number(zone.driverShare))}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModalZone(zone)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(zone)}
                      disabled={deletingId === zone.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500"
                    >
                      {deletingId === zone.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 relative">
          {/* Toolbar do mapa */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
            <button
              onClick={() => setClickMode((m) => (m === "store" ? null : "store"))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md border transition-colors ${
                clickMode === "store"
                  ? "bg-orange-500 text-white border-orange-600"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-300"
              }`}
            >
              <MapPin size={12} />
              {clickMode === "store" ? "Clique no mapa para definir" : "Definir local da loja"}
            </button>
          </div>

          {/* Coordenadas atuais */}
          {settings.storeLat && settings.storeLng && (
            <div className="absolute bottom-3 left-3 z-[400] bg-white/90 dark:bg-gray-900/90 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-500 shadow border border-gray-200 dark:border-gray-700">
              📍 {settings.storeLat.toFixed(5)}, {settings.storeLng.toFixed(5)}
            </div>
          )}

          <DeliveryZoneMap
            zones={zones}
            storeLat={settings.storeLat}
            storeLng={settings.storeLng}
            onMapClick={handleMapClick}
            clickMode={clickMode}
          />
        </div>
      </div>

      {/* Modal */}
      {modalZone !== null && (
        <ZoneModal
          initial={modalZone === "new" ? undefined : modalZone}
          storeLat={settings.storeLat}
          storeLng={settings.storeLng}
          onSave={handleSaveZone}
          onClose={() => setModalZone(null)}
        />
      )}
    </div>
  );
}
