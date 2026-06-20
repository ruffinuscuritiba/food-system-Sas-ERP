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
    badge:         "🍱 Marmitarias, Marmitex & Dark Kitchens",
    heroHighlight: "Mais marmitas entregues. Zero confusão no WhatsApp do almoço.",
    screenshots: {
      basic:      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
      pro:        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80",
      enterprise: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    },
    plans: {
      basic: {
        tagline: "Ideal para organizar as vendas do almoço e eliminar o papel de vez.",
        features: [
          "PDV de Montagem Rápida (Tamanho e Misturas)",
          "Impressão Automática na Cozinha",
          "Link de Pedidos Web",
          "Aviso de recebimento de Pix",
        ],
      },
      pro: {
        tagline: "Para marmitarias que querem dominar a região e fidelizar clientes.",
        features: [
          "Agrupamento de Motoboys por Bairros",
          "Assinatura Mensal/Semanal de Marmitas",
          "Programa de Fidelidade Integrado",
          "Ficha Técnica (Controle do KG do Arroz/Proteína)",
        ],
      },
      enterprise: {
        tagline: "A força operacional que sua Dark Kitchen ou franquia de marmitas precisa.",
        features: [
          "Múltiplas Cozinhas / Terminais de Produção",
          "Dashboards Consolidados em Tempo Real",
          "API para Integrações de Logística",
          "Suporte VIP 24/7",
        ],
      },
    },
  },

  // ─── Pastelaria & Food Truck ─────────────────────────────────────────────────
  pastelaria: {
    badge:         "🥟 Pastelarias & Food Trucks",
    heroHighlight: "Pastéis recheados e sequinhos. Atendimento ágil sem errar comandas.",
    screenshots: {
      basic:      "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=800&auto=format&fit=crop&q=80",
      pro:        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80",
      enterprise: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    },
    plans: {
      basic: {
        tagline: "Perfeito para agilizar o balcão e os adicionais complexos de cada pastel.",
        features: [
          "Frente de Caixa Tátil e Veloz",
          "Grade de Adicionais Avançada (Sem erros)",
          "Impressão Setorizada (Fritadeira)",
          "Painel de Senhas Básico",
        ],
      },
      pro: {
        tagline: "Controle total dos recheios nobres e fila automatizada no WhatsApp.",
        features: [
          "Cardápio Digital com Upsell de Bebidas",
          "Controle Estrito de Insumos (Gramatura)",
          "Impressão Automática de Cupons para Fritura",
          "Motor de Cupons para Sexta e Sábado",
        ],
      },
      enterprise: {
        tagline: "Gestão inteligente para redes de pastelarias com alto volume de vendas.",
        features: [
          "Gestão de Franquias e Estoque Central",
          "BI e Relatórios Avançados de Margem de Lucro",
          "Múltiplos Caixas Simultâneos",
          "Gerente de Conta Dedicado",
        ],
      },
    },
  },

  // ─── Hot-Dog & Snack Bar ──────────────────────────────────────────────────────
  hotdog: {
    badge:         "🌭 Hot-Dogs, Hamburguerias & Lanchonetes",
    heroHighlight: "Lanches montados na velocidade da luz. Clientes avisados sozinhos.",
    screenshots: {
      basic:      "https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=800&auto=format&fit=crop&q=80",
      pro:        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop&q=80",
      enterprise: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80",
    },
    plans: {
      basic: {
        tagline: "Ideal para chapas e lanchonetes agilizarem a entrada do lanche na cozinha.",
        features: [
          "KDS na Chapa (Sem papelzinho sumindo)",
          "Modificadores de Ingredientes (-Milho, +Cheddar)",
          "Histórico de Pedidos Simplificado",
          "Impressão de Linha de Produção",
        ],
      },
      pro: {
        tagline: "Para marcas em crescimento explodirem o faturamento com combos inteligentes.",
        features: [
          "Sugestão Automática de Combos no Checkout",
          "Status Automático de Envio no WhatsApp",
          "Controle de Estoque de Pães e Carnes",
          "Gestão de Rotas de Entrega Local",
        ],
      },
      enterprise: {
        tagline: "Performance extrema para marcas líderes de Delivery e Redes de Lanches.",
        features: [
          "Infraestrutura de Servidor Dedicada",
          "Integração Completa de APIs Logísticas",
          "Controle de Perdas de Insumos da Chapa",
          "Suporte Prioritário nos Horários de Pico",
        ],
      },
    },
  },
};
