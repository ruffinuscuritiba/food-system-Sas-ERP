"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { socket } from "@/services/socket";
import { api } from "@/services/api";

// @hello-pangea/dnd is heavy and SSR-incompatible — load lazily
const KitchenBoard = dynamic(() => import("./KitchenBoard"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-5xl font-bold">KDS Cozinha</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl p-6 border border-gray-200 bg-white min-h-[500px] animate-pulse" />
        ))}
      </div>
    </main>
  ),
});

export default function KitchenPage() {

  const [orders, setOrders] = useState<any[]>([]);
  const audioRef   = useRef<any>(null);
  const printedOrders = useRef<any[]>([]);
  const containerRef  = useRef<any>(null);

  async function loadOrders() {
    // Adapter Item 4 — Caminho 2: lista unificada PDV + Cardápio Digital
    try {
      const response = await api.get("/orders/kitchen");
      setOrders(response.data);
    } catch (error: any) {
      // Sprint UX-02 Crítico #2 — evitar tela silenciosamente vazia em erro
      // (antes: operador achava que não havia pedidos quando o GET falhava)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const toast = (await import("react-hot-toast")).default;
      const status = error?.response?.status;
      const msg = status === 404
        ? "Endpoint /orders/kitchen indisponível — backend desatualizado"
        : "Erro ao carregar pedidos. Verifique conexão.";
      toast.error(msg, { id: "kitchen-load-error", duration: 6000 });
      console.error("[Kitchen] loadOrders failed:", error);
    }
  }

  function printKitchenOrder(order: any) {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;

    // items já vem como array de objetos do backend
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map((item: any) => {
      const complements: any[] = Array.isArray(item.selectedComplements) ? item.selectedComplements : [];
      const complementsHtml = complements.map((c: any) =>
        `<div style="margin-left:16px;font-size:16px;color:#555;">
          + ${c.quantity}x ${c.optionName}${Number(c.price) > 0 ? ` (R$${Number(c.price).toFixed(2)})` : ""}
        </div>`
      ).join("");
      return `
        <div style="margin-bottom:15px;">
          <b style="font-size:22px;">${item.quantity}x ${item.productName || item.name || ""}</b><br/>
          ${item.notes ? `<i style="font-size:16px;">Obs: ${item.notes}</i><br/>` : ""}
          ${complementsHtml}
          R$ ${Number(item.subtotal || 0).toFixed(2)}
        </div>
      `;
    }).join("");

    const typeLabels: Record<string, string> = {
      DELIVERY: "🛵 Delivery",
      PICKUP:   "🏠 Retirada",
      DINE_IN:  "🍽️ Balcão",
    };
    const typeLabel = typeLabels[order.orderType] || typeLabels.DINE_IN;
    const clientName = order.customerName || order.customer?.name || order.notes || "—";

    printWindow.document.write(`
      <html><head><title>Pedido</title>
      <style>body{font-family:Arial;width:300px;padding:20px}h1{text-align:center;font-size:28px}h2{font-size:22px}.line{margin-bottom:12px;font-size:18px}hr{margin:20px 0}.type{font-size:20px;font-weight:bold;text-align:center;margin-bottom:8px}</style>
      </head><body>
        <h1>COZINHA</h1><hr/>
        <div class="type">${typeLabel}</div>
        <div class="line"><b>Cliente:</b> ${clientName}</div>
        ${order.customerPhone ? `<div class="line"><b>Tel:</b> ${order.customerPhone}</div>` : ""}
        ${order.deliveryAddress ? `<div class="line"><b>Endereço:</b> ${order.deliveryAddress}</div>` : ""}
        <div class="line"><b>Pagamento:</b> ${order.paymentMethod}</div>
        <div class="line"><b>Total:</b> R$ ${Number(order.total).toFixed(2)}</div>
        <hr/>${itemsHtml}<hr/>
        <h2>${order.status}</h2>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  useEffect(() => {
    loadOrders();
    socket.connect();

    socket.on("orderCreated", (newOrder) => {
      loadOrders();
      if (!printedOrders.current.includes(newOrder.id)) {
        printedOrders.current.push(newOrder.id);
        audioRef.current?.play();
        printKitchenOrder(newOrder);
      }
    });

    socket.on("kitchenUpdate", () => { loadOrders(); });

    return () => {
      socket.off("orderCreated");
      socket.off("kitchenUpdate");
      socket.disconnect();
    };
  }, []);

  async function updateStatus(source: string, id: string, status: string) {
    // Endpoint unificado do adapter — backend roteia para Order ou OnlineOrder
    await api.patch(`/orders/kitchen/${source}/${id}/status`, { status });
    loadOrders();
  }

  async function handleDragEnd(result: any) {
    if (!result.destination) return;
    // draggableId vem do KitchenBoard como `${source}-${id}` — primeiro hífen separa
    const draggableId: string = result.draggableId;
    const sepIdx = draggableId.indexOf("-");
    const source = sepIdx > 0 ? draggableId.slice(0, sepIdx) : "PDV";
    const id     = sepIdx > 0 ? draggableId.slice(sepIdx + 1) : draggableId;
    await updateStatus(source, id, result.destination.droppableId);
    loadOrders();
  }

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" />
      <KitchenBoard
        orders={orders}
        updateStatus={updateStatus}
        handleDragEnd={handleDragEnd}
        containerRef={containerRef}
      />
    </>
  );
}
