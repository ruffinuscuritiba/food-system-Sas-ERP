import { redirect } from "next/navigation";

// Rota /theme foi consolidada em /configuracoes?tab=aparencia
export default function ThemeLayout() {
  redirect("/configuracoes?tab=aparencia");
}
