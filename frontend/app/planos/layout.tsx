import { redirect } from "next/navigation";

// Rota /planos foi consolidada em /configuracoes?tab=plano
export default function PlanosLayout() {
  redirect("/configuracoes?tab=plano");
}
