"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, MessageSquare, ChevronRight, Zap } from "lucide-react";
import { apiBaseUrl } from "@/services/env";

type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "Como funciona o cardápio digital sem app?",
  "Qual plano é ideal para uma pizzaria?",
  "O sistema baixa estoque automaticamente?",
  "Como o WhatsApp IA recebe pedidos?",
  "Como o sistema se diferencia do iFood?",
  "Tem controle de caixa e financeiro?",
];

let msgId = 0;

export default function IaDemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: "assistant",
      content:
        "Olá! 👋 Sou a **Kely**, consultora da **Ruffinu's FoodSaaS ERP**.\n\nEstou aqui para te ajudar a entender como nossa plataforma pode transformar a gestão da sua pizzaria ou restaurante — do PDV ao WhatsApp IA.\n\nComo posso te ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

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

    try {
      const response = await fetch(`${apiBaseUrl}/ia/platform-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content }],
        }),
      });

      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m
                )
              );
            } else if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + parsed.text }
                    : m
                )
              );
            }
          } catch {
            /* skip malformed line */
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
      {/* ── Ambient glow ──────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, #7c3aed 0%, transparent 70%)",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative shrink-0 border-b border-white/[0.07] px-4 py-3 flex items-center gap-3 bg-[#050816]/80 backdrop-blur-sm z-10">
        {/* Logo */}
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-900/50 shrink-0">
          <Bot size={20} className="text-white" />
        </div>

        {/* Brand */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-sm">Kely</span>
            <span className="hidden xs:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
              IA HUMANIZADA
            </span>
          </div>
          <p className="text-[11px] text-white/35 truncate">
            Ruffinu&apos;s FoodSaaS ERP — Consultora Virtual
          </p>
        </div>

        {/* Status + links */}
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

      {/* ── Messages ───────────────────────────────────────────── */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
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
          ))}

          {/* Suggestions — visible only on first message */}
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

      {/* ── Input ─────────────────────────────────────────────── */}
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
              style={{ scrollbarWidth: "none", maxHeight: "120px", overflowY: "auto" }}
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
            Enter para enviar · Shift+Enter para nova linha · IA pode cometer erros
          </p>
        </div>
      </div>

      {/* ── Footer CTA ────────────────────────────────────────── */}
      <div className="relative shrink-0 border-t border-white/[0.05] bg-[#030712] px-4 py-2.5"
           style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/20 hidden md:block">
            © {new Date().getFullYear()} Ruffinu&apos;s FoodSaaS ERP
          </span>
          <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end">
            <a
              href="https://wa.me/5541999999999?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20FoodSaaS%20ERP."
              target="_blank"
              rel="noopener noreferrer"
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

/** Renders **bold** and newlines from assistant messages */
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
