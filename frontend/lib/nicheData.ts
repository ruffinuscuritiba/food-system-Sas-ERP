/**
 * Dados dinâmicos por nicho para a página /demo.
 * Injetados via ?niche=marmitaria | pastelaria | hotdog | restaurante
 * Fallback: "restaurante"
 *
 * IMAGENS — Unsplash photo IDs (800×320, crop, q=80).
 * Substitua os IDs por assets próprios em /public/demo-assets/niches/ quando disponíveis.
 */

export type NicheKey =
  | "restaurante"
  | "pizzaria"
  | "hamburgueria"
  | "lanchonete"
  | "churrascaria"
  | "marmitaria"
  | "hotdog"
  | "pastelaria"
  | "acai"
  | "padaria"
  | "doceria"
  | "conveniencia"
  | "mercado";
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

export const VALID_NICHES: NicheKey[] = [
  "restaurante", "pizzaria", "hamburgueria", "lanchonete", "churrascaria",
  "marmitaria", "hotdog", "pastelaria", "acai", "padaria", "doceria",
  "conveniencia", "mercado",
];

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

  // ─── Pizzaria (separado do restaurante genérico) ─────────────────────────────
  pizzaria: {
    badge:         "🍕 Pizzarias & Esfihoarias",
    heroHighlight: "Mais pizzas saindo da fornalha. Cliente avisado no WhatsApp na hora certa.",
    screenshots: {
      basic:      "/demo-assets/banners/pizzas-salgadas.jpg",
      pro:        "/demo-assets/banners/combos.jpg",
      enterprise: "/demo-assets/banners/pizzas-doces.jpg",
    },
    plans: {
      basic: {
        tagline: "Ideal para organizar o salão, eliminar o caderninho e receber pedidos online.",
        features: [
          "Cardápio Digital com múltiplos sabores por pizza",
          "KDS na Cozinha e no Forno (sem papelzinho)",
          "Mesas e Comandas Digitais",
          "Bordas Recheadas configuráveis por tamanho",
          "Controle de Caixa Diário",
        ],
      },
      pro: {
        tagline: "Para pizzarias que dominam o delivery nos fins de semana e querem fidelizar clientes.",
        features: [
          "Tudo do Basic, mais:",
          "WhatsApp IA para receber pedidos 24h",
          "Cupons de desconto e programa de fidelidade",
          "Ficha técnica de ingredientes e controle de CMV",
          "Relatórios de pizza mais vendida e lucratividade",
        ],
      },
      enterprise: {
        tagline: "Para redes de pizzarias com múltiplas unidades e alto volume de produção.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais de cozinha simultâneos",
          "Dashboards consolidados multi-unidade",
          "Integração com iFood e 99Food",
          "Suporte VIP com SLA gerencial",
        ],
      },
    },
  },

  // ─── Hamburgueria ────────────────────────────────────────────────────────────
  hamburgueria: {
    badge:         "🍔 Hamburguerias & Burger Joints",
    heroHighlight: "Smash burguers saindo perfeitos. Fila organizada e clientes satisfeitos.",
    screenshots: {
      basic:      us("1552539-1600871234"),
      pro:        us("1556742049-0cfed4f6a45d"),
      enterprise: us("1551836022-d5d88e9218df"),
    },
    plans: {
      basic: {
        tagline: "Perfeito para organizar o balcão, os complementos e a sequência de produção.",
        features: [
          "PDV com modificadores de ingredientes (+Cheddar, -Cebola)",
          "KDS na Chapa sem papelzinho",
          "Cardápio Digital com fotos e combos",
          "Impressão setorizada (chapa / balcão)",
          "Controle de Caixa Diário",
        ],
      },
      pro: {
        tagline: "Para marcas que querem crescer no delivery e fidelizar clientes com combos inteligentes.",
        features: [
          "Tudo do Basic, mais:",
          "Sugestão automática de combos no checkout",
          "Status automático de envio no WhatsApp",
          "Controle de estoque de pães, carnes e insumos",
          "Programa de fidelidade com pontos",
        ],
      },
      enterprise: {
        tagline: "Performance extrema para marcas líderes de delivery e redes de burguer.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais de caixa simultâneos",
          "Integração completa com iFood e APIs logísticas",
          "Dashboards consolidados multi-unidade",
          "Suporte prioritário nos horários de pico",
        ],
      },
    },
  },

  // ─── Lanchonete ──────────────────────────────────────────────────────────────
  lanchonete: {
    badge:         "🥪 Lanchonetes & Salgaderias",
    heroHighlight: "Atendimento rápido, estoque organizado e caixa no controle.",
    screenshots: {
      basic:      us("1619740455993-9e612b1af08a"),
      pro:        us("1504674900247-0877df9cc836"),
      enterprise: us("1460925895917-afdab827c52f"),
    },
    plans: {
      basic: {
        tagline: "Ideal para lanchonetes que querem agilizar o caixa e organizar os pedidos.",
        features: [
          "PDV Ágil com categorias e variações",
          "Cardápio Digital com link próprio",
          "Controle de Caixa Diário",
          "Impressão de comanda na cozinha",
          "Mesas e Comandas Digitais",
        ],
      },
      pro: {
        tagline: "Para lanchonetes que querem dominar o bairro com delivery e fidelidade.",
        features: [
          "Tudo do Basic, mais:",
          "Cardápio Digital com pedido online",
          "Programa de fidelidade e cupons",
          "Controle de estoque e ficha técnica",
          "Relatórios de produtos mais vendidos",
        ],
      },
      enterprise: {
        tagline: "Para redes de lanchonetes com múltiplos pontos de venda.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais simultâneos",
          "Dashboards consolidados",
          "Integração com iFood e 99Food",
          "Suporte VIP",
        ],
      },
    },
  },

  // ─── Churrascaria ────────────────────────────────────────────────────────────
  churrascaria: {
    badge:         "🥩 Churrascarias & Espetos",
    heroHighlight: "Rodízio, comanda digital e corte no ponto certo para cada mesa.",
    screenshots: {
      basic:      us("1529193591184-b1d58069ecdd"),
      pro:        us("1546069901-ba9599a7e63c"),
      enterprise: us("1551288049-bebda4e38f71"),
    },
    plans: {
      basic: {
        tagline: "Ideal para organizar mesas, comandas e controle do rodízio.",
        features: [
          "Mesas e Comandas Digitais",
          "KDS na Churrasqueira",
          "Cardápio Digital com fotos das carnes",
          "Controle de Caixa Diário",
          "Garçom Digital (app PWA)",
        ],
      },
      pro: {
        tagline: "Para churrascarias que querem maximizar o ticket médio e o giro de mesas.",
        features: [
          "Tudo do Basic, mais:",
          "Controle de CMV por corte de carne",
          "Programa de fidelidade",
          "Relatórios de lucratividade",
          "WhatsApp IA para reservas e pedidos",
        ],
      },
      enterprise: {
        tagline: "Para grupos e redes com múltiplas unidades e alto volume.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais e KDS simultâneos",
          "Dashboards consolidados",
          "Integração com iFood",
          "Suporte VIP com SLA gerencial",
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

  // ─── Açaí & Vitaminas ────────────────────────────────────────────────────────
  acai: {
    badge:         "🫐 Açaí, Vitaminas & Smoothies",
    heroHighlight: "Tigelas montadas na velocidade certa. Filas no balcão no controle.",
    screenshots: {
      basic:      us("1546069901-ba9599a7e63c"),
      pro:        us("1565299624946-b28f40a0ae38"),
      enterprise: us("1551288049-bebda4e38f71"),
    },
    plans: {
      basic: {
        tagline: "Ideal para organizar o balcão, os adicionais e a fila de montagem das tigelas.",
        features: [
          "PDV de Montagem Rápida (tamanho + adicionais)",
          "Cardápio Digital com fotos das tigelas",
          "Controle de Caixa Diário",
          "Pedido pelo WhatsApp sem robô",
          "Impressão de comanda de montagem",
        ],
      },
      pro: {
        tagline: "Para açaiterias que querem dominar o bairro com delivery e fidelidade.",
        features: [
          "Tudo do Basic, mais:",
          "Cardápio Digital com pedido online",
          "Programa de fidelidade e cupons de retorno",
          "Controle de estoque de frutas e insumos",
          "WhatsApp IA para pedidos 24h",
        ],
      },
      enterprise: {
        tagline: "Para redes de açaiterias com múltiplos pontos de venda.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais simultâneos",
          "Dashboards consolidados",
          "Integração com iFood e 99Food",
          "Suporte VIP",
        ],
      },
    },
  },

  // ─── Padaria & Confeitaria ───────────────────────────────────────────────────
  padaria: {
    badge:         "🥐 Padarias & Confeitarias",
    heroHighlight: "Pão saído do forno. Café da manhã organizado. Caixa sem fila.",
    screenshots: {
      basic:      us("1504674900247-0877df9cc836"),
      pro:        us("1565299624946-b28f40a0ae38"),
      enterprise: us("1460925895917-afdab827c52f"),
    },
    plans: {
      basic: {
        tagline: "Ideal para organizar o balcão, o caixa e as encomendas do café da manhã.",
        features: [
          "PDV Ágil para balcão de pães e doces",
          "Cardápio Digital com foto dos produtos",
          "Controle de Caixa Diário",
          "Encomendas com data e hora de retirada",
          "Impressão de etiquetas de produção",
        ],
      },
      pro: {
        tagline: "Para padarias que querem crescer com delivery e assinaturas de pão.",
        features: [
          "Tudo do Basic, mais:",
          "Pedido recorrente (assinatura semanal de pão)",
          "Controle de custo de insumos (farinha, ovos, fermento)",
          "Programa de fidelidade e cashback",
          "WhatsApp IA para pedidos matinais",
        ],
      },
      enterprise: {
        tagline: "Para redes de padarias e franquias com produção centralizada.",
        features: [
          "Tudo do Pro, mais:",
          "Produção centralizada com distribuição",
          "Dashboards consolidados multi-unidade",
          "Integração com iFood",
          "Suporte VIP",
        ],
      },
    },
  },

  // ─── Doceria & Confeitaria Fina ──────────────────────────────────────────────
  doceria: {
    badge:         "🍰 Docerias & Confeitarias Finas",
    heroHighlight: "Brigadeiros e bolos entregues no prazo. Encomendas sem confusão.",
    screenshots: {
      basic:      us("1552539-1600871234"),
      pro:        us("1504674900247-0877df9cc836"),
      enterprise: us("1551288049-bebda4e38f71"),
    },
    plans: {
      basic: {
        tagline: "Perfeito para organizar encomendas, datas de entrega e controle de caixa.",
        features: [
          "Catálogo de produtos com fotos e preços",
          "Cardápio Digital para encomendas online",
          "Controle de Caixa Diário",
          "Agenda de encomendas com data e status",
          "Impressão de etiquetas e recibos",
        ],
      },
      pro: {
        tagline: "Para docerias que querem escalar o volume de encomendas e fidelizar clientes.",
        features: [
          "Tudo do Basic, mais:",
          "Programa de fidelidade (10º bolo grátis)",
          "Controle de custo de ingredientes (CMV)",
          "Cupons para datas especiais",
          "WhatsApp IA para receber encomendas 24h",
        ],
      },
      enterprise: {
        tagline: "Para marcas de doces com produção em escala e múltiplos canais de venda.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais de venda",
          "Integração com iFood e Rappi",
          "Dashboards consolidados",
          "Suporte VIP",
        ],
      },
    },
  },

  // ─── Conveniência & Minimercado ──────────────────────────────────────────────
  conveniencia: {
    badge:         "🏪 Conveniências & Minimercados",
    heroHighlight: "Caixa rápido, estoque organizado e troco sem erro.",
    screenshots: {
      basic:      us("1619740455993-9e612b1af08a"),
      pro:        us("1556742049-0cfed4f6a45d"),
      enterprise: us("1460925895917-afdab827c52f"),
    },
    plans: {
      basic: {
        tagline: "Ideal para lojas de conveniência que precisam de caixa rápido e controle de estoque.",
        features: [
          "PDV com leitor de código de barras USB",
          "Controle de Estoque automático",
          "Controle de Caixa Diário",
          "Cardápio Digital / lista de produtos",
          "Relatório de produtos mais vendidos",
        ],
      },
      pro: {
        tagline: "Para conveniências que querem expandir o delivery e reduzir perdas.",
        features: [
          "Tudo do Basic, mais:",
          "Delivery por bairro com taxa configurável",
          "Controle de validade e alertas de estoque mínimo",
          "Programa de fidelidade",
          "WhatsApp IA para pedidos",
        ],
      },
      enterprise: {
        tagline: "Para redes de conveniências com múltiplas unidades.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais de caixa",
          "Dashboards consolidados",
          "Integração com fornecedores",
          "Suporte VIP",
        ],
      },
    },
  },

  // ─── Mercado & Mercearia ──────────────────────────────────────────────────────
  mercado: {
    badge:         "🛒 Mercados & Mercearias",
    heroHighlight: "Checkout ágil, estoque correto e relatórios de giro de produto.",
    screenshots: {
      basic:      us("1619740455993-9e612b1af08a"),
      pro:        us("1551836022-d5d88e9218df"),
      enterprise: us("1460925895917-afdab827c52f"),
    },
    plans: {
      basic: {
        tagline: "Perfeito para mercearias que precisam de caixa rápido com leitor de código de barras.",
        features: [
          "PDV com leitura de EAN/código de barras",
          "Controle de Estoque por entrada manual ou NFe",
          "Controle de Caixa Diário",
          "Precificação por kg ou unidade",
          "Relatório de vendas diário",
        ],
      },
      pro: {
        tagline: "Para mercados que querem crescer no delivery local e reduzir perdas.",
        features: [
          "Tudo do Basic, mais:",
          "Catálogo digital com foto e preço online",
          "Delivery por bairro com rastreamento",
          "Alertas de estoque mínimo por produto",
          "WhatsApp IA para pedidos e lista de compras",
        ],
      },
      enterprise: {
        tagline: "Para redes de mercados com alto giro e múltiplos pontos de venda.",
        features: [
          "Tudo do Pro, mais:",
          "Múltiplos terminais de caixa simultâneos",
          "Controle de precificação centralizado",
          "Dashboards consolidados multi-unidade",
          "Suporte VIP",
        ],
      },
    },
  },
};
