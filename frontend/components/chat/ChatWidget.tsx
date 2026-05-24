"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { apiBaseUrl } from "@/services/env";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  companyId: string;
  companyName?: string;
}

function getOrCreateSessionId(companyId: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const key = `chat_session_${companyId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function ChatWidget({ companyId, companyName = "Assistente" }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Oi, tudo bem? 😊 Sou a Bia, atendente virtual aqui do ${companyName}! Conheço o cardápio de cor e salteado. Me conta — tá com fome de quê hoje?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const sessionId = getOrCreateSessionId(companyId);
    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Add empty assistant bubble (will be filled by streaming)
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${apiBaseUrl}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, messages: updated, sessionId }),
      });

      if (!res.body) throw new Error("no body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accum = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              accum += parsed.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: accum };
                return copy;
              });
            }
          } catch {
            /* skip malformed chunks */
          }
        }
      }

      // Ensure something is shown even if streaming was empty
      if (!accum) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Não consegui responder agora. Tenta de novo?",
          };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        // Replace the empty assistant bubble with error
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Erro de conexão. Tenta de novo! 🙏",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, companyId]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 bg-red-500 hover:bg-red-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label="Abrir chat"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="bg-red-500 px-4 py-3 flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-1.5">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Bia • {companyName}</p>
              <p className="text-red-100 text-xs">Atendente virtual · online agora</p>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ maxHeight: "calc(70vh - 130px)" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-red-500 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-100 rounded-bl-sm"
                  }`}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-800 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-red-500 placeholder-slate-500"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
