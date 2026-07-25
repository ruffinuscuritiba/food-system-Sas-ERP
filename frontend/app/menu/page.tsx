"use client";

import React, { useState, Suspense } from "react";
import { X } from "lucide-react";

interface CustomerForm {
  name: string;
  phone: string;
  orderType: "DELIVERY" | "PICKUP";
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  paymentMethod: "PIX" | "CASH" | "CREDIT_CARD" | "DEBIT_CARD";
}

// Cores fixas em objeto — usadas via `style` inline nos pontos críticos de
// legibilidade (label, texto digitado, placeholder) para que NENHUM CSS
// global de tema (ex: overrides `.text-white`/`.bg-white` por dark/light
// mode) consiga sobrescrever e deixar texto da mesma cor do fundo.
const COLORS = {
  labelText: "#94A3B8", // slate-400
  inputBg: "#1E293B", // slate-800
  inputText: "#FFFFFF",
  inputBorder: "#334155", // slate-700
  inputBorderFocus: "#EF4444", // red-500
  placeholder: "#64748B", // slate-500
  errorText: "#F87171", // red-400
  errorBg: "#450A0A", // red-950
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: COLORS.inputBg,
  color: COLORS.inputText,
  border: `1px solid ${COLORS.inputBorder}`,
  borderRadius: "0.75rem",
  padding: "0.75rem 1rem",
  fontSize: "1rem",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: COLORS.labelText,
  fontSize: "0.75rem",
  fontWeight: 600,
  marginBottom: "0.25rem",
  display: "block",
};

function MenuContent() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cartTotal, setCartTotal] = useState(0);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    orderType: "DELIVERY",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    paymentMethod: "PIX",
  });

  const validate = (): boolean => {
    if (!form.name.trim() || !form.phone.trim()) {
      setAddressError("Preencha nome e telefone.");
      return false;
    }
    if (form.orderType === "DELIVERY") {
      // Regra P0: rua e número são SEMPRE obrigatórios para entrega
      // (mesmo padrão de validação já usado no backend/OnlineOrdersService).
      if (!form.street.trim() || !form.number.trim()) {
        setAddressError("Rua e número são obrigatórios para entrega.");
        return false;
      }
      if (!form.neighborhood.trim()) {
        setAddressError("Informe o bairro — é usado para calcular a taxa de entrega.");
        return false;
      }
    }
    setAddressError(null);
    return true;
  };

  const submitOrder = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fullAddress = [
        form.street,
        form.number,
        form.complement,
        form.neighborhood,
        form.city,
      ]
        .filter(Boolean)
        .join(", ");

      const payload = {
        ...form,
        address: fullAddress, // string concatenada, compatível com o backend existente
      };

      // Lógica de envio do pedido
      console.log("Enviando pedido:", payload);
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24" style={{ color: "#FFFFFF" }}>
      <main className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>
          Cardápio Digital
        </h1>
        <button
          onClick={() => setShowCheckout(true)}
          className="px-6 py-3 rounded-xl font-bold shadow-lg"
          style={{ backgroundColor: "#EF4444", color: "#FFFFFF" }}
        >
          Ver Carrinho / Finalizar
        </button>
      </main>

      {/* Modal de Checkout / Finalizar Pedido */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCheckout(false)}
          />

          <div
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl pb-8 sm:pb-6"
            style={{ backgroundColor: "#0F172A", border: "1px solid #1E293B" }}
          >
            {/* Cabeçalho */}
            <div
              className="flex items-center justify-between pb-3 sticky -top-6 -mx-6 px-6 pt-6 z-20"
              style={{ borderBottom: "1px solid #1E293B", backgroundColor: "#0F172A" }}
            >
              <h2 className="text-xl font-bold" style={{ color: "#FFFFFF" }}>
                Finalizar Pedido
              </h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="p-1 rounded-lg transition"
                style={{ color: COLORS.labelText }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Formulário de Dados do Cliente */}
            <div className="space-y-3 pt-2">
              <div>
                <label style={labelStyle}>Seu Nome *</label>
                <input
                  placeholder="Ex: Maria Silva"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Telefone / WhatsApp *</label>
                <input
                  placeholder="(00) 00000-0000"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Tipo de Pedido</label>
                <div className="grid grid-cols-2 gap-3">
                  {(["DELIVERY", "PICKUP"] as const).map((type) => {
                    const active = form.orderType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                        className="py-3 rounded-xl font-bold transition text-sm"
                        style={{
                          backgroundColor: active ? "#EF4444" : COLORS.inputBg,
                          color: "#FFFFFF",
                          border: active ? "none" : `1px solid ${COLORS.inputBorder}`,
                          boxShadow: active ? "0 10px 20px -8px rgba(239,68,68,0.5)" : "none",
                        }}
                      >
                        {type === "DELIVERY" ? "🛵 Entrega" : "🛍️ Retirada"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.orderType === "DELIVERY" && (
                <div className="space-y-3 rounded-xl p-3" style={{ backgroundColor: "#111827" }}>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label style={labelStyle}>Rua *</label>
                      <input
                        placeholder="Nome da rua"
                        value={form.street}
                        onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Número *</label>
                      <input
                        placeholder="Nº"
                        value={form.number}
                        onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Complemento</label>
                    <input
                      placeholder="Apto, bloco, referência (opcional)"
                      value={form.complement}
                      onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Bairro *</label>
                      <input
                        placeholder="Seu bairro"
                        value={form.neighborhood}
                        onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cidade</label>
                      <input
                        placeholder="Cidade (opcional)"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Forma de Pagamento</label>
                <div className="relative">
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        paymentMethod: e.target.value as CustomerForm["paymentMethod"],
                      }))
                    }
                    style={{ ...inputStyle, appearance: "none", cursor: "pointer", paddingRight: "2.5rem" }}
                  >
                    <option value="PIX" style={{ backgroundColor: "#0F172A", color: "#FFFFFF" }}>PIX</option>
                    <option value="CASH" style={{ backgroundColor: "#0F172A", color: "#FFFFFF" }}>Dinheiro</option>
                    <option value="CREDIT_CARD" style={{ backgroundColor: "#0F172A", color: "#FFFFFF" }}>Cartão de Crédito</option>
                    <option value="DEBIT_CARD" style={{ backgroundColor: "#0F172A", color: "#FFFFFF" }}>Cartão de Débito</option>
                  </select>
                  <div
                    className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-xs"
                    style={{ color: COLORS.labelText }}
                  >
                    ▼
                  </div>
                </div>
              </div>

              {addressError && (
                <div
                  className="rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ backgroundColor: COLORS.errorBg, color: COLORS.errorText }}
                >
                  {addressError}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="pt-3 space-y-3" style={{ borderTop: "1px solid #1E293B" }}>
              <div className="flex justify-between items-center text-lg font-bold">
                <span style={{ color: COLORS.labelText }}>Total do Pedido</span>
                <span style={{ color: "#4ADE80", fontSize: "1.25rem", fontWeight: 900 }}>
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="w-full py-4 rounded-xl font-black text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: "#22C55E",
                  color: "#FFFFFF",
                  boxShadow: "0 10px 20px -8px rgba(34,197,94,0.3)",
                }}
              >
                {submitting ? "Enviando pedido..." : "Confirmar e Enviar Pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <p style={{ color: COLORS.labelText }} className="animate-pulse text-lg">
            Carregando...
          </p>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}