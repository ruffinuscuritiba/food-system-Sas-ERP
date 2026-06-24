"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Zap,
  X,
  CheckCircle,
  Star,
} from "lucide-react";
import { apiBaseUrl } from "@/services/env";
import { SUPPORT_WHATSAPP } from "@/config/support";

type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  streaming?: boolean;
  planRecommended?: string;
  ctaType?: string;
}

interface LeadInfo {
  name: string;
  company: string;
  phone: string;
}

interface PlanMeta {
  label: string;
  gradient: string;
  badgeClass: string;
  description: string;
  features: string[];
}

const PLAN_DATA: Record<string, PlanMeta> = {
  BASIC: {
    label: "Basic",
    gradient: "from-blue-500 to-blue-700",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    description: "Operação essencial",
    features: [
      "PDV completo para tablet e mobile",
      "Gestão de pedidos e mesas",
      "Complementos estilo iFood",
    ],
  },
  PRO: {
    label: "Pro",
    gradient: "from-violet-500 to-violet-700",
    badgeClass: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    description: "Crescimento gerenciado",
    features: [
      "Cardápio Digital com QR Code + Delivery",
      "Financeiro, Cupons e Fichas Técnicas",
      "Tudo do plano Basic incluído",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise",
    gradient: "from-amber-500 to-orange-600",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    description: "Escala e automação",
    features: [
      "BI com IA consultora integrada",
      "WhatsApp IA automático 24h",
      "Fidelidade, Cashback e Integrações Premium",
    ],
  },
};

const SUGGESTIONS = [
  "Tenho uma pizzaria e quero modernizar",
  "Quero sair das comissões do iFood",
  "Preciso controlar estoque e receitas",
  "Quero WhatsApp automático para pedidos",
  "Qual plano é ideal para o meu restaurante?",
];

let msgId = 0;

const SESSION_TOKEN =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function buildConversationSummary(msgs: Message[]): string {
  return msgs
    .filter((m) => !m.streaming && m.content.trim())
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Cliente" : "Kely"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

function stripTags(text: string): {
  clean: string;
  plan: string | null;
  cta: string | null;
} {
  let plan: string | null = null;
  let cta: string | null = null;
  const clean = text
    .replace(/\[PLANO:(BASIC|PRO|ENTERPRISE)\]/g, (_, p: string) => {
      if (!plan) plan = p;
      return "";
    })
    .replace(/\[CTA:(WHATSAPP|DEMO)\]/g, (_, c: string) => {
      if (!cta) cta = c;
      return "";
    })
    .replace(/ {2,}/g, " ")
    .trim();
  return { clean, plan, cta };
}

function waLink(plan?: string): string {
  const text = plan
    ? `Olá! Tenho interesse no plano ${plan} da Ruffinu's R_FoodSaaS ERP. Gostaria de receber uma proposta comercial.`
    : `Olá! Gostaria de saber mais sobre a Ruffinu's R_FoodSaaS ERP e entrar em contato com um consultor.`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export default function IaDemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: "assistant",
      content:
        "Olá! Sou a **Kely**, Consultora Comercial da **Ruffinu's R_FoodSaaS ERP**.\n\nAjudo donos de pizzarias, restaurantes e deliveries a encontrar a solução certa para o negócio.\n\nMe conta: qual é o tipo do seu estabelecimento?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [userMsgCount, setUserMsgCount] = useState(0);
  const [leadInfo, setLeadInfo] = useState<LeadInfo>({
    name: "",
    company: "",
    phone: "",
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadDismissed, setLeadDismissed] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Lead capture trigger conditions
  useEffect(() => {
    if (leadDismissed || leadSubmitted || showLeadCapture) return;
    if (userMsgCount >= 4 || recommendedPlan !== null) {
      setShowLeadCapture(true);
    }
  }, [userMsgCount, recommendedPlan, leadDismissed, leadSubmitted, showLeadCapture]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function saveLead(
    overrides?: Partial<LeadInfo & { recommendedPlan: string; conversationSummary: string; waClicked: boolean }>,
    currentMessages?: Message[],
  ) {
    try {
      await fetch(`${apiBaseUrl}/leads`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: SESSION_TOKEN,
          name: leadInfo.name || undefined,
          company: leadInfo.company || undefined,
          whatsapp: leadInfo.phone || undefined,
          ...overrides,
          conversationSummary: overrides?.conversationSummary
            ?? buildConversationSummary(currentMessages ?? messages),
        }),
      });
    } catch {
      /* silently ignore — lead save is best-effort */
    }
  }

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadSubmitted(true);
    setShowLeadCapture(false);
    const hasData = leadInfo.name || leadInfo.company || leadInfo.phone;
    saveLead({
      recommendedPlan: recommendedPlan ?? undefined,
    } as Parameters<typeof saveLead>[0]);
    if (hasData) {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgId,
          role: "assistant",
          content: `Obrigada${leadInfo.name ? `, ${leadInfo.name}` : ""}! Seus dados foram anotados e nossa equipe vai entrar em contato em breve. Pode continuar me fazendo perguntas! 😊`,
        },
      ]);
    }
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setUserMsgCount((c) => c + 1);

    const history = messages
      .filter((m) => !m.streaming && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsgId = ++msgId;
    const assistantMsgId = ++msgId;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);
    setIsLoading(true);

    const hasLead = leadInfo.name || leadInfo.company || leadInfo.phone;

    try {
      const response = await fetch(`${apiBaseUrl}/ia/platform-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content }],
          ...(hasLead ? { leadInfo } : {}),
        }),
      });

      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw);

            if (parsed.done) {
              // Finalize: strip tags from accumulated, update state
              const { clean, plan, cta } = stripTags(accumulated);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: clean,
                        streaming: false,
                        planRecommended: plan ?? undefined,
                        ctaType: cta ?? undefined,
                      }
                    : m
                )
              );
              if (plan) {
                setRecommendedPlan(plan);
                // Auto-save lead with plan when detected (even if no form was filled)
                setMessages((snapshot) => {
                  saveLead({ recommendedPlan: plan }, snapshot);
                  return snapshot;
                });
              }
              if (cta === "WHATSAPP" && !leadDismissed && !leadSubmitted) {
                setShowLeadCapture(true);
              }
            } else if (parsed.text) {
              accumulated += parsed.text;
              // Strip tags from display during streaming too (hides partial tags)
              const { clean } = stripTags(accumulated);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: clean } : m
                )
              );
            }
          } catch {
            /* skip malformed SSE line */
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Desculpe, tive um probleminha. Tente novamente! 🙏",
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showSuggestions = messages.length === 1 && !isLoading;

  return (
    <div
      className="h-screen flex flex-col bg-[#050816] text-white overflow-hidden"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, #7c3aed 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative shrink-0 border-b border-white/[0.07] px-4 py-3 flex items-center gap-3 bg-[#050816]/80 backdrop-blur-sm z-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-900/50 shrink-0">
          <Bot size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-sm">Kely</span>
            <span className="hidden xs:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
              CONSULTORA COMERCIAL
            </span>
          </div>
          <p className="text-[11px] text-white/35 truncate">
            Ruffinu&apos;s R_FoodSaaS ERP — Atendimento Comercial
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-medium">Online</span>
          </div>
          <a
            href="/demo"
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-violet-300 hover:text-violet-100 transition px-3 py-1.5 rounded-xl border border-violet-500/30 hover:border-violet-400/50 hover:bg-violet-500/10"
          >
            <Zap size={12} />
            Testar sistema
          </a>
        </div>
      </header>

      {/* Messages */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-violet-900/30">
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed break-words ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-md shadow-md shadow-violet-900/20"
                      : "bg-white/[0.05] border border-white/[0.08] text-white/90 rounded-tl-md"
                  }`}
                >
                  <RichText content={msg.content} />
                  {msg.streaming && (
                    <span className="inline-block w-[3px] h-[14px] bg-violet-400 ml-1 rounded animate-pulse align-middle" />
                  )}
                </div>
              </div>

              {/* Plan card — rendered below the message that triggered it */}
              {msg.planRecommended && !msg.streaming && (
                <div className="ml-10 mt-2">
                  <PlanCard plan={msg.planRecommended} onWaClick={() => saveLead({ waClicked: true })} />
                </div>
              )}

              {/* Inline CTA buttons */}
              {msg.ctaType && !msg.streaming && (
                <div className="ml-10 mt-2 flex gap-2 flex-wrap">
                  {msg.ctaType === "WHATSAPP" && (
                    <a
                      href={waLink(recommendedPlan ?? undefined)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => saveLead({ waClicked: true })}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2 rounded-xl text-[11px] font-bold text-white shadow-md"
                    >
                      <MessageSquare size={13} />
                      Falar com consultor agora
                    </a>
                  )}
                  {msg.ctaType === "DEMO" && (
                    <a
                      href="/demo"
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 transition px-4 py-2 rounded-xl text-[11px] font-bold text-white shadow-md"
                    >
                      <Sparkles size={13} />
                      Testar demonstração grátis
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Suggestion chips — first turn only */}
          {showSuggestions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="group flex items-center gap-2 text-left text-xs px-3.5 py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-violet-500/50 hover:bg-violet-500/10 transition"
                >
                  <ChevronRight
                    size={12}
                    className="shrink-0 text-violet-400/40 group-hover:text-violet-400 transition"
                  />
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Lead capture panel */}
      {showLeadCapture && (
        <div className="relative shrink-0 border-t border-violet-500/20 bg-violet-950/40 backdrop-blur-sm px-4 py-3 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div>
                <p className="text-[12px] font-semibold text-violet-200">
                  Quer receber uma proposta personalizada?
                </p>
                <p className="text-[11px] text-white/40">
                  Todos os campos são opcionais
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLeadCapture(false);
                  setLeadDismissed(true);
                }}
                className="text-white/30 hover:text-white/60 transition mt-0.5 shrink-0"
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>
            <form
              onSubmit={submitLead}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                value={leadInfo.name}
                onChange={(e) =>
                  setLeadInfo((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Seu nome"
                className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 min-w-0"
              />
              <input
                value={leadInfo.company}
                onChange={(e) =>
                  setLeadInfo((p) => ({ ...p, company: e.target.value }))
                }
                placeholder="Nome do estabelecimento"
                className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 min-w-0"
              />
              <input
                value={leadInfo.phone}
                onChange={(e) =>
                  setLeadInfo((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="WhatsApp (com DDD)"
                className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 min-w-0"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 transition px-4 py-2 rounded-xl text-[12px] font-bold text-white shrink-0"
              >
                <CheckCircle size={13} />
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative shrink-0 border-t border-white/[0.07] bg-[#050816]/80 backdrop-blur-sm px-4 pt-3 pb-2">
        <div className="max-w-2xl mx-auto space-y-1.5">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre planos, funcionalidades, preços..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/60 disabled:opacity-50 transition min-h-[46px]"
              style={{
                scrollbarWidth: "none",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-[46px] h-[46px] rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition shadow-lg shadow-violet-900/30 shrink-0"
            >
              {isLoading ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Send size={16} className="text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/20 text-center">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>

      {/* Footer CTA */}
      <div
        className="relative shrink-0 border-t border-white/[0.05] bg-[#030712] px-4 py-2.5"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/20 hidden md:block">
            © {new Date().getFullYear()} Ruffinu&apos;s R_FoodSaaS ERP
          </span>
          <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
            <a
              href={waLink(recommendedPlan ?? undefined)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => saveLead({ waClicked: true })}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 transition px-4 py-2 rounded-xl text-[11px] font-bold text-white shadow-md shadow-emerald-900/30"
            >
              <MessageSquare size={13} />
              Falar com Consultor
            </a>
            <a
              href="/demo"
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition px-4 py-2 rounded-xl text-[11px] font-bold text-white/60 hover:text-white"
            >
              <Sparkles size={13} />
              Testar o Sistema
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PlanCard({ plan, onWaClick }: { plan: string; onWaClick?: () => void }) {
  const data = PLAN_DATA[plan];
  if (!data) return null;
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${data.gradient} p-[1px]`}>
      <div className="rounded-[15px] bg-[#0a0a1a] px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Star size={12} className="text-amber-400" />
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
            Plano Recomendado
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xl font-black text-transparent bg-clip-text bg-gradient-to-r ${data.gradient}`}
          >
            {data.label}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${data.badgeClass}`}
          >
            {data.description}
          </span>
        </div>
        <ul className="space-y-1">
          {data.features.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2 text-[12px] text-white/70"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-0.5">
          <a
            href="/demo"
            className={`flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r ${data.gradient} hover:opacity-90 transition px-3 py-2 rounded-xl text-[11px] font-bold text-white`}
          >
            <Sparkles size={12} />
            Testar grátis
          </a>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Olá! Tenho interesse no plano ${data.label} da Ruffinu's R_FoodSaaS ERP. Gostaria de receber uma proposta comercial.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWaClick}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] transition px-3 py-2 rounded-xl text-[11px] font-bold text-white/70 hover:text-white"
          >
            <MessageSquare size={12} />
            Solicitar proposta
          </a>
        </div>
      </div>
    </div>
  );
}

function RichText({ content }: { content: string }) {
  if (!content) return null;
  return (
    <>
      {content.split("\n").map((line, li, lines) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={pi} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={pi}>{part}</span>
              )
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}
