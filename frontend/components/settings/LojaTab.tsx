"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import type { AxiosInstance } from "axios";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type BusinessHourDay = { open: string; close: string; isOpen: boolean };
export type BusinessHours = Record<string, BusinessHourDay>;

export interface CompanySettings {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  inscricaoEstadual: string | null;
  nomeFantasia: string | null;
  zipCode: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  businessHours: BusinessHours | null;
}

export const DAYS = [
  { key: "1", label: "Segunda-feira" },
  { key: "2", label: "Terça-feira" },
  { key: "3", label: "Quarta-feira" },
  { key: "4", label: "Quinta-feira" },
  { key: "5", label: "Sexta-feira" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
] as const;

export const DEFAULT_HOURS: BusinessHours = Object.fromEntries(
  DAYS.map(({ key }, i) => [
    key,
    { open: "10:00", close: "22:00", isOpen: i < 5 },
  ])
) as BusinessHours;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v: string | null | undefined): string { return v ?? ""; }

function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskZip(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

// ─── Campos auxiliares ────────────────────────────────────────────────────────

function Field({
  label,
  children,
  colSpan,
}: {
  label: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
    />
  );
}

// ─── Componente da aba Minha Loja ────────────────────────────────────────────
// Reutilizado em /configuracoes?tab=loja (empresa comum, client=api) e em
// /super-admin/loja (conta da plataforma, client=saApi, endpoint próprio).

export interface LojaTabProps {
  client: AxiosInstance;
  endpoint?: string;
  /** Se true, dispara o fetch imediatamente no mount (sem esperar user.companyId do JWT de empresa). */
  skipAuthCheck?: boolean;
}

export function LojaTab({ client, endpoint = "/company/settings", skipAuthCheck = false }: LojaTabProps) {
  const { user } = useAuthStore();
  const [data, setData] = useState<CompanySettings | null>(null);
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const cepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cnpjTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!skipAuthCheck && !user?.companyId) return;
    client.get<CompanySettings>(endpoint)
      .then((res) => {
        setData(res.data);
        setHours(res.data.businessHours ?? DEFAULT_HOURS);
      })
      .catch(() => toast.error("Erro ao carregar configurações da loja"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipAuthCheck, user?.companyId]);

  const patch = useCallback(<K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K],
  ) => {
    setData((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = await res.json();
      if (json.erro) { toast.error("CEP não encontrado"); return; }
      setData((prev) => prev ? {
        ...prev,
        street:       json.logradouro ?? prev.street,
        neighborhood: json.bairro     ?? prev.neighborhood,
        city:         json.localidade ?? prev.city,
        state:        json.uf         ?? prev.state,
      } : prev);
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  }

  function handleCepChange(v: string) {
    const masked = maskZip(v);
    patch("zipCode", masked);
    if (cepTimer.current) clearTimeout(cepTimer.current);
    cepTimer.current = setTimeout(() => lookupCep(masked), 600);
  }

  async function lookupCnpj(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setLoadingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        toast.error("CNPJ não encontrado na Receita Federal");
        return;
      }
      const json = await res.json();
      const ie = (json.inscricoes_estaduais as { inscricao_estadual?: string }[] | undefined)?.[0]?.inscricao_estadual;
      setData((prev) => prev ? {
        ...prev,
        razaoSocial:       json.razao_social   || prev.razaoSocial,
        nomeFantasia:      json.nome_fantasia   || prev.nomeFantasia,
        inscricaoEstadual: ie                  || prev.inscricaoEstadual,
        street:            json.logradouro      || prev.street,
        streetNumber:      json.numero          || prev.streetNumber,
        complement:        json.complemento     || prev.complement,
        neighborhood:      json.bairro          || prev.neighborhood,
        city:              json.municipio       || prev.city,
        state:             json.uf              || prev.state,
        zipCode:           json.cep ? maskZip(json.cep.toString()) : prev.zipCode,
        phone:             (!prev.phone && json.telefone) ? maskPhone(json.telefone.replace(/\D/g, "")) : prev.phone,
        email:             (!prev.email && json.email) ? json.email : prev.email,
      } : prev);
      toast.success("Dados preenchidos automaticamente pela Receita Federal!");
    } catch {
      toast.error("Erro ao consultar CNPJ. Verifique sua conexão.");
    } finally {
      setLoadingCnpj(false);
    }
  }

  function handleCnpjChange(v: string) {
    const masked = maskCnpj(v);
    patch("cnpj", masked);
    if (cnpjTimer.current) clearTimeout(cnpjTimer.current);
    if (masked.replace(/\D/g, "").length === 14) {
      cnpjTimer.current = setTimeout(() => lookupCnpj(masked), 800);
    }
  }

  function toggleDay(key: string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], isOpen: !prev[key]?.isOpen },
    }));
  }

  function setHourField(key: string, field: "open" | "close", value: string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);

    // null/"" → undefined para não quebrar @Length(2,2) e @Matches no backend
    const sv = (v: string | null | undefined): string | undefined =>
      v === null || v === undefined || v.trim() === "" ? undefined : v;

    const payload: Record<string, unknown> = {
      name:              sv(data.name),
      slug:              sv(data.slug),
      description:       sv(data.description),
      phone:             sv(data.phone),
      whatsapp:          sv(data.whatsapp),
      email:             sv(data.email),
      cnpj:              sv(data.cnpj),
      razaoSocial:       sv(data.razaoSocial),
      inscricaoEstadual: sv(data.inscricaoEstadual),
      nomeFantasia:      sv(data.nomeFantasia),
      zipCode:           sv(data.zipCode),
      street:            sv(data.street),
      streetNumber:      sv(data.streetNumber),
      complement:        sv(data.complement),
      neighborhood:      sv(data.neighborhood),
      city:              sv(data.city),
      state:             sv(data.state),
      businessHours:     hours,
    };

    try {
      await client.patch(endpoint, payload);
      toast.success("Configurações salvas com sucesso!");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string | string[] } } };
      const msgs = apiErr?.response?.data?.message;
      const msgArr = Array.isArray(msgs) ? msgs : msgs ? [String(msgs)] : [];

      // Backend antigo (VPS sem redeploy) rejeita campos novos com "property X should not exist".
      // Retry automático removendo esses campos para não bloquear o usuário.
      const unknownFields = msgArr
        .filter((m) => m.includes("should not exist"))
        .map((m) => m.split(" ")[1]);

      if (unknownFields.length > 0) {
        const retryPayload = { ...payload };
        unknownFields.forEach((f) => delete retryPayload[f]);
        try {
          await client.patch(endpoint, retryPayload);
          toast.success("Configurações salvas! (atualize o servidor para salvar todos os campos)");
          return;
        } catch {
          // exibe erro abaixo
        }
      }

      const detail = msgArr.join(", ") || "Verifique os campos e tente novamente.";
      toast.error(`Erro ao salvar: ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-orange-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Dados da empresa ────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Dados da empresa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Usado no cardápio digital, nota fiscal e WhatsApp IA
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da loja *" colSpan>
            <Input
              value={str(data.name)}
              onChange={(v) => patch("name", v)}
              placeholder="Ex: Bella Napoli Pizzaria"
            />
          </Field>

          <Field label="URL do cardápio (slug)" colSpan>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 select-none pointer-events-none">
                /menu/
              </span>
              <input
                type="text"
                className="w-full pl-[52px] pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={str(data.slug)}
                onChange={(e) => patch("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="nome-da-loja"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Use apenas letras minúsculas, números e hífens. Exemplo: <code>bella-napoli</code>
            </p>
          </Field>

          <Field label="CNPJ">
            <div className="relative">
              <Input
                value={str(data.cnpj)}
                onChange={handleCnpjChange}
                placeholder="00.000.000/0001-00"
                maxLength={18}
              />
              {loadingCnpj && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Loader2 size={14} className="animate-spin text-orange-500" />
                </div>
              )}
              {!loadingCnpj && data.cnpj?.replace(/\D/g, "").length === 14 && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
              )}
            </div>
            {data.cnpj?.replace(/\D/g, "").length === 14 && !loadingCnpj && (
              <p className="text-[10px] text-gray-400 mt-1">
                Dados preenchidos automaticamente via Receita Federal
              </p>
            )}
          </Field>

          <Field label="Razão Social" colSpan>
            <Input
              value={str(data.razaoSocial)}
              onChange={(v) => patch("razaoSocial", v)}
              placeholder="Ex: Bella Napoli Ltda."
            />
          </Field>

          <Field label="Nome Fantasia">
            <Input
              value={str(data.nomeFantasia)}
              onChange={(v) => patch("nomeFantasia", v)}
              placeholder="Ex: Bella Napoli"
            />
          </Field>

          <Field label="Inscrição Estadual">
            <Input
              value={str(data.inscricaoEstadual)}
              onChange={(v) => patch("inscricaoEstadual", v)}
              placeholder="Preenchido automaticamente ou manual"
            />
          </Field>

          <Field label="Descrição / slogan" colSpan>
            <textarea
              value={str(data.description)}
              onChange={(e) => patch("description", e.target.value)}
              rows={2}
              placeholder="Ex: A melhor pizza da cidade desde 1998"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </Field>

          <Field label="Telefone">
            <Input
              value={str(data.phone)}
              onChange={(v) => patch("phone", maskPhone(v))}
              placeholder="(41) 3333-4444"
              maxLength={15}
            />
          </Field>

          <Field label="WhatsApp">
            <Input
              value={str(data.whatsapp)}
              onChange={(v) => patch("whatsapp", maskPhone(v))}
              placeholder="(41) 99999-0000"
              maxLength={15}
            />
          </Field>

          <Field label="E-mail de contato" colSpan>
            <Input
              type="email"
              value={str(data.email)}
              onChange={(v) => patch("email", v)}
              placeholder="contato@suapizzaria.com.br"
            />
          </Field>
        </div>
      </section>

      {/* ── Endereço ────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Endereço da loja
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Exibido no cardápio digital e calculado no delivery
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CEP">
            <div className="relative">
              <Input
                value={str(data.zipCode)}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
              />
              {loadingCep && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                />
              )}
            </div>
          </Field>

          <Field label="UF">
            <Input
              value={str(data.state)}
              onChange={(v) => patch("state", v.toUpperCase().slice(0, 2))}
              placeholder="PR"
              maxLength={2}
            />
          </Field>

          <Field label="Rua / Avenida" colSpan>
            <Input
              value={str(data.street)}
              onChange={(v) => patch("street", v)}
              placeholder="Av. República Argentina"
            />
          </Field>

          <Field label="Número">
            <Input
              value={str(data.streetNumber)}
              onChange={(v) => patch("streetNumber", v)}
              placeholder="1255"
            />
          </Field>

          <Field label="Complemento">
            <Input
              value={str(data.complement)}
              onChange={(v) => patch("complement", v)}
              placeholder="Loja 3, Sala 201..."
            />
          </Field>

          <Field label="Bairro" colSpan>
            <Input
              value={str(data.neighborhood)}
              onChange={(v) => patch("neighborhood", v)}
              placeholder="Água Verde"
            />
          </Field>

          <Field label="Cidade" colSpan>
            <Input
              value={str(data.city)}
              onChange={(v) => patch("city", v)}
              placeholder="Curitiba"
            />
          </Field>
        </div>
      </section>

      {/* ── Horários de funcionamento ───────────────────────────────────── */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Horários de funcionamento
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Lidos automaticamente pelo WhatsApp IA, cardápio digital e status do pedido
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-2">
            {/* Cabeçalho */}
            <div className="grid grid-cols-[1fr_80px_80px_44px] gap-3 pb-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dia</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Abre</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Fecha</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Ativo</span>
            </div>

            {DAYS.map(({ key, label }) => {
              const day = hours[key] ?? { open: "10:00", close: "22:00", isOpen: false };
              return (
                <div
                  key={key}
                  className={`grid grid-cols-[1fr_80px_80px_44px] gap-3 items-center py-2.5 px-3 rounded-lg transition-colors ${
                    day.isOpen
                      ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30"
                      : "bg-gray-50 dark:bg-gray-800/50 border border-transparent"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      day.isOpen
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-600"
                    }`}
                  >
                    {label}
                  </span>

                  <input
                    type="time"
                    value={day.open}
                    onChange={(e) => setHourField(key, "open", e.target.value)}
                    disabled={!day.isOpen}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  />

                  <input
                    type="time"
                    value={day.close}
                    onChange={(e) => setHourField(key, "close", e.target.value)}
                    disabled={!day.isOpen}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  />

                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(key)}
                    aria-label={day.isOpen ? "Desativar" : "Ativar"}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      day.isOpen ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        day.isOpen ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Aviso overnight */}
          <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
            <AlertCircle size={12} />
            Horários que cruzam meia-noite são suportados (ex: 18:00 → 02:00).
          </p>
        </div>
      </section>

      {/* ── Botão salvar ────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={15} /> Salvar alterações</>
          )}
        </button>
      </div>
    </div>
  );
}
