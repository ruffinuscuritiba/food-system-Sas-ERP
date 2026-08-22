import { redirect } from "next/navigation";

// Rota /pdv-marmitaria foi substituída por /pdv-marmitaria-restaurante
// (tela construída do zero, agora compartilhada por Marmitaria e Restaurante).
export default function PdvMarmitariaLegacyLayout() {
  redirect("/pdv-marmitaria-restaurante");
}
