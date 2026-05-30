import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/services/api";

export type KitchenSource = "PDV" | "ONLINE";

export function useKitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadKitchen() {
    try {
      setLoading(true);
      // Endpoint unificado (Item 4 — Caminho 2): Order + OnlineOrder normalizados
      const response = await api.get("/orders/kitchen");
      setOrders(response.data || []);
      setLoadError(null);
    } catch (error: any) {
      // Sprint UX-02 Crítico #2 — antes a cozinha ficava silenciosamente vazia em erro
      const msg = error?.response?.status === 404
        ? "Endpoint /orders/kitchen indisponível — backend desatualizado"
        : "Erro ao carregar pedidos da cozinha";
      setLoadError(msg);
      toast.error(msg, { id: "kitchen-load-error", duration: 6000 });
      console.error("[useKitchen] loadKitchen failed:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Atualiza status operacional. `source` é obrigatório: PDV ou ONLINE.
   * O backend roteia para Order ou OnlineOrder e normaliza o status.
   */
  async function updateStatus(
    source: KitchenSource,
    id: string,
    productionStatus: string,
  ) {
    try {
      await api.patch(
        `/orders/kitchen/${source}/${id}/status`,
        { status: productionStatus },
      );
      await loadKitchen();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao atualizar status");
      console.error("[useKitchen] updateStatus failed:", error);
    }
  }

  useEffect(() => {
    loadKitchen();
  }, []);

  return { orders, loading, loadKitchen, updateStatus, loadError };
}
