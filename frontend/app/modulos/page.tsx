"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Check, ChevronRight, Sparkles, Shield, CreditCard, Zap, Building2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/services/api";

import { HeroModules } from "@/components/modulos/HeroModules";
import { ModuleGrid, CatKey } from "@/components/modulos/ModuleGrid";
import { BillingPeriod } from "@/components/modulos/PricingSelector";
import { AnalyticsOrb } from "@/components/modulos/AnalyticsOrb";
import type { Mod } from "@/components/modulos/ModuleCard";

// ─── Static catalog ───────────────────────────────────────────────────────────
// CompanyModule from /company/:id has no catalog fields (name, description, etc.)
// This map provides them so cards render correctly regardless of backend join.
const MODULE_CATALOG: Record<string, Partial<Mod>> = {

  // ── Módulos default (criados no signup — slugs em MAIÚSCULO) ─────────────────

  "TABLES": {
    name: "Mesas", icon: "🪑", category: "OPERACAO",
    price: null, isFree: true, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 1,
    description: "Abra mesas, anote pedidos via QR Code e feche a conta sem papel e sem erro de digitação.",
    benefits: [
      "Abertura e fechamento de mesa com um toque",
      "Pedidos por QR Code diretamente na cozinha",
      "Divisão de conta por item ou por pessoa",
      "Histórico completo de consumo por mesa",
    ],
    longDescription:
      "Com o módulo de Mesas, cada mesa tem seu QR Code exclusivo. O cliente lê, o garçom anota ou o próprio cliente pede — tudo vai direto para a cozinha em tempo real. Sem papel, sem correria e sem erro de comanda. No fechamento, a divisão de conta é feita por item ou por pessoa em segundos.",
  },

  "CASH": {
    name: "Caixa", icon: "💰", category: "FINANCEIRO",
    price: null, isFree: true, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 2,
    description: "Caixa completo: abra, feche, registre sangrias e veja o saldo a qualquer momento do dia.",
    benefits: [
      "Abertura e fechamento com valor inicial",
      "Sangria e suprimento com justificativa",
      "Relatório de fechamento com divergências",
      "Histórico de movimentos por turno",
    ],
    longDescription:
      "Nunca mais perca o controle do caixa. Abra o turno com o valor inicial, registre qualquer retirada ou reforço com justificativa, e feche com um relatório automático que mostra exatamente se o caixa bateu ou se há divergência. Ideal para quem tem múltiplos turnos e precisa de rastreabilidade total.",
  },

  "FINANCIAL": {
    name: "Financeiro", icon: "📊", category: "FINANCEIRO",
    price: null, isFree: true, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 3,
    description: "Veja todas as entradas e saídas num extrato organizado. Saiba exatamente onde o dinheiro está indo.",
    benefits: [
      "Extrato por período com filtros de categoria",
      "Lançamento de receitas e despesas manuais",
      "Resumo de faturamento por forma de pagamento",
      "Exportação de dados para planilha",
    ],
    longDescription:
      "O módulo Financeiro centraliza tudo: vendas registradas automaticamente pelos pedidos, despesas lançadas manualmente e um resumo claro por período. Filtre por categoria, veja o total por forma de pagamento e exporte tudo para Excel em um clique. Para quem quer sair do caderno e ter controle real.",
  },

  "STOCK": {
    name: "Estoque", icon: "📦", category: "OPERACAO",
    price: null, isFree: true, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 4,
    description: "Controle cada ingrediente em tempo real. Receba alertas antes de faltar e nunca mais venda o que não tem.",
    benefits: [
      "Movimentações de entrada, saída, perda e ajuste",
      "Alerta automático de estoque mínimo",
      "Custo médio ponderado atualizado por compra",
      "Histórico completo com rastreabilidade por pedido",
      "Estoque consumido automaticamente ao confirmar pedido",
    ],
    longDescription:
      "Cada ingrediente tem seu saldo atualizado em tempo real. Quando um pedido é confirmado, o sistema desconta os ingredientes das receitas automaticamente. Comprou mais? O custo médio é recalculado. Perdeu produto? Registre o motivo e mantenha o histórico. Você sabe o que tem, o que custa e o que está acabando — antes de virar problema.",
  },

  "RECIPES": {
    name: "Receitas", icon: "📋", category: "OPERACAO",
    price: null, isFree: true, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 5,
    description: "Monte a receita de cada produto e calcule o CMV real a cada pedido, automaticamente.",
    benefits: [
      "Fichas técnicas com ingredientes e quantidades",
      "CMV calculado automaticamente em cada venda",
      "Custo por porção atualizado com o custo médio",
      "Integração direta com estoque e pedidos",
    ],
    longDescription:
      "Defina uma vez a receita de cada produto — os ingredientes e as quantidades — e o sistema faz o resto. A cada pedido confirmado, o estoque é consumido e o CMV é calculado com o custo médio atual de cada ingrediente. Você vê no relatório o quanto cada item realmente custa e qual é a margem real. Sem planilha, sem chute.",
  },

  "DELIVERY": {
    name: "Delivery", icon: "🛵", category: "OPERACAO",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 6,
    description: "Cadastre entregadores, defina taxas por bairro ou km e receba pedidos de entrega com tudo automatizado.",
    benefits: [
      "Cadastro completo de entregadores",
      "Taxa de entrega por bairro ou distância (km)",
      "Split automático: parte para o cliente, parte para o entregador",
      "Acompanhamento de status em tempo real",
      "Relatório financeiro separado por entregador",
    ],
    longDescription:
      "O módulo de Delivery organiza toda a operação de entregas: cadastre seus motoboys, configure taxas por bairro ou por quilômetro rodado, e defina quanto fica com o restaurante e quanto vai para o entregador. Cada pedido de delivery chega com o cálculo já feito. Acompanhe o status em tempo real e feche o acerto com o entregador no fim do dia sem planilha.",
  },

  // ── Módulos nomeados (slugs lowercase do catálogo) ───────────────────────────

  "delivery": {
    name: "Delivery", icon: "🛵", category: "OPERACAO",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 6,
    description: "Cadastre entregadores, defina taxas por bairro ou km e receba pedidos de entrega com tudo automatizado.",
    benefits: [
      "Cadastro completo de entregadores",
      "Taxa de entrega por bairro ou distância (km)",
      "Split automático: parte para o cliente, parte para o entregador",
      "Acompanhamento de status em tempo real",
      "Relatório financeiro separado por entregador",
    ],
    longDescription:
      "O módulo de Delivery organiza toda a operação de entregas: cadastre seus motoboys, configure taxas por bairro ou por quilômetro rodado, e defina quanto fica com o restaurante e quanto vai para o entregador. Cada pedido de delivery chega com o cálculo já feito. Acompanhe o status em tempo real e feche o acerto com o entregador no fim do dia sem planilha.",
  },

  "cardapio-ia": {
    name: "Cardápio IA", icon: "🤖", category: "AUTOMACAO",
    price: 49, isFree: false, badge: "Popular", badgeColor: "blue",
    isHighlighted: true, sortOrder: 7,
    description: "Atendimento inteligente no cardápio digital com sugestões em tempo real.",
    benefits: [
      "Chat IA integrado ao cardápio digital",
      "Sugestões personalizadas por perfil do cliente",
      "Atendimento automático 24 horas",
    ],
    longDescription:
      "O Cardápio IA adiciona um assistente inteligente ao seu cardápio digital. O cliente tira dúvidas, recebe sugestões baseadas no que já pediu antes e é guiado até finalizar o pedido — sem precisar de atendente. Funciona 24 horas, não erra e aumenta o ticket médio com recomendações certeiras.",
  },

  "whatsapp-ia": {
    name: "WhatsApp IA", icon: "💬", category: "AUTOMACAO",
    price: 79, isFree: false, badge: "Novo", badgeColor: "purple",
    isHighlighted: true, sortOrder: 8,
    description: "Atenda clientes, receba pedidos e confirme entregas automaticamente pelo WhatsApp com IA.",
    benefits: [
      "Atendimento automático 24 horas por dia",
      "Recebe mensagens de texto e áudio",
      "Pedidos criados diretamente no ERP via chat",
      "Transferência para atendente humano quando necessário",
      "Notificações automáticas de status do pedido",
    ],
    longDescription:
      "A Carol — IA do FoodSaaS — atende seus clientes pelo WhatsApp como se fosse uma atendente real. Ela responde perguntas sobre o cardápio, monta pedidos, confirma endereços e notifica o cliente em cada etapa da entrega. Entende texto e áudio, não erra pedido e nunca está de folga. Quando o cliente precisa de um humano, ela transfere em segundos.",
  },

  "fidelidade": {
    name: "Fidelidade", icon: "⭐", category: "MARKETING",
    price: 19, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 9,
    description: "Programa de pontos e cashback que faz o cliente sempre querer voltar.",
    benefits: [
      "Pontos por compra com regra configurável",
      "Cashback automático creditado ao cliente",
      "Cupons de recompensa por pontos acumulados",
    ],
    longDescription:
      "Configure o programa de fidelidade do seu jeito: defina quantos pontos valem R$1, quando o cashback é liberado e quais recompensas o cliente pode resgatar. Tudo acontece automaticamente a cada pedido pago. O cliente vê o saldo no cardápio digital e tem um motivo real para voltar.",
  },

  "cupons": {
    name: "Cupons", icon: "🎁", category: "MARKETING",
    price: 9, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 10,
    description: "Crie cupons de desconto por percentual, valor fixo ou frete grátis e dispare para clientes.",
    benefits: [
      "Cupons de desconto por percentual ou valor fixo",
      "Cupom de frete grátis",
      "Limite de uso por cupom e por cliente",
    ],
    longDescription:
      "Crie cupons em segundos, defina o tipo de desconto, a validade e o limite de usos. Distribua pelo WhatsApp, Instagram ou no fechamento do cardápio digital. Ideal para datas comemorativas, lançamentos de produto ou recuperação de clientes que abandonaram o carrinho.",
  },

  "meta-pixel": {
    name: "Meta Pixel", icon: "📱", category: "MARKETING",
    price: 9, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 11,
    description: "Rastreie conversões do cardápio digital e crie campanhas de remarketing no Facebook e Instagram.",
    benefits: [
      "Pixel do Facebook integrado ao cardápio",
      "Rastreamento de visualização e conversão por produto",
      "Audiências personalizadas para remarketing",
    ],
    longDescription:
      "Instale o Meta Pixel no seu cardápio digital em um clique. A partir daí, cada visita, clique em produto e pedido finalizado é rastreado automaticamente. Use esses dados no Gerenciador de Anúncios para criar campanhas de remarketing para quem visitou mas não comprou — e campanhas lookalike para encontrar novos clientes parecidos com os seus melhores compradores.",
  },

  "google-analytics": {
    name: "Google Analytics", icon: "📈", category: "MARKETING",
    price: 9, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 12,
    description: "Métricas completas do cardápio digital: de onde vêm os visitantes, o que veem e o que compram.",
    benefits: [
      "GA4 integrado ao cardápio digital",
      "Origem do tráfego por canal (WhatsApp, Instagram, direto)",
      "Taxa de conversão por produto e por categoria",
    ],
    longDescription:
      "Com o Google Analytics integrado, você enxerga tudo que acontece no cardápio: quantas pessoas visitaram, de onde vieram, quais produtos mais chamaram atenção e quantas finalizaram o pedido. Use esses dados para decidir onde investir em marketing e quais produtos precisam de foto melhor ou descrição mais atraente.",
  },

  "nfce": {
    name: "NFC-e", icon: "🧾", category: "FINANCEIRO",
    price: 59, isFree: false, badge: "Em breve", badgeColor: "orange",
    isHighlighted: false, sortOrder: 13,
    description: "Emissão automática de nota fiscal eletrônica integrada a cada pedido confirmado.",
    benefits: [
      "Emissão de NFC-e integrada ao pedido",
      "Envio automático ao SEFAZ",
      "Impressão ou envio por e-mail ao cliente",
    ],
    longDescription:
      "Nunca mais tenha problemas fiscais. Configure seu certificado digital uma vez e pronto — a NFC-e é emitida automaticamente a cada pedido confirmado, enviada ao SEFAZ e disponível para impressão ou envio por e-mail. Em caso de contingência (sem internet), o sistema emite offline e transmite quando a conexão voltar.",
  },

  "fluxo-caixa": {
    name: "Fluxo de Caixa", icon: "💸", category: "FINANCEIRO",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 14,
    description: "Projeção de entradas e saídas futuras para você nunca ser pego de surpresa.",
    benefits: [
      "Projeção de caixa para os próximos 30 dias",
      "Análise de tendências de receita e despesa",
      "Exportação para Excel",
    ],
    longDescription:
      "O Fluxo de Caixa projeta seus próximos 30 dias com base no histórico de receitas e despesas. Veja antecipadamente se vai ter aperto no caixa, quando as contas fixas chegam e qual a tendência do mês. Tome decisões antes que o problema apareça, não depois.",
  },

  "dashboard-financeiro": {
    name: "Dashboard Financeiro", icon: "📉", category: "FINANCEIRO",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 15,
    description: "Painel visual em tempo real: faturamento, ticket médio, margem e tendências do mês.",
    benefits: [
      "KPIs principais em um único painel",
      "Gráfico de faturamento diário e tendência do mês",
      "Ticket médio e comparativo com período anterior",
      "Margem bruta por produto e por categoria",
    ],
    longDescription:
      "O Dashboard Financeiro é a primeira coisa que você abre de manhã. Em uma única tela: quanto você faturou ontem, qual é o ticket médio da semana, como está a tendência do mês comparado ao anterior e onde está sua melhor margem. Tudo em gráficos claros, atualizados em tempo real a cada pedido confirmado.",
  },

  "dre": {
    name: "DRE", icon: "📑", category: "FINANCEIRO",
    price: 39, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 16,
    description: "Demonstrativo de resultado gerado automaticamente. Saiba exatamente seu lucro real.",
    benefits: [
      "DRE mensal gerado automaticamente",
      "CMV integrado às fichas técnicas",
      "Exportação para Excel",
    ],
    longDescription:
      "O DRE é gerado automaticamente todo mês com base nos seus pedidos, custos e despesas. Sem precisar preencher planilha: receita bruta, CMV, lucro bruto, despesas operacionais e resultado líquido aparecem organizados do jeito que o contador quer ver. Exporte em Excel quando precisar.",
  },

  "pix-automatico": {
    name: "Pix Automático", icon: "⚡", category: "FINANCEIRO",
    price: 19, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 17,
    description: "QR Code Pix gerado automaticamente por pedido, com confirmação instantânea no sistema.",
    benefits: [
      "QR Code Pix dinâmico por pedido",
      "Confirmação automática ao receber",
      "Sem taxa por transação",
    ],
    longDescription:
      "Cada pedido gera seu próprio QR Code Pix com o valor exato. Quando o cliente paga, o sistema confirma em segundos e o pedido avança automaticamente para preparação. Sem copiar chave, sem conferir na mão, sem erro. Funciona com qualquer banco e não tem taxa por transação.",
  },

  "relatorios-avancados": {
    name: "Relatórios Avançados", icon: "🔬", category: "FINANCEIRO",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 18,
    description: "Relatórios detalhados de vendas, produtos mais lucrativos, horário de pico e exportação PDF/Excel.",
    benefits: [
      "Ranking de produtos por lucro e volume de vendas",
      "Análise de horário de pico e dia mais movimentado",
      "Relatórios exportáveis em PDF e Excel",
      "Agendamento automático de envio por e-mail",
    ],
    longDescription:
      "Os Relatórios Avançados vão além do resumo básico. Veja quais produtos vendem mais, quais têm maior margem, em qual horário o movimento é maior e em qual dia da semana você fatura mais. Exporte qualquer relatório em PDF ou Excel, ou configure para receber por e-mail toda segunda-feira de manhã antes de abrir o restaurante.",
  },

  "crm-whatsapp": {
    name: "CRM WhatsApp", icon: "📞", category: "MARKETING",
    price: 49, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 19,
    description: "Histórico completo de cada cliente, segmentação por perfil e campanhas em massa pelo WhatsApp.",
    benefits: [
      "Histórico de pedidos e conversas por cliente",
      "Segmentação por ticket médio, frequência e bairro",
      "Campanhas em massa com personalização por segmento",
      "Relatório de abertura e conversão por campanha",
    ],
    longDescription:
      "O CRM WhatsApp é para quando você quer controle manual sobre a comunicação. Veja quem são seus melhores clientes, filtre por bairro, ticket médio ou última visita, e dispare uma mensagem personalizada para cada segmento via WhatsApp. Com histórico de tudo que cada cliente já pediu e conversou — nada se perde.",
  },

  "recuperacao-clientes": {
    name: "Recuperação de Clientes", icon: "🔔", category: "MARKETING",
    price: 29, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 20,
    description: "Reengaje clientes inativos automaticamente com ofertas personalizadas no momento certo.",
    benefits: [
      "Identificação automática de clientes inativos",
      "Ofertas personalizadas por tempo de ausência",
      "Aumento do LTV sem esforço manual",
    ],
    longDescription:
      "O sistema identifica automaticamente clientes que não pedem há X dias (você define) e dispara uma oferta no momento mais provável de retorno. Sem lista manual, sem copiar número. O resultado aparece no relatório: quantos voltaram, quanto faturaram e qual campanha teve melhor retorno.",
  },

  "automacao-marketing": {
    name: "Automação de Marketing", icon: "🚀", category: "MARKETING",
    price: 39, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 21,
    description: "Dispare campanhas automáticas para clientes no momento certo: aniversário, inatividade, volume de compra.",
    benefits: [
      "Campanhas automáticas por gatilho de comportamento",
      "Mensagem de aniversário com cupom personalizado",
      "Reengajamento de clientes sem pedido há X dias",
      "Disparo via WhatsApp e notificação push",
    ],
    longDescription:
      "Defina as regras uma vez e o sistema trabalha sozinho: no aniversário do cliente vai um cupom especial, após 15 dias sem pedido vai uma oferta de retorno, ao atingir 5 compras vai um brinde surpresa. Você configura os gatilhos, o sistema dispara no momento exato. Marketing que funciona enquanto você dorme.",
  },

  "multi-loja": {
    name: "Multi-loja", icon: "🏪", category: "OPERACAO",
    price: 99, isFree: false, badge: "Enterprise", badgeColor: "purple",
    isHighlighted: true, sortOrder: 22,
    description: "Gerencie múltiplas unidades em um único painel com relatórios consolidados.",
    benefits: [
      "Painel unificado para todas as unidades",
      "Relatórios consolidados e por unidade",
      "Controle de estoque e cardápio por loja",
    ],
    longDescription:
      "Com o módulo Multi-loja, você gerencia todas as unidades do mesmo painel sem precisar trocar de login. Compare o desempenho entre lojas, consolide o faturamento total e ainda acesse relatórios individuais por unidade. Cardápio, estoque e equipe são gerenciados de forma independente em cada filial.",
  },

  "ifood": {
    name: "iFood", icon: "🍔", category: "AUTOMACAO",
    price: 49, isFree: false, badge: "Em breve", badgeColor: "orange",
    isHighlighted: false, sortOrder: 23,
    description: "Receba pedidos do iFood diretamente no sistema. Zero redigitação, zero erro.",
    benefits: [
      "Pedidos do iFood direto no painel",
      "Cardápio sincronizado automaticamente",
      "Status do pedido atualizado em tempo real",
    ],
    longDescription:
      "Com a integração iFood, os pedidos que chegam no marketplace aparecem automaticamente no seu painel — sem precisar redigitar nada, sem risco de erro. O cardápio é sincronizado automaticamente: mudou o preço aqui, muda lá também. E o status de cada pedido (confirmado, em preparo, saiu para entrega) é atualizado em tempo real nos dois sistemas.",
  },

  "99food": {
    name: "99food", icon: "🛺", category: "AUTOMACAO",
    price: 49, isFree: false, badge: "Em breve", badgeColor: "orange",
    isHighlighted: false, sortOrder: 24,
    description: "Integração completa com o marketplace 99food para receber mais pedidos sem retrabalho.",
    benefits: [
      "Pedidos do 99food direto no painel",
      "Cardápio sincronizado automaticamente",
      "Relatórios unificados com outros canais",
    ],
    longDescription:
      "A integração com o 99food traz os pedidos do marketplace direto para o seu painel, sem precisar abrir outro sistema. Cardápio sincronizado, status atualizado e relatório unificado com todos os outros canais de venda. Um painel, todos os pedidos.",
  },

  "webhooks": {
    name: "Webhooks", icon: "🔗", category: "AUTOMACAO",
    price: 19, isFree: false, badge: null, badgeColor: null,
    isHighlighted: false, sortOrder: 25,
    description: "Conecte o FoodSaaS a qualquer sistema externo via webhooks em tempo real.",
    benefits: [
      "POST automático em URL configurada a cada evento",
      "Eventos de pedido, pagamento e status",
      "Payload JSON estruturado e documentado",
    ],
    longDescription:
      "Com os Webhooks, qualquer evento do sistema (novo pedido, pagamento confirmado, status alterado) dispara um POST para a URL que você configurar. Use para integrar com ERPs, sistemas de delivery próprio, PDVs externos ou qualquer ferramenta que aceite webhooks. Payload JSON limpo e documentado.",
  },

  // ── Módulo novo — Cadastro Inteligente ───────────────────────────────────────

  "smart-import": {
    name: "Cadastro Inteligente", icon: "🧠", category: "AUTOMACAO",
    price: 49, isFree: false, badge: "Exclusivo", badgeColor: "blue",
    isHighlighted: true, sortOrder: 26,
    description: "Importe cardápios inteiros a partir de uma foto, PDF ou XML de nota fiscal. A IA preenche tudo.",
    benefits: [
      "Importação de cardápio por foto ou imagem",
      "Leitura automática de XML de nota fiscal",
      "Ingredientes e custos preenchidos pela IA",
      "Revisão antes de salvar — você aprova cada item",
      "Economize horas de cadastro manual",
    ],
    longDescription:
      "Acabou a era do cadastro manual produto por produto. Tire uma foto do cardápio do fornecedor, envie um PDF do menu ou faça upload do XML da nota fiscal — a IA extrai nome, descrição, categoria e custo de cada item automaticamente. Você revisa, ajusta o que quiser e confirma. Em minutos, dezenas de produtos cadastrados com precisão.",
  },
};

const MATRIX_COMPANY_ID = process.env.NEXT_PUBLIC_MATRIX_COMPANY_ID ?? "cmq7d3dxs0006gw5pabsljy87";

type CompanyOption = { id: string; name: string; plan: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulosPage() {
  const [modules, setModules]       = useState<Mod[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState<CatKey>("Todos");
  const [billing, setBilling]       = useState<BillingPeriod>("annual");
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const companyId                   = useRef("");
  const userRole                    = useRef("");
  const isMatrix                    = useRef(false);

  // Provisionamento cross-tenant (só matriz/SUPER_ADMIN)
  const [provisionSlug, setProvisionSlug]         = useState<string | null>(null);
  const [companies, setCompanies]                 = useState<CompanyOption[]>([]);
  const [provisionTarget, setProvisionTarget]     = useState("");
  const [provisionBusy, setProvisionBusy]         = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      companyId.current = u.companyId || "";
      userRole.current  = u.role || "";
      isMatrix.current  = u.companyId === MATRIX_COMPANY_ID;
      if (u.companyId) load(u.companyId);
      // Pré-carrega lista de empresas para matriz/SUPER_ADMIN
      if (u.companyId === MATRIX_COMPANY_ID || u.role === "SUPER_ADMIN") {
        api.get("/company-module/admin/companies")
          .then(r => setCompanies(Array.isArray(r.data) ? r.data : []))
          .catch(() => {});
      }
    } catch { setLoading(false); }
  }, []);

  async function load(cid: string) {
    setLoading(true);
    try {
      const { data } = await api.get(`/company-module/company/${cid}`);
      const mods: any[] = Array.isArray(data) ? data : [];
      setModules(mods.map((m: any): Mod => {
        const slug = (m.slug || m.moduleSlug || "") as string;
        const cat  = MODULE_CATALOG[slug] ?? {};
        return {
          // Catalog defaults (display fields not stored in DB)
          name:           m.name           || cat.name           || "",
          description:    m.description    || cat.description    || "",
          longDescription: cat.longDescription,
          icon:           m.icon           || cat.icon           || "📦",
          category:       m.category       || cat.category       || "OPERACAO",
          // Price: DB is source of truth; frontend catalog as fallback
          price:          m.price != null  ? Number(m.price)     : (cat.price ?? null),
          isFree:         m.isFree         ?? cat.isFree         ?? false,
          badge:          m.badge          ?? cat.badge          ?? null,
          badgeColor:     m.badgeColor     ?? cat.badgeColor     ?? null,
          benefits:       (m.benefits?.length ? m.benefits : null) ?? cat.benefits ?? [],
          isHighlighted:  m.isHighlighted  ?? cat.isHighlighted  ?? false,
          sortOrder:      m.sortOrder      ?? cat.sortOrder      ?? 99,
          // Association fields
          id:             m.id             ?? slug,
          slug,
          companyModuleId: m.companyModuleId ?? null,
          status:         (m.status        ?? (m.active ? "ACTIVE" : "INACTIVE")) as Mod["status"],
          trialEndsAt:    m.trialEndsAt    ?? null,
          activatedAt:    m.activatedAt    ?? null,
        };
      }));
    } catch { toast.error("Erro ao carregar módulos"); }
    finally  { setLoading(false); }
  }

  function withBusy(slug: string, fn: () => Promise<void>) {
    return async () => {
      setBusy(p => ({ ...p, [slug]: true }));
      try { await fn(); } finally { setBusy(p => ({ ...p, [slug]: false })); }
    };
  }

  async function handleTrial(slug: string) {
    try {
      await api.post("/company-module/trial", { companyId: companyId.current, moduleSlug: slug });
      toast.success("🎉 Teste grátis de 5 dias ativado!");
      load(companyId.current);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Você já utilizou o teste grátis para este módulo.");
    }
  }

  async function handleActivate(slug: string) {
    try {
      await api.post("/company-module/activate", { companyId: companyId.current, moduleSlug: slug });
      toast.success("✅ Módulo ativado com sucesso!");
      load(companyId.current);
      // Matriz/SUPER_ADMIN: oferece provisionamento para outra empresa
      if (isMatrix.current || userRole.current === "SUPER_ADMIN") {
        setProvisionSlug(slug);
        setProvisionTarget("");
      }
    } catch { toast.error("Erro ao ativar módulo"); }
  }

  async function handleProvision() {
    if (!provisionSlug || !provisionTarget) return;
    setProvisionBusy(true);
    try {
      await api.post("/company-module/admin/activate", {
        targetCompanyId: provisionTarget,
        moduleSlug: provisionSlug,
      });
      const company = companies.find(c => c.id === provisionTarget);
      toast.success(`✅ Módulo ativado para ${company?.name ?? provisionTarget}`);
      setProvisionSlug(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erro ao provisionar módulo");
    } finally {
      setProvisionBusy(false);
    }
  }

  async function handleDeactivate(slug: string) {
    try {
      await api.delete(`/company-module/${companyId.current}/${slug}`);
      toast.success("Módulo desativado.");
      load(companyId.current);
    } catch { toast.error("Erro ao desativar módulo"); }
  }

  const active    = modules.filter(m => m.status === "ACTIVE" || m.status === "TRIAL");
  const installed = active.length;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #f8f9fc 0%, #f3f4f6 100%)" }}
      onClick={() => setOpenMenu(null)}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <HeroModules
        totalModules={modules.length}
        activeModules={installed}
        billing={billing}
        onBillingChange={setBilling}
      />

      {/* ── Installed bar ────────────────────────────────────────────────────── */}
      {installed > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 -mt-6 relative z-10 bg-white rounded-2xl border border-gray-100 shadow-xl px-6 py-4 flex items-center gap-4 flex-wrap"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-black text-gray-900 text-sm">{installed} módulo{installed !== 1 ? "s" : ""} ativo{installed !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {active.slice(0, 6).map(m => (
              <div
                key={m.slug}
                title={m.name}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-600"
              >
                <span>{m.icon}</span> {m.name}
              </div>
            ))}
            {active.length > 6 && (
              <span className="text-xs text-gray-400 font-semibold">+{active.length - 6} mais</span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-medium ml-auto hidden md:block">Todos funcionando normalmente ✓</span>
        </motion.div>
      )}

      {/* ── Module grid ──────────────────────────────────────────────────────── */}
      <ModuleGrid
        modules={modules}
        billing={billing}
        search={search}
        onSearchChange={setSearch}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        loading={loading}
        busy={busy}
        openMenu={openMenu}
        onToggleMenu={(slug, e) => { e.stopPropagation(); setOpenMenu(p => p === slug ? null : slug); }}
        onTrial={s => withBusy(s, () => handleTrial(s))()}
        onActivate={s => withBusy(s, () => handleActivate(s))()}
        onDeactivate={s => withBusy(s, () => handleDeactivate(s))()}
      />

      {/* ── Payment & Trust section ───────────────────────────────────────────── */}
      <div className="px-6 pb-16 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Payment options */}
          <div
            className="lg:col-span-2 rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #071530 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-15 pointer-events-none"
              style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-black uppercase tracking-widest">Pagamento & Fidelização</span>
              </div>
              <h3 className="text-white text-xl font-black mb-1">Escolha como pagar</h3>
              <p className="text-white/50 text-sm mb-6">Economize mais com pagamento antecipado e Pix</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: "⚡", title: "Pix com desconto",
                    desc: "Pague via Pix e ganhe 5% adicional de desconto no total.",
                    tag: "-5% extra", tagColor: "text-emerald-400 bg-emerald-400/15",
                  },
                  {
                    icon: "🔄", title: "Cartão recorrente",
                    desc: "Débito automático mensal. Zero preocupação, renovação garantida.",
                    tag: "Auto-renovável", tagColor: "text-blue-400 bg-blue-400/15",
                  },
                  {
                    icon: "📅", title: "Pagamento antecipado",
                    desc: "Pague o ano todo de uma vez e economize até 35% com Pix.",
                    tag: "Máx. economia", tagColor: "text-amber-400 bg-amber-400/15",
                  },
                  {
                    icon: "🎁", title: "Fidelização",
                    desc: "Clientes com plano anual têm acesso prioritário a novos módulos.",
                    tag: "Exclusivo", tagColor: "text-violet-400 bg-violet-400/15",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm">{item.title}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.tagColor}`}>{item.tag}</span>
                      </div>
                      <p className="text-white/45 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-white/10">
                <CreditCard size={14} className="text-white/40" />
                <span className="text-white/40 text-xs">Aceitamos: Pix · Cartão de crédito · Débito · Boleto · Transferência</span>
              </div>
            </div>
          </div>

          {/* Trust & CTA panel */}
          <div className="flex flex-col gap-4">

            {/* Savings CTA */}
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-3xl p-6 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{ boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}>
                <Sparkles size={20} className="text-white" />
              </div>
              <h4 className="font-black text-gray-900 text-base mb-1">Plano Enterprise</h4>
              <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                Módulos ilimitados + suporte dedicado + onboarding + SLA garantido.
              </p>
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  boxShadow: "0 6px 18px rgba(79,70,229,0.3)",
                }}>
                Falar com vendas <ChevronRight size={13} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">Garantias</p>
              <div className="space-y-3">
                {[
                  { icon: <Shield size={13} className="text-emerald-500" />, text: "Dados protegidos com criptografia AES-256" },
                  { icon: <TrendingUp size={13} className="text-blue-500" />, text: "99.9% de uptime garantido por SLA" },
                  { icon: <Check size={13} className="text-amber-500" />, text: "Cancele quando quiser, sem multa" },
                  { icon: <Zap size={13} className="text-violet-500" />, text: "Suporte técnico incluído em todos os planos" },
                ].map((g, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                      {g.icon}
                    </div>
                    <span className="text-xs text-gray-500 font-medium leading-tight">{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal provisionamento cross-tenant (Matriz / SUPER_ADMIN) ─────────── */}
      {provisionSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 relative"
          >
            <button
              onClick={() => setProvisionSlug(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center">
                <Building2 size={20} className="text-violet-600" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-base">Provisionar Módulo</p>
                <p className="text-xs text-gray-400">Módulo <span className="font-semibold text-violet-600">{provisionSlug}</span> foi ativado para a Matriz</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-4 mb-4">
              <strong>Além da loja Matriz (R_FoodSaaS)</strong>, este módulo deve ser ativado em qual outro estabelecimento?
            </p>

            {companies.length > 0 ? (
              <select
                value={provisionTarget}
                onChange={e => setProvisionTarget(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400 mb-4"
              >
                <option value="">— Selecionar empresa —</option>
                {companies
                  .filter(c => c.id !== companyId.current)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.plan || "sem plano"})
                    </option>
                  ))}
              </select>
            ) : (
              <p className="text-xs text-gray-400 mb-4">Nenhuma outra empresa cadastrada.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setProvisionSlug(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Pular
              </button>
              <button
                disabled={!provisionTarget || provisionBusy}
                onClick={handleProvision}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
              >
                {provisionBusy ? "Ativando…" : "Ativar para esta empresa"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
