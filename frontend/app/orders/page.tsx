"use client";
import { api } from "@/services/api";
import { apiBaseUrl } from "@/services/env";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { socket } from "@/services/socket";
import { useAuthStore } from "@/stores/auth.store";
import { ShoppingCart, Printer, Clock } from "lucide-react";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  paymentMethod: string;
  deliveryFee: number;
  total: number;
  status: string;
  orderType?: string;
  notes?: string;
  items: OrderItem[];
  createdAt?: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:           { label: "Pendente",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  CONFIRMED:         { label: "Confirmado",   color: "bg-blue-100 text-blue-700 border-blue-200" },
  PREPARING:         { label: "Preparando",   color: "bg-primary/10 text-orange-700 border-primary/20" },
  READY:             { label: "Pronto",       color: "bg-green-100 text-green-700 border-green-200" },
  OUT_FOR_DELIVERY:  { label: "Saiu entrega", color: "bg-purple-100 text-purple-700 border-purple-200" },
  DELIVERED:         { label: "Finalizado",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  CANCELLED:         { label: "Cancelado",    color: "bg-red-100 text-red-600 border-red-200" },
};

const PAY_LABELS: Record<string, string> = {
  PIX: "PIX", CASH: "Dinheiro", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Restaurante");
  const { user } = useAuthStore();

  async function fetchOrders() {
    try {
      const response = await api.get("/orders");
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompany() {
    if (!user?.companyId) return;
    try {
      const response = await fetch(`${apiBaseUrl}/company/${user.companyId}`);
      const data = await response.json();
      if (data?.name) setCompanyName(data.name);
    } catch {}
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success("Status atualizado");
      fetchOrders();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  function printOrder(order: Order) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // items já é array de objetos do backend
    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];

    const itemsHtml = items.map((item) => `
      <div style="margin-bottom:10px;">
        <b>${item.quantity}x ${item.productName}</b>
        ${item.notes ? `<br/><i>Obs: ${item.notes}</i>` : ""}
        <br/>R$ ${Number(item.subtotal).toFixed(2)}
      </div>
    `).join("");

    printWindow.document.write(`
      <html>
        <head><title>Pedido</title>
          <style>body{font-family:Arial;width:300px;padding:20px}h1{text-align:center}.line{margin-bottom:10px}hr{margin:20px 0}</style>
        </head>
        <body>
          <h1>${companyName}</h1><hr/>
          <div class="line"><b>Cliente:</b> ${order.customerName}</div>
          <div class="line"><b>Telefone:</b> ${order.customerPhone}</div>
          ${order.deliveryAddress ? `<div class="line"><b>Endereço:</b> ${order.deliveryAddress}</div>` : ""}
          <div class="line"><b>Pagamento:</b> ${PAY_LABELS[order.paymentMethod] || order.paymentMethod}</div>
          <hr/>${itemsHtml}<hr/>
          ${Number(order.deliveryFee) > 0 ? `<div class="line"><b>Entrega:</b> R$ ${Number(order.deliveryFee).toFixed(2)}</div>` : ""}
          <div class="line"><b>Total:</b> R$ ${Number(order.total).toFixed(2)}</div>
          <hr/><h2>${STATUS_LABELS[order.status]?.label || order.status}</h2>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-primary p-2.5 rounded-xl">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Pedidos</h1>
            <p className="text-gray-400 text-sm">Gestão em tempo real</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400">Carregando pedidos...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            Nenhum pedido encontrado
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
              const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Header do pedido */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-black text-gray-900">{order.customerName}</p>
                        <p className="text-gray-400 text-xs">{order.customerPhone}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-black text-lg">
                        R$ {Number(order.total).toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        {PAY_LABELS[order.paymentMethod] || order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="px-5 py-4">
                    {order.deliveryAddress && (
                      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                        <Clock size={11} /> Entrega: {order.deliveryAddress}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-xs text-primary bg-primary/5 rounded-lg px-3 py-2 mb-3">
                        Obs: {order.notes}
                      </p>
                    )}
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            <span className="font-bold text-primary">{item.quantity}x</span> {item.productName}
                            {item.notes && <span className="text-gray-400 ml-2 text-xs">({item.notes})</span>}
                          </span>
                          <span className="text-gray-500 font-medium">R$ {Number(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="px-5 pb-4 flex items-center justify-between gap-3">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className="border border-gray-200 focus:border-primary text-gray-700 px-4 py-2.5 rounded-xl outline-none text-sm font-medium flex-1 max-w-xs"
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="PREPARING">Preparando</option>
                      <option value="READY">Pronto</option>
                      <option value="OUT_FOR_DELIVERY">Saiu entrega</option>
                      <option value="DELIVERED">Finalizado</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                    <button
                      onClick={() => printOrder(order)}
                      className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm transition"
                    >
                      <Printer size={15} />
                      Imprimir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
