import { redirect } from "next/navigation";

// Rota /entregadores foi consolidada em /entrega?tab=entregador
export default function EntregadoresLayout() {
  redirect("/entrega?tab=entregador");
}
