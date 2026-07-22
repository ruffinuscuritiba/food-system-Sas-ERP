import { redirect } from "next/navigation";

// Rota /campanhas foi consolidada em /marketing?tab=qr
export default function CampanhasLayout() {
  redirect("/marketing?tab=qr");
}
