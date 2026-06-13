"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import { Save, ShoppingBag, Bike, Store, Clock, DollarSign } from "lucide-react";

interface OrderSettings {
  acceptDelivery: boolean;
  acceptPickup: boolean;
  acceptDineIn: boolean;
  estimatedPrepTime: number;
  minimumOrderAmount: number | null;
}

const DEFAULT: OrderSettings = {
  acceptDelivery: true,
  acceptPickup: true,
  acceptDineIn: true,
  estimatedPrepTime: 30,
  minimumOrderAmount: null,
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-orange-500" : "bg-gray-200"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function PedidosTab() {
  const [form, setForm] = useState<OrderSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<OrderSettings>("/company/settings")
      .then((r) => {
        setForm({
          acceptDelivery: r.data.acceptDelivery ?? true,
          acceptPickup: r.data.acceptPickup ?? true,
          acceptDineIn: r.data.acceptDineIn ?? true,
          estimatedPrepTime: r.data.estimatedPrepTime ?? 30,
          minimumOrderAmount: r.data.minimumOrderAmount ?? null,
        });
      })
      .catch(() => toast.error("Erro ao carregar configurações"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/company/settings", form);
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const atLeastOne = form.acceptDelivery || form.acceptPickup || form.acceptDineIn;

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Tipos de atendimento ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={16} className="text-orange-500" />
            Tipos de Atendimento
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Defina quais modalidades estão disponíveis no seu estabelecimento.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              key: "acceptDelivery" as const,
              icon: Bike,
              label: "Delivery",
              desc: "Pedidos com entrega no endereço do cliente",
            },
            {
              key: "acceptPickup" as const,
              icon: Store,
              label: "Retirada no local",
              desc: "Cliente retira no balcão (pickup)",
            },
            {
              key: "acceptDineIn" as const,
              icon: ShoppingBag,
              label: "Mesa / Local",
              desc: "Consumo no estabelecimento",
            },
          ].map(({ key, icon: Icon, label, desc }) => {
            const isLast =
              form[key] &&
              [form.acceptDelivery, form.acceptPickup, form.acceptDineIn].filter(Boolean).length === 1;

            return (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50 gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                    {isLast && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">
                        Pelo menos um tipo deve estar ativo
                      </p>
                    )}
                  </div>
                </div>
                <Toggle
                  checked={form[key]}
                  onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  disabled={isLast}
                />
              </div>
            );
          })}
        </div>

        {!atLeastOne && (
          <p className="text-sm text-red-500 font-medium">
            Ative ao menos um tipo de atendimento.
          </p>
        )}
      </section>

      {/* ── Tempo estimado ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" />
            Tempo Estimado de Preparo
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Exibido no cardápio online após a confirmação do pedido.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="number"
              min={1}
              max={240}
              value={form.estimatedPrepTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, estimatedPrepTime: Math.max(1, Number(e.target.value)) }))
              }
              className="w-28 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 text-center"
            />
          </div>
          <span className="text-sm text-gray-500">minutos</span>

          {/* Quick picks */}
          <div className="flex gap-2 ml-2">
            {[15, 30, 45, 60].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, estimatedPrepTime: t }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  form.estimatedPrepTime === t
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                }`}
              >
                {t}min
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pedido mínimo ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <DollarSign size={16} className="text-orange-500" />
            Pedido Mínimo
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Valor mínimo para aceitar pedidos de delivery. Deixe em branco para não ter mínimo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
              R$
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={form.minimumOrderAmount ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minimumOrderAmount: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-36 pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          {form.minimumOrderAmount !== null && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, minimumOrderAmount: null }))}
              className="text-xs text-gray-400 hover:text-red-400 transition"
            >
              Remover mínimo
            </button>
          )}
        </div>
      </section>

      {/* ── Salvar ── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving || !atLeastOne}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold transition active:scale-95"
        >
          <Save size={15} />
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
