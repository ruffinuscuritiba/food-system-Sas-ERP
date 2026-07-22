import { redirect } from "next/navigation";

// Rota /delivery-tracking foi consolidada em /entrega?tab=monitoramento
export default function DeliveryTrackingLayout() {
  redirect("/entrega?tab=monitoramento");
}
