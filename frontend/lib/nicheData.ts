/**
 * Dados dinâmicos por nicho para a página /demo.
 * Injetados via ?niche=marmitaria | pastelaria | hotdog | restaurante
 * Fallback: "restaurante"
 *
 * IMAGENS — Unsplash photo IDs (800×320, crop, q=80).
 * Substitua os IDs por assets próprios em /public/demo-assets/niches/ quando disponíveis.
 */

export type NicheKey = "restaurante" | "marmitaria" | "pastelaria" | "hotdog";
export type PlanKey  = "basic" | "pro" | "enterprise";

export interface NichePlanData {
  tagline:  string;
  features: string[];
}

export interface NicheData {
  /** Badge exibida no hero quando o nicho é detectado */
  badge: string;
  /** Nomes destacados no subtítulo do hero */
  heroHighlight: string;
  /** Screenshots por plano */
  screenshots: Record<PlanKey, string>;
  /** Copy de cada plano */
  plans: Record<PlanKey, NichePlanData>;
}

export const VALID_NICHES: NicheKey[] = ["restaurante", "marmitaria", "pastelaria", "hotdog"];

/** Resolve o niche da query string com fallback seguro */
export function resolveNiche(raw: string | null): NicheKey {
  return VALID_NICHES.includes(raw as NicheKey) ? (raw as NicheKey) : "restaurante";
}

// ─── Helper de URL Unsplash ───────────────────────────────────────────────────
function us(id: string) {
  return `https://images.unsplash.com/photo-${id}?fit=crop&w=800&h=320&q=80&auto=format`;
}

// ─── Dicionário principal ─────────────────────────────────────────────────────
export const NICHE_DATA: Record<NicheKey, NicheData> = {

  // ─── Restaurante / Pizzaria (padrão) ────────────────────────────────────────
  restaurante: {
    badge:         "🍕 Restaurantes & Pizzarias",
    heroHighlight: "pizzarias, restaurantes e hamburguerias",
    screenshots: {
      basic:      "/demo-assets/banners/pizzas-salgadas.jpg",
      pro:        "/demo-assets/banners/combos.jpg",
      enterprise: "/demo-assets/banners/pizzas-doces.jpg",
    },
    plans: {
      basic: {
        tagline: "Ideal para começar a receber pedidos online, organizar a cozinha e eliminar de vez as anotações em papel.",
        features: [
          "PDV Ágil com categorias e variações",
          "Impressão automática na cozinha (KDS)",
          "Cardápio digital com link próprio",
          "Mesas e comandas digitais",
          "Controle de caixa diário",
        ],
      },
      pro: {
        tagline: "A solução completa para faturar alto no fim de semana, com fidelidade, cupons e controle rigoroso do estoque.",
        features: [
          "Tudo do Basic, mais:",
          "Cupons de desconto e combos avançados",
          "Programa de fidelidade com pontos",
          "Relatórios de lucratividade por produto",
          "Ficha técnica e controle de CMV",
        ],
      },
      enterprise: {
        tagline: "Para redes de restaurantes, franquias e dark kitchens com alta demanda, múltiplos terminais e relatórios gerenciais.",
        features: [
          "Tudo do Pro, mais:",
          "Dashboards consolidados multi-unidade",
          "Usuários ilimitados com papéis e permissões",
          "WhatsApp IA 24h integrado ao cardápio",
          "Suporte VIP com SLA gerencial",
        ],
      },
    },
  },

  // ─── Marmitaria & Dark Kitchen ───────────────────────────────────────────────
  marmitaria: {
    badge:         "🍱 Marmitarias & Dark Kitchens",
    heroHighlight: "marmitarias, dark kitchens e delivery corporativo",
    screenshots: {
      // meal-prep containers, logistics, commercial kitchen
      basic:      us("1546554137-ef5b733b594c"),
      pro:        us("1578662996442-48f60103fc96"),
      enterprise: us("1565299624133-2e0bf6249c6f"),
    },
    plans: {
      basic: {
        tagline: "Comece a receber pedidos de marmita de forma automática, organize as rotas de entrega e elimine as planilhas.",
        features: [
          "Cardápio de marmitas com opções de dieta",
          "PDV para balcão, delivery e encomendas",
          "Etiquetas de identificação por pedido",
          "Gestão de sabores, tamanhos e restrições",
          "Controle financeiro diário simplificado",
        ],
      },
      pro: {
        tagline: "Gerencie dezenas de entregas diárias, controle entregadores e fidelize clientes com assinatura semanal ou mensal.",
        features: [
          "Tudo do Basic, mais:",
          "Painel de logística e mapa de entregadores",
          "Programa de fidelidade para assinantes recorrentes",
          "Ficha técnica e custo real por marmita",
          "Relatórios de entregas, horários e rotas",
        ],
      },
      enterprise: {
        tagline: "Para operações corporativas e dark kitchens com múltiplas cozinhas, contratos empresariais e relatórios consolidados.",
        features: [
          "Tudo do Pro, mais:",
          "Gestão de contratos e clientes corporativos",
          "Múltiplas cozinhas com KPIs consolidados",
          "Controle de produção por turno e CMV real",
          "Suporte VIP com SLA e gerente de conta",
        ],
      },
    },
  },

  // ─── Pastelaria & Food Truck ─────────────────────────────────────────────────
  pastelaria: {
    badge:         "🥟 Pastelarias & Food Trucks",
    heroHighlight: "pastelarias, food trucks e lanchonetes de rua",
    screenshots: {
      // golden fried pastry, bakery counter, food production
      basic:      us("1603894584373-5ac82b2ae398"),
      pro:        us("1556910585-f339b8d26d70"),
      enterprise: us("1571091718767-18b5b1457add"),
    },
    plans: {
      basic: {
        tagline: "Cadastre recheios e tamanhos, monte combos e receba pedidos no balcão e no delivery sem pagar comissão para ninguém.",
        features: [
          "Cardápio de pastéis com recheios e adicionais",
          "PDV rápido otimizado para atendimento no balcão",
          "Gestão de combos, meio-a-meio e promoções",
          "Impressão automática de comanda na cozinha",
          "Controle de caixa e sangria diária",
        ],
      },
      pro: {
        tagline: "Controle o custo de cada pastel pela ficha técnica, fidelize clientes frequentes e venda mais nos horários de pico.",
        features: [
          "Tudo do Basic, mais:",
          "Ficha técnica por sabor e tipo de pastel",
          "Programa de fidelidade e cartão de pontos",
          "Relatórios dos produtos e adicionais mais vendidos",
          "Cupons para horários de baixo movimento",
        ],
      },
      enterprise: {
        tagline: "Para redes de pastelaria com múltiplos pontos, controle de produção centralizado, turnos e gestão de franquias.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos pontos de venda integrados em tempo real",
          "Controle de produção por turno e fritadeira",
          "Gestão e performance de franquias",
          "Dashboards consolidados e relatórios de rede",
        ],
      },
    },
  },

  // ─── Hot-Dog & Snack Bar ──────────────────────────────────────────────────────
  hotdog: {
    badge:         "🌭 Hot-Dogs & Lanchonetes",
    heroHighlight: "hot-dogs, lanchonetes e snack bars",
    screenshots: {
      // gourmet hot dog, kitchen prep, franchise fast food
      basic:      us("1546793665-c74683f339c1"),
      pro:        us("1555939594-58d7cb561498"),
      enterprise: us("1568901346375-23c9450c58cd"),
    },
    plans: {
      basic: {
        tagline: "Receba pedidos pelo cardápio digital, gerencie ingredientes da chapa e imprima comanda automaticamente — tudo em segundos.",
        features: [
          "Cardápio de lanches com molhos e adicionais",
          "PDV ágil para balcão e delivery",
          "Gestão de ingredientes e montagem na chapa",
          "Impressão de comanda automática na cozinha",
          "Controle financeiro de caixa por turno",
        ],
      },
      pro: {
        tagline: "Controle o custo real de cada lanche, fidelize clientes com pontos e venda mais no happy hour e nos fins de semana.",
        features: [
          "Tudo do Basic, mais:",
          "Ficha técnica e custo por lanche (CMV real)",
          "Programa de fidelidade com pontos e cashback",
          "Cupons de desconto, combos e promoções ativas",
          "Relatórios de horários e produtos mais vendidos",
        ],
      },
      enterprise: {
        tagline: "Para redes de lanches e franquias com múltiplos terminais, controle centralizado de insumos e dashboards de performance.",
        features: [
          "Tudo do Pro, mais:",
          "Gestão de multi-unidades em tempo real",
          "Controle centralizado de insumos e estoque",
          "Dashboards de performance por unidade",
          "Suporte VIP para redes e franqueados",
        ],
      },
    },
  },
};
