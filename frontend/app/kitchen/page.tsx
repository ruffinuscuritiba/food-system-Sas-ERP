"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { socket } from "@/services/socket";
import { api } from "@/services/api";

// @hello-pangea/dnd is heavy and SSR-incompatible — load lazily
const KitchenBoard = dynamic(() => import("./KitchenBoard"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-5xl font-bold">KDS Cozinha</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl p-6 border border-slate-800 bg-slate-900 min-h-[500px] animate-pulse" />
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
    const response = await api.get("/orders");
    setOrders(response.data);
  }

  function printKitchenOrder(order: any) {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;

    // items já vem como array de objetos do backend
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map((item: any) => `
      <div style="margin-bottom:15px;">
        <b style="font-size:22px;">${item.quantity}x ${item.productName || item.name || ""}</b><br/>
        ${item.notes ? `<i>Obs: ${item.notes}</i><br/>` : ""}
        R$ ${Number(item.subtotal || 0).toFixed(2)}
      </div>
    `).join("");

    printWindow.document.write(`
      <html><head><title>Pedido</title>
      <style>body{font-family:Arial;width:300px;padding:20px}h1{text-align:center;font-size:28px}h2{font-size:22px}.line{margin-bottom:12px;font-size:18px}hr{margin:20px 0}</style>
      </head><body>
        <h1>COZINHA</h1><hr/>
        <div class="line"><b>Cliente:</b> ${order.customerName}</div>
        <div class="line"><b>Pagamento:</b> ${order.paymentMethod}</div>
        <div class="line"><b>Total:</b> R$ ${order.total}</div>
        <hr/>${itemsHtml}<hr/>
        <h2>${order.productionStatus}</h2>
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

  async function updateStatus(id: string, productionStatus: string) {
    await api.patch(`/orders/${id}/production-status`, { productionStatus });
    loadOrders();
  }

  async function handleDragEnd(result: any) {
    if (!result.destination) return;
    await updateStatus(result.draggableId, result.destination.droppableId);
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
