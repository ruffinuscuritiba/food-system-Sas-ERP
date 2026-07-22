import { redirect } from "next/navigation";

// Rota /trafego-pago foi consolidada em /marketing?tab=trafego
export default function TrafegoPagoLayout() {
  redirect("/marketing?tab=trafego");
}
