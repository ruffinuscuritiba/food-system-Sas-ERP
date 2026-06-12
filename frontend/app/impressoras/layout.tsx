import { redirect } from "next/navigation";

// Rota /impressoras foi consolidada em /configuracoes?tab=impressao
export default function ImpressorasLayout() {
  redirect("/configuracoes?tab=impressao");
}
