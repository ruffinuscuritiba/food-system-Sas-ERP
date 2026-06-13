"use client";
import { api } from "@/services/api";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { socket } from "@/services/socket";
import { useAuthStore } from "@/stores/auth.store";
import {
  ShoppingCart, Printer, Clock, Truck, CheckCircle2, History,
  Phone, User, MapPin, X, Save, ChevronRight, RefreshCw,
} from "lucide-react";
import { type PrintableOrder } from "@/components/printing/printTicket";
import { PrintRouterService } from "@/components/printing/PrintRouterService";
import PrinterAgentBanner from "@/components/PrinterAgentBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItemComplement = {
  complementName: string;
  optionName: string;
  price: number;
  quantity: number;
};

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  selectedComplements?: OrderItemComplement[];
};

type Customer = { id: string; name: string; phone: string };

type Order = {
  id: string;
  customer?: Customer;
  customerName?: string;    // legacy / pode vir de alguns fluxos
  customerPhone?: string;
  deliveryAddress?: string;
  paymentMethod: string;
  deliveryFee: number;
  driverFee?: number;
  total: number;
  status: string;
  orderType?: string;
  notes?: string;
  items: OrderItem[];
  createdAt?: string;
  confirmedAt?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "Pendente",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  CONFIRMED:        { label: "Confirmado",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  PREPARING:        { label: "Preparando",   color: "bg-primary/10 text-orange-700 border-primary/20" },
  READY:            { label: "Pronto",       color: "bg-green-100 text-green-700 border-green-200" },
  OUT_FOR_DELIVERY: { label: "Saiu entrega", color: "bg-purple-100 text-purple-700 border-purple-200" },
  DELIVERED:        { label: "Finalizado",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  CANCELLED:        { label: "Cancelado",    color: "bg-red-100 text-red-600 border-red-200" },
};

const PAY_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito", TRANSFER: "Transferência",
};

const HISTORY_STATUSES = new Set(["DELIVERED", "CANCELLED"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsedMin(order: Order): number {
  const ref = order.confirmedAt || order.createdAt;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 60000);
}

function timingBorderClass(order: Order): string {
  if (HISTORY_STATUSES.has(order.status)) return "border-gray-100";
  const min = elapsedMin(order);
  if (min > 45) return "border-red-400 shadow-red-100/50 shadow-md";
  if (min > 25) return "border-amber-400 shadow-amber-100/50 shadow-md";
  return "border-green-400 shadow-green-100/50 shadow-md";
}

function timingDotClass(order: Order): string {
  const min = elapsedMin(order);
  if (min > 45) return "bg-red-500";
  if (min > 25) return "bg-amber-400";
  return "bg-green-500";
}

function estimatedDelivery(order: Order): string {
  const ref = order.confirmedAt || order.createdAt;
  if (!ref) return "—";
  return new Date(new Date(ref).getTime() + 45 * 60000)
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function customerName(order: Order): string {
  return order.customer?.name || order.customerName || "Cliente sem cadastro";
}

function customerPhone(order: Order): string {
  return order.customer?.phone || order.customerPhone || "—";
}

// ── Print ─────────────────────────────────────────────────────────────────────

function printOrder(order: Order, companyName: string) {
  const printable: PrintableOrder = {
    ...(order as unknown as PrintableOrder),
    source:        (order as Order & { source?: string }).source,
    status:        STATUS_LABELS[order.status]?.label || order.status,
    customerName:  customerName(order),
    customerPhone: customerPhone(order),
  };
  PrintRouterService.printAll(printable, { companyName });
}

// ── Edit Notes Modal ──────────────────────────────────────────────────────────

function EditNotesModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(order.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Atualiza via status para manter o status atual (sem alterar) — notes é incluído no body
      // Como não há endpoint PATCH /orders/:id genérico, usamos o status atual
      await api.patch(`/orders/${order.id}/status`, { status: order.status, notes });
      toast.success("Observações atualizadas");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Editar Pedido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
              Observações do pedido
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 focus:border-primary rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none resize-none"
              placeholder="Ex: sem cebola, ponto da carne..."
            />
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p><strong>Cliente:</strong> {customerName(order)}</p>
            <p><strong>Telefone:</strong> {customerPhone(order)}</p>
            {order.deliveryAddress && <p><strong>Endereço:</strong> {order.deliveryAddress}</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [companyName, setCompanyName] = useState("Restaurante");
  const [showHistory, setShowHistory] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const { user } = useAuthStore();

  const fetchOrders = useCallback(async () => {
    try {
      // Endpoint unificado (Item 4 — Caminho 2): PDV + Cardápio Digital
      const response = await api.get("/orders/kitchen");
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchCompany() {
    if (!user?.companyId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/company/${user.companyId}`);
      const data = await res.json();
      if (data?.name) setCompanyName(data.name);
    } catch {}
  }

  async function updateStatus(id: string, status: string, source?: string) {
    try {
      const src = (source as string) || "PDV";
      await api.patch(`/orders/kitchen/${src}/${id}/status`, { status });
      toast.success("Status atualizado");
      fetchOrders();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  useEffect(() => {
    fetchOrders();
    fetchCompany();
    socket.connect();
    socket.on("orderCreated", fetchOrders);
    socket.on("kitchenUpdate", fetchOrders);
    return () => {
      socket.off("orderCreated");
      socket.off("kitchenUpdate");
      socket.disconnect();
    };
  }, [fetchOrders]);

  // Separar ativos × histórico
  const activeOrders  = orders.filter(o => !HISTORY_STATUSES.has(o.status));
  const historyOrders = orders.filter(o =>  HISTORY_STATUSES.has(o.status));
  const displayOrders = showHistory ? historyOrders : activeOrders;

  return (
    <main className="min-h-screen bg-gray-50">
      <PrinterAgentBanner />

      <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-xl">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Pedidos</h1>
              <p className="text-gray-400 text-sm">Gestão em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="border border-gray-200 text-gray-500 hover:bg-gray-100 p-2 rounded-xl transition"
              title="Atualizar"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                showHistory
                  ? "bg-gray-800 text-white border-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <History size={15} />
              Histórico
              {historyOrders.length > 0 && (
                <span className="bg-gray-400 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {historyOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Legend */}
        {!showHistory && (
          <div className="flex items-center gap-4 mb-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Em dia (&lt;25 min)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Próximo do prazo (25–45 min)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Atrasado (&gt;45 min)
            </span>
          </div>
        )}

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400">Carregando pedidos...</span>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            {showHistory ? "Nenhum pedido no histórico" : "Nenhum pedido ativo no momento"}
          </div>
        ) : (
          <div className="space-y-4">
            {displayOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
              const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
              const elapsed = elapsedMin(order);
              const isDelivery = order.orderType === "DELIVERY" || Number(order.deliveryFee) > 0;

              return (
                <div
                  key={`${(order as any).source ?? 'PDV'}-${order.id}`}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition ${timingBorderClass(order)}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      {/* Timing dot */}
                      {!HISTORY_STATUSES.has(order.status) && (
                        <span className={`w-3 h-3 rounded-full shrink-0 ${timingDotClass(order)}`} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-gray-400" />
                          <p className="font-black text-gray-900 text-sm">{customerName(order)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Phone size={11} className="text-gray-400" />
                          <p className="text-gray-400 text-xs">{customerPhone(order)}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {/* Adapter Item 4 — fonte do pedido */}
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md tracking-wide ${
                        (order as any).source === "ONLINE"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : (order as any).source === "MOCK"
                            ? "bg-purple-100 text-purple-700 border border-purple-200"
                            : (order as any).source === "IFOOD"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}>
                        {(order as any).source ?? "PDV"}
                      </span>
                      {/* Fase 2: badge de tipo de atendimento */}
                      {order.orderType === "DELIVERY" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                          🛵 Delivery
                        </span>
                      )}
                      {order.orderType === "PICKUP" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                          🏠 Retirada
                        </span>
                      )}
                      {(order.orderType === "DINE_IN" || !order.orderType) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          🍽️ Balcão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-primary font-black text-lg">
                          R$ {Number(order.total).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {PAY_LABELS[order.paymentMethod] || order.paymentMethod}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-4 space-y-3">
                    {/* Fees row */}
                    {(Number(order.deliveryFee) > 0 || Number(order.driverFee) > 0) && (
                      <div className="flex items-center gap-4 text-xs bg-blue-50 rounded-xl px-3 py-2">
                        {Number(order.deliveryFee) > 0 && (
                          <span className="text-blue-700">
                            <strong>Taxa cliente:</strong> R$ {Number(order.deliveryFee).toFixed(2)}
                          </span>
                        )}
                        {Number(order.driverFee) > 0 && (
                          <span className="text-purple-700">
                            <strong>Taxa entregador:</strong> R$ {Number(order.driverFee).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Timing row */}
                    {!HISTORY_STATUSES.has(order.status) && (
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {order.confirmedAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-green-500" />
                            Aceito às {new Date(order.confirmedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {isDelivery && order.confirmedAt && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            Previsão: {estimatedDelivery(order)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {elapsed}min
                        </span>
                      </div>
                    )}

                    {/* Address */}
                    {order.deliveryAddress && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin size={11} /> {order.deliveryAddress}
                      </p>
                    )}

                    {/* Notes */}
                    {order.notes && (
                      <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2">
                        Obs: {order.notes}
                      </p>
                    )}

                    {/* Items */}
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            <span className="font-bold text-primary">{item.quantity}x</span>{" "}
                            {item.productName}
                            {item.notes && <span className="text-gray-400 ml-2 text-xs">({item.notes})</span>}
                          </span>
                          <span className="text-gray-500 font-medium">
                            R$ {Number(item.subtotal).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
                    {/* Status select */}
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value, (order as any).source)}
                      className="border border-gray-200 focus:border-primary text-gray-700 px-3 py-2 rounded-xl outline-none text-sm font-medium"
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="PREPARING">Preparando</option>
                      <option value="READY">Pronto</option>
                      <option value="OUT_FOR_DELIVERY">Saiu entrega</option>
                      <option value="DELIVERED">Finalizado</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>

                    {/* Despachar para entrega */}
                    {order.status === "READY" && (
                      <button
                        onClick={() => updateStatus(order.id, "OUT_FOR_DELIVERY", (order as any).source)}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                      >
                        <Truck size={14} /> Despachar entrega
                      </button>
                    )}

                    {/* Finalizar */}
                    {(order.status === "OUT_FOR_DELIVERY" || order.status === "READY") && (
                      <button
                        onClick={() => {
                          if (!confirm("Finalizar este pedido?")) return;
                          updateStatus(order.id, "DELIVERED", (order as any).source);
                        }}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                      >
                        <CheckCircle2 size={14} /> Finalizar
                      </button>
                    )}

                    {/* Editar */}
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition ml-auto"
                    >
                      Editar
                    </button>

                    {/* Imprimir */}
                    <button
                      onClick={() => printOrder(order, companyName)}
                      className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition"
                    >
                      <Printer size={14} /> Imprimir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingOrder && (
        <EditNotesModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={fetchOrders}
        />
      )}
      </div>{/* /p-6 md:p-8 */}
    </main>
  );
}
