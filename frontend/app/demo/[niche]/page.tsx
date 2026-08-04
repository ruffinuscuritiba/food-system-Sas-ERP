"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import AutoEnterDemo from "../_AutoEnterDemo";

// Link mágico por nicho — /demo/marmitaria, /demo/hamburgueria, etc.
// Resolve o slug direto pra UMA conta de demo específica e loga sozinho (ver
// _AutoEnterDemo), sem precisar passar pelo wizard de /demo. Cobre também
// basic/pro/enterprise/delivery pra quem prefere link direto de plano em vez
// de nicho — delivery não tinha link próprio antes (só existiam pastas
// estáticas pra basic/pro/enterprise).
const NICHE_SLUG_TO_ACCOUNT: Record<string, string> = {
  basic: "demo-basic-001",
  pro: "demo-pro-001",
  enterprise: "demo-enterprise-001",
  delivery: "demo-delivery-001",

  marmitaria: "demo-delivery-001",
  marmitarias: "demo-delivery-001",

  pizzaria: "demo-basic-001",
  pizzarias: "demo-basic-001",
  restaurante: "demo-pro-001",
  restaurantes: "demo-pro-001",

  hamburgueria: "demo-hamburgueria-001",
  hamburguerias: "demo-hamburgueria-001",

  lanchonete: "demo-lanchonete-001",
  lanchonetes: "demo-lanchonete-001",

  churrascaria: "demo-churrascaria-001",
  churrascarias: "demo-churrascaria-001",

  hotdog: "demo-hotdog-001",
  hotdogs: "demo-hotdog-001",
  "hot-dog": "demo-hotdog-001",

  padaria: "demo-padaria-001",
  padarias: "demo-padaria-001",

  confeitaria: "demo-confeitaria-001",
  confeitarias: "demo-confeitaria-001",
  doceria: "demo-confeitaria-001",

  pastelaria: "demo-pastelaria-001",
  pastelarias: "demo-pastelaria-001",

  acai: "demo-acai-001",
  "açai": "demo-acai-001",

  conveniencia: "demo-conveniencia-001",
  "conveniência": "demo-conveniencia-001",
  adega: "demo-conveniencia-001",

  mercado: "demo-mercado-001",
  mercados: "demo-mercado-001",
  mercearia: "demo-mercado-001",
};

export default function DemoNichePage() {
  const params = useParams<{ niche: string | string[] }>();
  const router = useRouter();
  const raw = Array.isArray(params.niche) ? params.niche[0] : params.niche;
  const slug = (raw ?? "").toLowerCase();
  const accountId = NICHE_SLUG_TO_ACCOUNT[slug];

  useEffect(() => {
    // Slug não reconhecido (link digitado errado à mão, por exemplo) — manda
    // pro wizard normal em vez de travar numa tela de erro; /demo?niche=X já
    // tem fallback seguro pra "Restaurantes" se X também não bater lá.
    if (!accountId) router.replace(`/demo?niche=${encodeURIComponent(slug)}`);
  }, [accountId, slug, router]);

  if (!accountId) return null;
  return <AutoEnterDemo accountId={accountId} />;
}
