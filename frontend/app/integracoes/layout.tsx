import { redirect } from "next/navigation";

// Rota /integracoes foi consolidada em /configuracoes?tab=integracoes
export default function IntegracoesLayout() {
  redirect("/configuracoes?tab=integracoes");
}
