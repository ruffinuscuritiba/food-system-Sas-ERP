"use client";

import { useState, useEffect } from "react";
import {
  Building2, Key, Clock, CreditCard, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, Wallet,
  CalendarClock, Zap, ArrowDownRight, ArrowUpRight,
  RefreshCw, TrendingUp,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RepasseFreq = "DAILY" | "WEEKLY";
type CreditPlan  = "D0"    | "D30";
type AccountType = "pix"   | "bank";
type PixKeyType  = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

interface BankAccountData {
  type:          AccountType;
  pixKey?:       string;
  pixKeyType?:   PixKeyType;
  bank?:         string;
  agency?:       string;
  account?:      string;
  accountType?:  "CORRENTE" | "POUPANCA";
  holderName?:   string;
  document?:     string;
}

interface FinancialSettings {
  repasseFrequency:  RepasseFreq;
  repasseTime:       string;
  repasseWeekday:    number;
  creditReleasePlan: CreditPlan;
  bankAccountData:   BankAccountData | null;
  walletBalance:     number;
}

interface WalletTx {
  id:          string;
  type:        string;
  amount:      number;
  balanceBefore: number;
  balanceAfter:  number;
  description: string;
  referenceType?: string;
  createdAt:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REPASSE_HOURS = Array.from({ length: 24 }, (_, h) => {
  const label = `${String(h).padStart(2, "0")}:00`;
  return { value: label, label };
});

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "CPF",    label: "CPF" },
  { value: "CNPJ",   label: "CNPJ" },
  { value: "EMAIL",  label: "E-mail" },
  { value: "PHONE",  label: "Celular" },
  { value: "RANDOM", label: "Chave aleatória" },
];

const BANKS = [
  "Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Caixa Econômica",
  "Santander", "BTG Pactual", "Inter", "C6 Bank", "Sicoob", "Outro",
];

const TX_LABELS: Record<string, { label: string; color: string }> = {
  ORDER_CREDIT:       { label: "Venda recebida",      color: "text-green-600" },
  SUBSCRIPTION_DEBIT: { label: "Mensalidade debitada", color: "text-red-600" },
  REPASSE:            { label: "Repasse enviado",       color: "text-blue-600" },
  TRANSFER_FEE:       { label: "Taxa de transferência", color: "text-orange-600" },
  MANUAL_CREDIT:      { label: "Crédito manual",        color: "text-green-600" },
  MANUAL_DEBIT:       { label: "Débito manual",         color: "text-red-600" },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function RadioCard({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 px-4 py-4 text-left transition-all ${
        selected
          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-orange-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          selected ? "border-orange-500 bg-orange-500" : "border-gray-300"
        }`}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </button>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center flex-shrink-0">
        <Icon size={17} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SelectField({
  label, value, onChange, children,
}: { label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 pr-9 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {children}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceiroTab() {
  const { user } = useAuthStore();
  const companyId = user?.companyId;

  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);

  const [freq,    setFreq]    = useState<RepasseFreq>("DAILY");
  const [time,    setTime]    = useState("03:00");
  const [weekday, setWeekday] = useState(1);
  const [plan,    setPlan]    = useState<CreditPlan>("D30");
  const [wallet,  setWallet]  = useState(0);
  const [account, setAccount] = useState<BankAccountData>({ type: "pix", pixKeyType: "CPF" });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [txs,     setTxs]     = useState<WalletTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    api.get("/company/settings")
      .then(r => {
        const d = r.data;
        setFreq(d.repasseFrequency ?? "DAILY");
        setTime(d.repasseTime ?? "03:00");
        setWeekday(d.repasseWeekday ?? 1);
        setPlan(d.creditReleasePlan ?? "D30");
        setWallet(Number(d.walletBalance ?? 0));
        if (d.bankAccountData) setAccount(d.bankAccountData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Buscar extrato da carteira
    setLoadingTxs(true);
    api.get("/wallet/transactions")
      .then(r => setTxs(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTxs(false));
  }, [companyId]);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/company/settings", {
        repasseFrequency:  freq,
        repasseTime:       time,
        repasseWeekday:    weekday,
        creditReleasePlan: plan,
        bankAccountData:   account,
      });
      toast.success("Configurações financeiras salvas!");
      setShowAccountForm(false);
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={24} className="animate-spin text-orange-500" />
      </div>
    );
  }

  const hasAccount = Boolean(account.pixKey || account.account);
  const nextRepasseLabel = freq === "DAILY"
    ? `Todos os dias às ${time}`
    : `${WEEKDAYS.find(d => d.value === weekday)?.label} às ${time}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">

      {/* ── KPI: Saldo em carteira ────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-600 flex items-center justify-center">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo em Carteira</p>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">{fmt(wallet)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Próximo repasse</p>
            <p className="text-xs font-semibold text-orange-600">{nextRepasseLabel}</p>
          </div>
        </div>

        {wallet > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Mensalidades em atraso serão abatidas automaticamente antes do próximo repasse.
            </p>
          </div>
        )}
      </div>

      {/* ── Bloco 1: Conta de Repasse ─────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionTitle
          icon={Building2}
          title="Conta de Repasse"
          subtitle="Conta bancária ou chave PIX onde você recebe seus pagamentos"
        />

        {hasAccount && !showAccountForm ? (
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 flex items-center justify-center flex-shrink-0">
                {account.type === "pix" ? <Key size={16} /> : <Building2 size={16} />}
              </div>
              <div className="min-w-0">
                {account.type === "pix" ? (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chave PIX</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{account.pixKey}</p>
                    <p className="text-xs text-gray-400">{PIX_KEY_TYPES.find(k => k.value === account.pixKeyType)?.label} · {account.holderName}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{account.bank}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Ag {account.agency} · Conta {account.account}
                    </p>
                    <p className="text-xs text-gray-400">{account.holderName} · {account.document}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <CheckCircle2 size={16} className="text-green-500" />
              <button
                onClick={() => setShowAccountForm(true)}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2"
              >
                Alterar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <RadioCard selected={account.type === "pix"} onClick={() => setAccount(a => ({ ...a, type: "pix" }))}>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Chave PIX</p>
                <p className="text-xs text-gray-500 mt-0.5">Repasse instantâneo via PIX</p>
              </RadioCard>
              <RadioCard selected={account.type === "bank"} onClick={() => setAccount(a => ({ ...a, type: "bank" }))}>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Conta Bancária</p>
                <p className="text-xs text-gray-500 mt-0.5">TED para conta corrente ou poupança</p>
              </RadioCard>
            </div>

            {account.type === "pix" ? (
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Tipo de Chave" value={account.pixKeyType ?? "CPF"} onChange={v => setAccount(a => ({ ...a, pixKeyType: v as PixKeyType }))}>
                  {PIX_KEY_TYPES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </SelectField>
                <InputField label="Chave PIX" value={account.pixKey ?? ""} onChange={v => setAccount(a => ({ ...a, pixKey: v }))} placeholder="Ex: 123.456.789-00" />
                <div className="col-span-2">
                  <InputField label="Nome do Titular" value={account.holderName ?? ""} onChange={v => setAccount(a => ({ ...a, holderName: v }))} placeholder="Nome completo ou razão social" />
                </div>
                <div className="col-span-2">
                  <InputField label="CPF / CNPJ do Titular" value={account.document ?? ""} onChange={v => setAccount(a => ({ ...a, document: v }))} placeholder="000.000.000-00" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Banco" value={account.bank ?? ""} onChange={v => setAccount(a => ({ ...a, bank: v }))}>
                  <option value="">Selecione...</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </SelectField>
                <InputField label="Agência" value={account.agency ?? ""} onChange={v => setAccount(a => ({ ...a, agency: v }))} placeholder="0000" />
                <InputField label="Conta" value={account.account ?? ""} onChange={v => setAccount(a => ({ ...a, account: v }))} placeholder="00000-0" />
                <SelectField label="Tipo de Conta" value={account.accountType ?? "CORRENTE"} onChange={v => setAccount(a => ({ ...a, accountType: v as "CORRENTE"|"POUPANCA" }))}>
                  <option value="CORRENTE">Conta Corrente</option>
                  <option value="POUPANCA">Conta Poupança</option>
                </SelectField>
                <InputField label="Nome do Titular" value={account.holderName ?? ""} onChange={v => setAccount(a => ({ ...a, holderName: v }))} placeholder="Nome completo ou razão social" />
                <InputField label="CPF / CNPJ" value={account.document ?? ""} onChange={v => setAccount(a => ({ ...a, document: v }))} placeholder="000.000.000-00" />
              </div>
            )}

            {hasAccount && (
              <button onClick={() => setShowAccountForm(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Cancelar
              </button>
            )}
          </div>
        )}

        {!hasAccount && !showAccountForm && (
          <button
            onClick={() => setShowAccountForm(true)}
            className="mt-3 flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            <span className="text-lg leading-none">+</span> Adicionar conta de recebimento
          </button>
        )}
      </div>

      {/* ── Bloco 2: Frequência do Repasse ───────────────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionTitle
          icon={CalendarClock}
          title="Frequência do Repasse"
          subtitle="Com qual frequência os valores serão transferidos para sua conta"
        />

        <div className="flex gap-3 mb-4">
          <RadioCard selected={freq === "DAILY"} onClick={() => setFreq("DAILY")}>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Todos os dias</p>
            <p className="text-xs text-gray-500 mt-0.5">Repasse diário automático</p>
          </RadioCard>
          <RadioCard selected={freq === "WEEKLY"} onClick={() => setFreq("WEEKLY")}>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Uma vez por semana</p>
            <p className="text-xs text-gray-500 mt-0.5">Repasse semanal em dia fixo</p>
          </RadioCard>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Horário do repasse" value={time} onChange={setTime}>
            {REPASSE_HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
          </SelectField>
          {freq === "WEEKLY" && (
            <SelectField label="Dia da semana" value={weekday} onChange={v => setWeekday(Number(v))}>
              {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </SelectField>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
          <Clock size={13} className="flex-shrink-0 text-orange-400" />
          <span>Próximo repasse agendado: <strong className="text-gray-700 dark:text-gray-300">{nextRepasseLabel}</strong></span>
        </div>
      </div>

      {/* ── Bloco 3: Liberação das Vendas no Crédito ─────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionTitle
          icon={CreditCard}
          title="Liberação das Vendas no Crédito Online"
          subtitle="Escolha quando receber o valor das vendas pagas com cartão de crédito"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <RadioCard selected={plan === "D0"} onClick={() => setPlan("D0")}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={13} className="text-orange-500 flex-shrink-0" />
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Liberação no mesmo dia (D+0)</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Taxa: 3,99% + 1,7% de taxa de adiantamento. Recebimento no mesmo dia da venda.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
              3,99% + 1,70%
            </div>
          </RadioCard>

          <RadioCard selected={plan === "D30"} onClick={() => setPlan("D30")}>
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarClock size={13} className="text-blue-500 flex-shrink-0" />
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Liberação em 30 dias (D+30)</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Taxa: 3,99% por transação. Recebimento 30 dias após a venda.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
              3,99% por transação
            </div>
          </RadioCard>
        </div>

        {/* Nota de rodapé obrigatória */}
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-3 text-xs text-gray-500 leading-relaxed">
          <TrendingUp size={12} className="inline mr-1 text-orange-400" />
          <strong>Taxa para PIX Online: 1,99%</strong> com liberação imediata (D+0).
          {" "}Cada repasse automatizado de saldo possui uma <strong>taxa fixa de transferência de R$ 1,90</strong> para cobertura de custos operacionais.
        </div>
      </div>

      {/* ── Botão Salvar ─────────────────────────────────────────── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {saving ? "Salvando..." : "Salvar Configurações Financeiras"}
      </button>

      {/* ── Extrato da Carteira ───────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <SectionTitle
          icon={RefreshCw}
          title="Extrato da Carteira"
          subtitle="Histórico de créditos, débitos e repasses automáticos"
        />

        {loadingTxs ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={20} className="animate-spin text-orange-400" />
          </div>
        ) : txs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            Nenhuma transação ainda. As vendas online pagas via PIX ou Cartão aparecerão aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {txs.map(tx => {
              const meta = TX_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-600" };
              const isCredit = Number(tx.amount) > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCredit ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                  }`}>
                    {isCredit
                      ? <ArrowDownRight size={15} className="text-green-600" />
                      : <ArrowUpRight size={15} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-gray-400 truncate">{tx.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                      {isCredit ? "+" : ""}{fmt(Number(tx.amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtDate(tx.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
