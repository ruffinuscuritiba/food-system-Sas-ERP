"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save, Loader2, Plus, Trash2, CreditCard, Banknote,
  QrCode, Utensils, Info, AlertCircle, Check,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CustomPaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
}

interface PaymentSettings {
  acceptCash: boolean;
  acceptCreditCard: boolean;
  acceptDebitCard: boolean;
  acceptMealVoucher: boolean;
  customPaymentMethods: CustomPaymentMethod[];
}

// ── Bandeiras aceitas (exibição informativa) ───────────────────────────────────

const CARD_BRANDS = ["Visa", "Mastercard", "Elo", "Hipercard", "Amex"];

const BRAND_COLORS: Record<string, string> = {
  Visa:       "bg-blue-600",
  Mastercard: "bg-red-500",
  Elo:        "bg-yellow-500",
  Hipercard:  "bg-red-700",
  Amex:       "bg-blue-400",
};

// ── Componente Toggle reutilizável ─────────────────────────────────────────────

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
      aria-checked={checked}
      role="switch"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Linha de método de pagamento ───────────────────────────────────────────────

function PaymentRow({
  icon,
  label,
  sublabel,
  checked,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      checked
        ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
        : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          checked ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${checked ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
            {label}
          </p>
          {sublabel && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sublabel}</p>
          )}
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>

      {/* Slot para conteúdo extra quando ativo */}
      {checked && children && (
        <div className="px-4 pb-3.5 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Badges de bandeiras ────────────────────────────────────────────────────────

function BrandBadges() {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {CARD_BRANDS.map((brand) => (
        <span
          key={brand}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white text-[10px] font-bold ${BRAND_COLORS[brand]}`}
        >
          <Check size={9} />
          {brand}
        </span>
      ))}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function PagamentoTab() {
  const { user } = useAuthStore();

  const [settings, setSettings] = useState<PaymentSettings>({
    acceptCash:           true,
    acceptCreditCard:     true,
    acceptDebitCard:      true,
    acceptMealVoucher:    false,
    customPaymentMethods: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [addingMethod, setAddingMethod]   = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    api
      .get<{
        acceptCash?: boolean;
        acceptCreditCard?: boolean;
        acceptDebitCard?: boolean;
        acceptMealVoucher?: boolean;
        customPaymentMethods?: CustomPaymentMethod[] | null;
      }>("/company/settings")
      .then((res) => {
        setSettings({
          acceptCash:           res.data.acceptCash           ?? true,
          acceptCreditCard:     res.data.acceptCreditCard     ?? true,
          acceptDebitCard:      res.data.acceptDebitCard      ?? true,
          acceptMealVoucher:    res.data.acceptMealVoucher    ?? false,
          customPaymentMethods: res.data.customPaymentMethods ?? [],
        });
      })
      .catch(() => toast.error("Erro ao carregar configurações de pagamento"))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  const patch = useCallback(<K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  function addCustomMethod() {
    const name = newMethodName.trim();
    if (!name) return;
    const method: CustomPaymentMethod = {
      id:       crypto.randomUUID(),
      name,
      isActive: true,
    };
    patch("customPaymentMethods", [...settings.customPaymentMethods, method]);
    setNewMethodName("");
    setAddingMethod(false);
  }

  function toggleCustomMethod(id: string) {
    patch(
      "customPaymentMethods",
      settings.customPaymentMethods.map((m) =>
        m.id === id ? { ...m, isActive: !m.isActive } : m,
      ),
    );
  }

  function removeCustomMethod(id: string) {
    patch(
      "customPaymentMethods",
      settings.customPaymentMethods.filter((m) => m.id !== id),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/company/settings", {
        acceptCash:           settings.acceptCash,
        acceptCreditCard:     settings.acceptCreditCard,
        acceptDebitCard:      settings.acceptDebitCard,
        acceptMealVoucher:    settings.acceptMealVoucher,
        customPaymentMethods: settings.customPaymentMethods,
      });
      toast.success("Configurações de pagamento salvas!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Seção 1: Pagamento Online ──────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <QrCode size={15} className="text-orange-500" />
            Pagamento Online
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Métodos disponíveis para pedidos pelo cardápio digital
          </p>
        </div>

        <div className="p-5 space-y-3">
          {/* PIX */}
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 px-4 py-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <QrCode size={16} className="text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">PIX</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Taxa: 0% • Repasse instantâneo</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Configurado automaticamente via Mercado Pago. Chave PIX gerada por pedido.
              </p>
            </div>
          </div>

          {/* Cartão Online */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 px-4 py-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <CreditCard size={16} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cartão de Crédito Online</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Taxa: 3,49% + R$0,40 • Repasse em D+2</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Via Mercado Pago (link de pagamento). Parcelamento disponível via configuração do gateway.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
            <Info size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Para habilitar cartão online, configure o gateway em{" "}
              <a href="/configuracoes?tab=integracoes" className="underline underline-offset-2 hover:text-amber-600">
                Configurações → Integrações
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── Seção 2: Pagamento na Entrega / Balcão ────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Banknote size={15} className="text-orange-500" />
            Pagamento na Entrega / Balcão
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Formas aceitas na entrega ou retirada. Exibidas no cardápio digital para o cliente escolher.
          </p>
        </div>

        <div className="p-5 space-y-3">
          <PaymentRow
            icon={<Banknote size={16} />}
            label="Dinheiro"
            sublabel="Exibe campo de troco no checkout do cardápio"
            checked={settings.acceptCash}
            onChange={(v) => patch("acceptCash", v)}
          />

          <PaymentRow
            icon={<CreditCard size={16} />}
            label="Cartão de Crédito"
            sublabel="Cobrado na entrega com a maquininha"
            checked={settings.acceptCreditCard}
            onChange={(v) => patch("acceptCreditCard", v)}
          >
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">Bandeiras aceitas:</p>
              <BrandBadges />
            </div>
          </PaymentRow>

          <PaymentRow
            icon={<CreditCard size={16} />}
            label="Cartão de Débito"
            sublabel="Cobrado na entrega com a maquininha"
            checked={settings.acceptDebitCard}
            onChange={(v) => patch("acceptDebitCard", v)}
          >
            <div>
              <p className="text-[11px] text-gray-400 mb-1.5">Bandeiras aceitas:</p>
              <BrandBadges />
            </div>
          </PaymentRow>

          <PaymentRow
            icon={<Utensils size={16} />}
            label="Vale-Refeição / Alimentação"
            sublabel="VR, VA, Alelo, Sodexo, Ticket"
            checked={settings.acceptMealVoucher}
            onChange={(v) => patch("acceptMealVoucher", v)}
          >
            <div className="flex flex-wrap gap-1.5 mt-1">
              {["VR", "VA", "Alelo", "Sodexo", "Ticket"].map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-semibold"
                >
                  {b}
                </span>
              ))}
            </div>
          </PaymentRow>
        </div>
      </section>

      {/* ── Seção 3: Formas Personalizadas ───────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Plus size={15} className="text-orange-500" />
              Formas Personalizadas
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Métodos específicos da sua operação (ex: Cortesia, Comanda, Convênio)
            </p>
          </div>
          {!addingMethod && (
            <button
              onClick={() => setAddingMethod(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
            >
              <Plus size={12} />
              Nova forma
            </button>
          )}
        </div>

        <div className="p-5 space-y-2">
          {/* Formulário de adição */}
          {addingMethod && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
              <input
                type="text"
                value={newMethodName}
                onChange={(e) => setNewMethodName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomMethod(); if (e.key === "Escape") setAddingMethod(false); }}
                placeholder="Ex: Cortesia, Comanda, Convênio..."
                autoFocus
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={addCustomMethod}
                disabled={!newMethodName.trim()}
                className="px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => { setAddingMethod(false); setNewMethodName(""); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {settings.customPaymentMethods.length === 0 && !addingMethod && (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhuma forma personalizada cadastrada.</p>
              <p className="text-xs mt-0.5">Clique em "+ Nova forma" para adicionar.</p>
            </div>
          )}

          {settings.customPaymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                method.isActive
                  ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  : "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 opacity-60"
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <CreditCard size={13} className="text-gray-400" />
              </div>
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 font-medium">
                {method.name}
              </span>
              <Toggle checked={method.isActive} onChange={() => toggleCustomMethod(method.id)} />
              <button
                onClick={() => removeCustomMethod(method.id)}
                className="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                aria-label="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Botão salvar ─────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={15} /> Salvar pagamento</>
          )}
        </button>
      </div>
    </div>
  );
}
