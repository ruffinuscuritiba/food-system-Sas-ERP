"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, FileText, MessageCircle, ChevronRight,
  Lock, Mail, Phone, CheckCircle2,
} from "lucide-react";
import { SUPPORT_WHATSAPP } from "@/config/support";

const SUPPORT_EMAIL = "mestragenciadigital@gmail.com";
const LAST_UPDATED = "09 de julho de 2026";

const SECTIONS = [
  { id: "termos", label: "Termos de Uso", icon: FileText },
  { id: "privacidade", label: "Política de Privacidade", icon: Lock },
  { id: "suporte", label: "Canal de Suporte", icon: MessageCircle },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function TermosPage() {
  const [active, setActive] = useState<SectionId>("termos");
  const refs = useRef<Record<SectionId, HTMLElement | null>>({
    termos: null,
    privacidade: null,
    suporte: null,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id as SectionId);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    Object.values(refs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: SectionId) {
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-amber-200">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/demo" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft className="h-4 w-4" />
            Voltar para a demonstração
          </Link>
          <div className="flex items-center gap-2 text-sm font-black tracking-tight text-gray-900">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            R_FoodSaaS ERP
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        {/* Hero */}
        <div className="mb-12 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-5">
            Documentação legal
          </span>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            Termos, Privacidade e Suporte
          </h1>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            Documentos que regem o uso do R_FoodSaaS ERP — nossa plataforma de gestão para
            restaurantes, pizzarias e demais estabelecimentos de alimentação. Última atualização em{" "}
            <span className="text-gray-700 font-medium">{LAST_UPDATED}</span>.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:items-start">
          {/* Sidebar nav — desktop sticky / mobile tabs horizontais */}
          <nav className="lg:sticky lg:top-24">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = active === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition whitespace-nowrap lg:w-full ${
                      isActive
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "text-gray-500 border border-gray-200 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {s.label}
                    {isActive && <ChevronRight className="ml-auto hidden h-3.5 w-3.5 lg:block" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Conteúdo */}
          <div className="space-y-16">
            {/* ── TERMOS DE USO ── */}
            <section
              id="termos"
              ref={(el) => { refs.current.termos = el; }}
              className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 shrink-0">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Termos de Uso</h2>
              </div>

              <div className="space-y-6 text-sm leading-relaxed text-gray-600">
                <p>
                  Estes Termos de Uso regulam a utilização do <strong className="text-gray-900">R_FoodSaaS ERP</strong>{" "}
                  (&ldquo;Plataforma&rdquo;), um software como serviço (SaaS) de gestão operacional para
                  estabelecimentos do setor de alimentação — incluindo, mas não se limitando a, PDV,
                  cardápio digital, gestão de pedidos, cozinha, estoque, financeiro e integrações
                  com marketplaces de delivery.
                </p>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">1. Natureza do serviço</h3>
                  <p>
                    A Plataforma atua exclusivamente como <strong className="text-gray-900">ferramenta de gestão de pedidos</strong>{" "}
                    para o estabelecimento contratante (&ldquo;Lojista&rdquo;). Não somos parte na relação de
                    compra e venda entre o Lojista e o consumidor final, tampouco processamos ou custodiamos
                    valores de forma diversa da estritamente necessária para viabilizar o pagamento do pedido.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">2. Integrações com marketplaces</h3>
                  <p>
                    Quando o Lojista habilita uma integração com um marketplace parceiro (ex: iFood), a
                    Plataforma atua como um conector técnico: recebe o pedido via webhook autenticado,
                    confirma o recebimento (ACK) em conformidade com o SLA do parceiro, e injeta o pedido
                    no mesmo fluxo operacional usado pelo PDV — cozinha, estoque e financeiro do Lojista.
                    Nenhum pedido é modificado, redirecionado ou compartilhado com terceiros não autorizados.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">3. Responsabilidades do Lojista</h3>
                  <p>
                    O Lojista é responsável pela veracidade dos dados cadastrados (cardápio, preços,
                    horários de funcionamento) e pelo cumprimento das obrigações fiscais e regulatórias
                    aplicáveis ao seu negócio. A Plataforma fornece as ferramentas — a operação e a
                    conformidade do estabelecimento são de responsabilidade do Lojista.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">4. Disponibilidade e suporte</h3>
                  <p>
                    Empregamos esforços comercialmente razoáveis para manter a Plataforma disponível
                    24 horas por dia, 7 dias por semana, ressalvadas janelas de manutenção programada
                    e eventos fora do nosso controle razoável. Canais de suporte estão descritos na
                    seção &ldquo;Canal de Suporte&rdquo; abaixo.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">5. Alterações</h3>
                  <p>
                    Podemos atualizar estes Termos periodicamente para refletir mudanças na Plataforma
                    ou na legislação aplicável. A data da última atualização está sempre indicada no
                    topo desta página.
                  </p>
                </div>
              </div>
            </section>

            {/* ── POLÍTICA DE PRIVACIDADE ── */}
            <section
              id="privacidade"
              ref={(el) => { refs.current.privacidade = el; }}
              className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 shrink-0">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Política de Privacidade</h2>
              </div>

              <div className="space-y-6 text-sm leading-relaxed text-gray-600">
                <p>
                  Esta Política descreve como o R_FoodSaaS ERP trata dados pessoais, em conformidade
                  com a <strong className="text-gray-900">Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>.
                </p>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">1. Que dados coletamos</h3>
                  <p>
                    Coletamos apenas os dados estritamente necessários para processar pedidos: nome,
                    telefone, endereço de entrega e, quando aplicável, forma de pagamento selecionada.
                    Dados de cartão de crédito nunca trafegam ou ficam armazenados em nossos servidores —
                    são processados diretamente pelo gateway de pagamento parceiro (Mercado Pago).
                  </p>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="flex items-start gap-2.5 text-green-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>
                      <strong>Nunca vendemos dados de clientes.</strong> Os dados coletados via pedidos
                      não são compartilhados com terceiros para fins comerciais, nem utilizados para
                      campanhas de marketing próprias da Plataforma.
                    </span>
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">2. Isolamento multi-tenant</h3>
                  <p>
                    A Plataforma opera em arquitetura multi-tenant com isolamento lógico completo:
                    cada estabelecimento (empresa) só acessa os próprios dados. Nenhum Lojista tem
                    visibilidade sobre pedidos, clientes ou informações de outro estabelecimento.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">3. Retenção e exclusão</h3>
                  <p>
                    Dados de pedidos são retidos pelo tempo necessário para cumprir obrigações legais
                    (fiscais e contábeis) e operacionais do Lojista. Mediante solicitação, dados pessoais
                    podem ser corrigidos, anonimizados ou excluídos, respeitados os prazos legais de guarda.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">4. Segurança</h3>
                  <p>
                    Conexões são feitas exclusivamente via HTTPS/TLS. Senhas são armazenadas com hash
                    criptográfico (bcrypt) e nunca em texto plano. Credenciais de integrações com
                    marketplaces são armazenadas de forma criptografada.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">5. Direitos do titular</h3>
                  <p>
                    Nos termos do art. 18 da LGPD, o titular dos dados pode solicitar confirmação de
                    tratamento, acesso, correção, anonimização, portabilidade ou eliminação de seus dados
                    pessoais a qualquer momento, através do canal de suporte indicado abaixo.
                  </p>
                </div>
              </div>
            </section>

            {/* ── CANAL DE SUPORTE ── */}
            <section
              id="suporte"
              ref={(el) => { refs.current.suporte = el; }}
              className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 shrink-0">
                  <MessageCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Canal de Suporte</h2>
              </div>

              <p className="mb-6 text-sm leading-relaxed text-gray-600">
                Dúvidas sobre os Termos de Uso, a Política de Privacidade, tratamento de dados pessoais
                ou qualquer questão operacional podem ser encaminhadas diretamente pelos canais oficiais
                abaixo. Respondemos em português, com tempo médio de resposta de poucos minutos em horário comercial.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre os Termos de Uso / Privacidade do R_FoodSaaS.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-5 transition hover:bg-green-100"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">WhatsApp</p>
                    <p className="text-xs text-gray-500">Resposta rápida · horário comercial</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </a>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="group flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:bg-amber-100"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Mail className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{SUPPORT_EMAIL}</p>
                    <p className="text-xs text-gray-500">E-mail oficial de suporte</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </a>
              </div>

              <p className="mt-6 text-xs text-gray-400">
                Solicitações relacionadas a direitos de titular de dados pessoais (LGPD) também podem
                ser enviadas por esses canais, com o assunto &ldquo;Proteção de Dados&rdquo;.
              </p>
            </section>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} R_FoodSaaS ERP — Termos, Privacidade e Suporte
      </footer>
    </div>
  );
}
