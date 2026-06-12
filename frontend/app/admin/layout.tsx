import { redirect } from "next/navigation";

// Rota /admin foi consolidada em /configuracoes?tab=equipe
export default function AdminLayout() {
  redirect("/configuracoes?tab=equipe");
}
