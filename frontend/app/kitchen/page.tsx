"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { socket } from "@/services/socket";
import { api } from "@/services/api";
import { PrintRouterService } from "@/components/printing/PrintRouterService";
import { useNavKeyGuard } from "@/hooks/useNavKeyGuard";

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
  useNavKeyGuard("kitchen");

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

  async function printKitchenOrder(order: any) {
    const result = await PrintRouterService.printAll(order, { companyName: "Cozinha", sectors: ["KITCHEN", "BAR", "PIZZARIA", "LANCHONETE"] });
    if (result.blockedSectors.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const toast = (await import("react-hot-toast")).default;
      toast.error(
        `Impressão bloqueada pelo navegador (${result.blockedSectors.join(", ")}). Libere pop-ups para este site.`,
        { id: "kitchen-print-blocked", duration: 8000 },
      );
    }
  }

  useEffect(() => {
    loadOrders();
    socket.connect();

    // Recarrega após reconexão automática do socket (rede voltou / servidor reiniciou)
    socket.on("connect", () => { loadOrders(); });

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
      socket.off("connect");
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
        onPrint={printKitchenOrder}
      />
    </>
  );
}
