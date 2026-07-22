import { redirect } from "next/navigation";

// Rota /campanhas-recorrentes foi consolidada em /marketing?tab=reengajamento
export default function CampanhasRecorrentesLayout() {
  redirect("/marketing?tab=reengajamento");
}
