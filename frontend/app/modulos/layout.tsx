import { redirect } from "next/navigation";

// Rota /modulos foi consolidada em /configuracoes?tab=plano
export default function ModulosLayout() {
  redirect("/configuracoes?tab=plano");
}
