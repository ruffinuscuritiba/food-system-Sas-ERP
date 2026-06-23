"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search, ToggleLeft, ToggleRight, Loader2, AlertCircle,
  RefreshCw, ChevronRight, ArrowLeft,
} from "lucide-react"
import { saApi } from "@/services/superAdminApi"
import { SuperAdminTopBar } from "@/components/super-admin/SuperAdminTopBar"

// ── Types ──────────────────────────────────────────────────────────────────────
interface Company {
  id: string
  name: string
  plan: string
  email?: string
}

interface CompanyModuleStatus {
  slug: string
  status: "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED"
  trialEndsAt?: string | null
}

// ── Catálogo completo de módulos ───────────────────────────────────────────────
export interface ModuleDef {
  slug:         string
  name:         string
  emoji:        string
  category:     "OPERACAO" | "ESTOQUE" | "FINANCEIRO" | "DELIVERY" | "MARKETING" | "AUTOMACAO"
  tagline:      string
  description:  string
  isConfigured: boolean          // false = módulo ainda não completo / requer setup extra
  setupNote?:   string           // aviso exibido quando isConfigured=false
  isFree:       boolean
  benefits:     string[]
  detail: {
    what:    string
    why:     string[]
  }
}

export const MODULE_CATALOG: ModuleDef[] = [
  // ── OPERAÇÃO ─────────────────────────────────────────────────────────────
  {
    slug: "pdv",
    name: "PDV — Ponto de Venda",
    emoji: "🛒",
    category: "OPERACAO",
    tagline: "Venda mais rápido no balcão",
    description: "Interface completa para atendimento presencial: produtos, tamanhos, pizzas, complementos, pagamento e impressão.",
    isConfigured: true,
    isFree: true,
    benefits: ["Interface otimizada para toque", "Leitor de código de barras", "Pizzas e complementos", "Impressão automática"],
    detail: {
      what: "O PDV é o coração do sistema. Permite registrar pedidos presenciais com agilidade: busca por nome ou código de barras, montagem de pizzas com bordas e sabores, complementos iFood-style, múltiplos tamanhos de produto e fechamento com PIX, dinheiro, cartão ou vale-refeição.",
      why: ["Atendimento 3x mais rápido do que em papel", "Zero erro de digitação com leitor de barras", "Controle de pedidos em tempo real na cozinha", "Impressão automática de comanda ao confirmar pedido"],
    },
  },
  {
    slug: "kitchen",
    name: "Cozinha Digital",
    emoji: "👨‍🍳",
    category: "OPERACAO",
    tagline: "Organize sua produção em tempo real",
    description: "Painel KDS para cozinha com pedidos em tempo real, status por etapa e impressão de comanda térmica 80mm.",
    isConfigured: true,
    isFree: true,
    benefits: ["Pedidos PDV + Cardápio unificados", "Status CONFIRMADO / PREPARANDO / PRONTO", "Badge [PDV] e [ONLINE] por origem", "Impressão 80mm multi-setor"],
    detail: {
      what: "A tela de cozinha exibe todos os pedidos — tanto do PDV quanto do Cardápio Digital — em tempo real via WebSocket. O cozinheiro avança o status com um clique e a impressão de comanda é disparada automaticamente, incluindo complementos e informações de entrega.",
      why: ["Elimina gritaria entre cozinha e balcão", "Histórico completo de cada pedido", "Complementos e observações sempre visíveis", "Sincroniza com o painel do entregador automaticamente"],
    },
  },
  {
    slug: "tables",
    name: "Mesas & Comandas",
    emoji: "🪑",
    category: "OPERACAO",
    tagline: "Controle o salão com precisão",
    description: "Gestão de mesas com comanda contínua: lance produtos, acompanhe consumo e feche a conta com múltiplas formas de pagamento.",
    isConfigured: true,
    isFree: false,
    benefits: ["Mapa de mesas livre/ocupada/reservada", "Comanda contínua por mesa", "Lançamento rápido de produtos", "Fechamento com divisão de conta"],
    detail: {
      what: "O módulo de Mesas permite abrir uma mesa, lançar produtos ao longo do atendimento ('Lançar'), e só fechar quando o cliente pedir a conta ('Lançar e Finalizar'). Cada item vai para a cozinha em tempo real, o total acumula automaticamente e o fechamento integra com o controle de caixa.",
      why: ["Fim dos papéis de comanda rasurados", "Total em tempo real para o garçom", "Integrado com o App do Garçom (PWA)", "Histórico de consumo por mesa e turno"],
    },
  },
  {
    slug: "cash",
    name: "Controle de Caixa",
    emoji: "💵",
    category: "OPERACAO",
    tagline: "Abertura e fechamento sem planilhas",
    description: "Registra abertura, entradas, saídas e fechamento de caixa. Integrado com pedidos e mesas.",
    isConfigured: true,
    isFree: true,
    benefits: ["Abertura com valor inicial", "Sangria e reforço de caixa", "Fechamento com resumo por forma de pagamento", "Integrado com PDV e mesas"],
    detail: {
      what: "O Controle de Caixa registra todas as movimentações financeiras do dia: abertura com valor inicial, entradas de pedidos, sangrias, reforços e fechamento. O relatório final mostra o breakdown por forma de pagamento (PIX, dinheiro, crédito, débito).",
      why: ["Substitui planilha manual do caixa", "Sangria e reforço com justificativa", "Conferência fácil ao fechar o dia", "Histórico de todos os caixas por período"],
    },
  },
  {
    slug: "online-orders",
    name: "Cardápio Digital",
    emoji: "🌐",
    category: "OPERACAO",
    tagline: "Receba pedidos direto pelo celular do cliente",
    description: "Cardápio público no celular com fotos, tamanhos, bordas, complementos, CEP autocomplete e checkout sem app.",
    isConfigured: true,
    isFree: false,
    benefits: ["Link único por estabelecimento", "Pedidos chegam em tempo real na cozinha", "Suporte a pizzas, bordas e complementos", "Checkout com PIX Mercado Pago"],
    detail: {
      what: "O Cardápio Digital é uma página pública (sem app para baixar) acessível pelo celular do cliente. Ele navega pelo cardápio, escolhe produtos, personaliza (tamanho, borda, complementos), informa o endereço com autocomplete de CEP, escolhe pagamento e envia o pedido direto para a cozinha.",
      why: ["Zero comissão por pedido (seu link, sua receita)", "Pedido chega confirmado em segundos", "Funciona em qualquer celular sem download", "Integrado com rastreamento de entrega"],
    },
  },

  // ── ESTOQUE ──────────────────────────────────────────────────────────────
  {
    slug: "stock",
    name: "Estoque de Ingredientes",
    emoji: "📦",
    category: "ESTOQUE",
    tagline: "Nunca mais fique sem insumo na hora do pico",
    description: "Controle em tempo real de ingredientes com consumo automático por receita a cada pedido confirmado.",
    isConfigured: true,
    isFree: false,
    benefits: ["Consumo automático por receita", "Alerta de estoque mínimo", "Histórico de movimentações", "Custo médio atualizado automaticamente"],
    detail: {
      what: "O módulo de Estoque desconta automaticamente os ingredientes das receitas a cada pedido confirmado. Você cadastra os ingredientes, define o estoque mínimo e o sistema alerta quando está acabando. O custo médio é atualizado a cada compra registrada.",
      why: ["Fim do desperdício por excesso ou falta", "CMV real calculado por pedido", "Compras baseadas em dados, não em intuição", "Alerta antes de ficar sem produto"],
    },
  },
  {
    slug: "recipes",
    name: "Fichas Técnicas",
    emoji: "📋",
    category: "ESTOQUE",
    tagline: "Padronize seus produtos e calcule o CMV",
    description: "Cadastro de fichas técnicas por produto com ingredientes, quantidades e custo automático de cada prato.",
    isConfigured: true,
    isFree: false,
    benefits: ["CMV calculado por produto", "Padronização de receitas", "Integrado com estoque", "Custo atualiza com preço de compra"],
    detail: {
      what: "A Ficha Técnica vincula cada produto aos ingredientes que usa (com as quantidades exatas). A cada pedido confirmado o sistema consome o estoque automaticamente e calcula o CMV (Custo da Mercadoria Vendida) real de cada item vendido.",
      why: ["Sabe exatamente quanto cada prato custa", "Margem de lucro real por produto", "Detecta quando um produto ficou caro de produzir", "Reduz desperdício e desvio de insumos"],
    },
  },
  {
    slug: "smart-import",
    name: "Cadastro Inteligente IA",
    emoji: "🧠",
    category: "ESTOQUE",
    tagline: "Cadastre cardápio inteiro com uma foto",
    description: "Tire foto do cardápio, faça upload de PDF ou XML de nota fiscal e a IA importa produtos e ingredientes automaticamente.",
    isConfigured: true,
    isFree: false,
    benefits: ["Import via foto, PDF ou XML", "IA Gemini + Anthropic", "Revisão antes de salvar", "Poupa horas de digitação"],
    detail: {
      what: "O Cadastro Inteligente usa IA (Google Gemini como primário, Anthropic como fallback) para extrair produtos de uma foto do cardápio, PDF de menu ou XML de nota fiscal. Você revisa os itens detectados, ajusta preços e confirma com um clique.",
      why: ["Cardápio completo em minutos, não horas", "Zero digitação manual de nomes e preços", "Funciona com cardápios físicos, PDFs e notas", "Disponível nos planos ativos"],
    },
  },

  // ── FINANCEIRO ────────────────────────────────────────────────────────────
  {
    slug: "financial",
    name: "Gestão Financeira",
    emoji: "💰",
    category: "FINANCEIRO",
    tagline: "Entradas, saídas e resultado no mesmo lugar",
    description: "Lançamento de receitas e despesas, extrato financeiro, breakdown por forma de pagamento e export CSV.",
    isConfigured: true,
    isFree: true,
    benefits: ["Extrato com filtro por tipo", "Breakdown por forma de pagamento", "Export CSV para Excel", "Integrado com caixa e pedidos"],
    detail: {
      what: "O módulo Financeiro centraliza todas as movimentações: receitas de pedidos, despesas fixas, repassas de entregadores. O extrato pode ser filtrado por período e forma de pagamento, e exportado para Excel com um clique.",
      why: ["Visão clara do resultado do dia/mês", "Controle de despesas fixas e variáveis", "Dados reais para tomar decisões", "Substitui planilha financeira manual"],
    },
  },
  {
    slug: "bi",
    name: "Business Intelligence",
    emoji: "📊",
    category: "FINANCEIRO",
    tagline: "Métricas que revelam onde está o dinheiro",
    description: "Dashboard de BI com KPIs diários, ticket médio, CMV, margem bruta, breakdown por tipo de pedido e forma de pagamento.",
    isConfigured: true,
    isFree: false,
    benefits: ["KPIs em tempo real", "CMV e margem bruta", "Comparativo dia a dia", "Breakdown delivery/salão/retirada"],
    detail: {
      what: "O painel de BI consolida dados de pedidos, CMV e financeiro em gráficos e indicadores. Você vê faturamento, ticket médio, margem bruta e breakdown por tipo de pedido (delivery, salão, retirada) e forma de pagamento — tudo atualizado em tempo real.",
      why: ["Identifica produtos mais rentáveis", "Compara semanas e meses", "Alerta quando CMV sobe acima do normal", "Dados para negociar com fornecedores"],
    },
  },

  // ── DELIVERY ─────────────────────────────────────────────────────────────
  {
    slug: "delivery",
    name: "Rastreamento de Entregadores",
    emoji: "🛵",
    category: "DELIVERY",
    tagline: "Saiba onde está cada entrega em tempo real",
    description: "App PWA para entregadores, rastreamento GPS ao vivo, mapa admin, gestão de repasses e ganhos.",
    isConfigured: true,
    isFree: false,
    benefits: ["App PWA para o entregador (sem download)", "GPS em tempo real no mapa", "Gestão de repasses financeiros", "Aceitação automática de pedidos"],
    detail: {
      what: "O módulo Delivery inclui: App PWA do Entregador (lista pedidos disponíveis, aceita e transmite GPS), Mapa admin com posição em tempo real de todos os entregadores, e gestão de repasses com cálculo automático de comissão por entrega.",
      why: ["Cliente sabe onde está o pedido", "Gestor vê todas as rotas no mapa", "Repasse financeiro automatizado", "Entregador sem App Store — abre no celular"],
    },
  },
  {
    slug: "delivery-config",
    name: "Zonas de Entrega",
    emoji: "📍",
    category: "DELIVERY",
    tagline: "Taxas por bairro calculadas automaticamente",
    description: "Configure zonas de entrega por bairro ou raio com taxa para o cliente e comissão para o entregador.",
    isConfigured: true,
    isFree: true,
    benefits: ["Taxa por bairro ou raio em km", "Comissão do entregador por zona", "Integrado ao checkout do cardápio", "Mapa Leaflet interativo"],
    detail: {
      what: "Configure quantas zonas precisar: por bairro (nome) ou por raio em km a partir da loja. Cada zona tem taxa para o cliente (clientFee) e repasse para o entregador (driverShare). O cardápio digital auto-completa a taxa ao cliente informar o CEP.",
      why: ["Sem confusão de 'qual taxa cobrar'", "Taxa aplicada automaticamente no pedido", "Mapa visual de cobertura", "Raio configurável por km ou bairros"],
    },
  },

  // ── MARKETING ─────────────────────────────────────────────────────────────
  {
    slug: "loyalty",
    name: "Fidelidade & Pontos",
    emoji: "🎁",
    category: "MARKETING",
    tagline: "Clientes que voltam sempre",
    description: "Programa de pontos configurável: acúmulo a cada compra, resgate por cupom e cashback automático.",
    isConfigured: true,
    isFree: false,
    benefits: ["Pontos por compra configuráveis", "Resgate por cupom", "Cashback automático", "Histórico de pontos por cliente"],
    detail: {
      what: "O módulo de Fidelidade cria um programa de pontos integrado ao cardápio e PDV. A cada pedido confirmado, o cliente acumula pontos. Quando atinge o saldo mínimo, pode resgatar como desconto ou cashback na próxima compra.",
      why: ["Frequência de visita aumenta em média 30%", "Diferencial competitivo sem custo extra", "Funciona automaticamente, sem operação manual", "Relatório de clientes mais fiéis"],
    },
  },
  {
    slug: "coupons",
    name: "Cupons de Desconto",
    emoji: "🎟️",
    category: "MARKETING",
    tagline: "Promoções que convertem",
    description: "Crie cupons de percentual, valor fixo ou frete grátis com limite de uso, data de validade e mínimo de pedido.",
    isConfigured: true,
    isFree: false,
    benefits: ["Percentual, valor fixo ou frete grátis", "Limite de uso e validade", "Valor mínimo de pedido", "Resgate por pontos do programa de fidelidade"],
    detail: {
      what: "Crie cupons com código personalizado para campanhas de lançamento, aniversário, reativação de clientes inativos ou datas comemorativas. Configure: tipo de desconto (%), valor fixo (R$), ou frete grátis; limite de usos totais; data de expiração; valor mínimo do pedido.",
      why: ["Atrai novos clientes com oferta de entrada", "Reativa clientes que não pedem há 30 dias", "Cupons do programa de fidelidade viram retenção", "Métricas de uso por campanha"],
    },
  },

  // ── AUTOMAÇÃO ─────────────────────────────────────────────────────────────
  {
    slug: "whatsapp-ia",
    name: "WhatsApp IA (Kely)",
    emoji: "💬",
    category: "AUTOMACAO",
    tagline: "Atendente virtual que vende e anota pedidos",
    description: "IA humanizada no WhatsApp que atende clientes, tira pedidos, envia link de pagamento e notifica a cozinha automaticamente.",
    isConfigured: true,
    isFree: false,
    benefits: ["Atende 24h sem funcionário", "Tira pedido pelo WhatsApp", "Envia PIX ou link de pagamento", "Notifica cozinha ao pagar"],
    detail: {
      what: "A Kely é a IA de atendimento do WhatsApp. Ela responde perguntas sobre cardápio, horários, bairros atendidos e bordas disponíveis. Anota o pedido de forma conversacional e envia link de PIX. Quando o cliente paga, a cozinha é notificada automaticamente via WebSocket.",
      why: ["Nunca perde um pedido por falta de atendente", "Reduz custo de pessoal no atendimento", "Funciona com Evolution API ou Meta Cloud API", "Persona e horários totalmente configuráveis"],
    },
  },
  {
    slug: "integrations",
    name: "Integrações (iFood, Rappi)",
    emoji: "🔌",
    category: "AUTOMACAO",
    tagline: "Pedidos dos marketplaces chegam direto na cozinha",
    description: "Receba pedidos do iFood e Rappi automaticamente, sem redigitar. Webhook validado com HMAC e ACK automático.",
    isConfigured: true,
    isFree: false,
    benefits: ["iFood via OAuth2 + HMAC", "ACK automático de pedidos", "Pedidos aparecem na cozinha em segundos", "Sandbox Mock para testar sem conta real"],
    detail: {
      what: "O módulo de Integrações recebe webhooks do iFood (e futuramente Rappi) e os transforma em pedidos nativos do sistema — que aparecem na cozinha com badge [IFOOD] e disparam estoque, CMV e financeiro normalmente. Inclui validação de segurança HMAC e ACK automático para cada pedido.",
      why: ["Fim da dupla digitação de pedidos", "Pedido chega na cozinha em segundos", "Estoque e CMV calculados automaticamente", "Menos erro operacional no rush do almoço"],
    },
  },
  {
    slug: "alerts",
    name: "Alertas Inteligentes",
    emoji: "🔔",
    category: "AUTOMACAO",
    tagline: "Seja avisado antes que o problema aconteça",
    description: "Alertas automáticos de estoque baixo, CMV alto, queda de receita e pico de cancelamentos.",
    isConfigured: false,
    setupNote: "Módulo em implementação — o schema e o AlertsModule estão no código mas o serviço ainda não está ativo no backend.",
    isFree: false,
    benefits: ["Alerta de estoque mínimo", "Aviso de CMV acima do normal", "Detecção de queda de receita", "Spike de cancelamentos"],
    detail: {
      what: "O módulo de Alertas monitora indicadores críticos e dispara notificações quando algo sai do padrão: ingrediente abaixo do mínimo, CMV acima de X%, receita 20% menor que a semana anterior, ou spike de pedidos cancelados.",
      why: ["Intervém antes do problema virar crise", "Monitoramento automático sem precisar checar tudo", "Alertas por severidade (info, aviso, crítico)", "Base para ações corretivas imediatas"],
    },
  },
  {
    slug: "printing",
    name: "Impressora Profissional",
    emoji: "🖨️",
    category: "AUTOMACAO",
    tagline: "Impressão automática sem depender do navegador",
    description: "Printer Agent standalone (Windows/Linux) que imprime direto na impressora térmica 80mm via rede ou USB, sem pop-up de impressão.",
    isConfigured: true,
    isFree: false,
    benefits: ["Sem pop-up de confirmação", "USB e Network TCP", "Multi-setor: cozinha, bar, balcão", "Fila com retry automático"],
    detail: {
      what: "O Printer Agent é um programa leve (Windows/Linux) que roda em segundo plano e imprime comandas direto na impressora térmica sem precisar de interação do operador. A fila de impressão fica no servidor e o agente puxa os jobs a cada 5 segundos.",
      why: ["Zero cliques para imprimir comanda", "Funciona com qualquer impressora térmica 80mm", "Multi-setor (cozinha e bar recebem comandas diferentes)", "Retry automático se a impressora travar"],
    },
  },
]

const CAT_CONFIG: Record<string, { label: string; color: string }> = {
  OPERACAO:   { label: "Operação",       color: "from-blue-600 to-cyan-600" },
  ESTOQUE:    { label: "Estoque",        color: "from-amber-500 to-orange-600" },
  FINANCEIRO: { label: "Financeiro",     color: "from-emerald-600 to-teal-600" },
  DELIVERY:   { label: "Delivery",       color: "from-violet-600 to-purple-600" },
  MARKETING:  { label: "Marketing",      color: "from-pink-600 to-rose-600" },
  AUTOMACAO:  { label: "Automação & IA", color: "from-indigo-600 to-violet-600" },
}

const PLAN_BADGE: Record<string, string> = {
  BASIC:        "bg-zinc-800 text-zinc-300",
  PROFESSIONAL: "bg-blue-950 text-blue-300",
  ENTERPRISE:   "bg-violet-950 text-violet-300",
  DELIVERY:     "bg-emerald-950 text-emerald-300",
}
const PLAN_LABELS: Record<string, string> = {
  BASIC: "Básico", PROFESSIONAL: "Pro", ENTERPRISE: "Enterprise", DELIVERY: "Delivery",
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function SuperAdminModulosPage() {
  const router = useRouter()

  const [companies,        setCompanies]        = useState<Company[]>([])
  const [search,           setSearch]           = useState("")
  const [selectedCompany,  setSelectedCompany]  = useState<Company | null>(null)
  const [companyModules,   setCompanyModules]   = useState<CompanyModuleStatus[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingModules,   setLoadingModules]   = useState(false)
  const [toggling,         setToggling]         = useState<string | null>(null)
  const [error,            setError]            = useState<string | null>(null)
  const [catFilter,        setCatFilter]        = useState<string>("ALL")

  useEffect(() => {
    const token = localStorage.getItem("sa_token")
    if (!token) { router.push("/super-admin/login"); return }
    saApi.get("/super-admin/companies")
      .then((r) => setCompanies(r.data?.data ?? r.data ?? []))
      .catch(() => setError("Erro ao carregar empresas"))
      .finally(() => setLoadingCompanies(false))
  }, [router])

  function loadModules(company: Company) {
    setLoadingModules(true)
    setCompanyModules([])
    saApi.get(`/company-module/company/${company.id}`)
      .then((r) => setCompanyModules(r.data ?? []))
      .catch(() => setError("Erro ao carregar módulos"))
      .finally(() => setLoadingModules(false))
  }

  function selectCompany(c: Company) {
    setSelectedCompany(c)
    loadModules(c)
  }

  async function toggleModule(mod: ModuleDef) {
    if (!selectedCompany) return
    if (!mod.isConfigured) return          // não permite toggle em módulos sem configuração
    setToggling(mod.slug)
    try {
      const cm = companyModules.find(m => m.slug === mod.slug)
      const isOn = cm?.status === "ACTIVE" || cm?.status === "TRIAL"
      if (isOn) {
        await saApi.delete(`/company-module/${selectedCompany.id}/${mod.slug}`)
      } else {
        await saApi.post("/company-module/activate", {
          companyId: selectedCompany.id,
          moduleSlug: mod.slug,
        })
      }
      const r = await saApi.get(`/company-module/company/${selectedCompany.id}`)
      setCompanyModules(r.data ?? [])
    } catch {
      setError("Erro ao alterar módulo")
    } finally {
      setToggling(null)
    }
  }

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  )

  // Módulos filtrados por categoria
  const visibleModules = catFilter === "ALL"
    ? MODULE_CATALOG
    : MODULE_CATALOG.filter(m => m.category === catFilter)

  // Agrupa por categoria
  const byCategory = visibleModules.reduce<Record<string, ModuleDef[]>>((acc, m) => {
    ;(acc[m.category] = acc[m.category] ?? []).push(m)
    return acc
  }, {})

  const activeCount = companyModules.filter(m => m.status === "ACTIVE" || m.status === "TRIAL").length

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      <SuperAdminTopBar />
      <div className="flex flex-1">

      {/* ── Lista de empresas ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white mb-3">Empresas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingCompanies ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : filteredCompanies.map((company) => (
            <button key={company.id} onClick={() => selectCompany(company)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${
                selectedCompany?.id === company.id ? "bg-zinc-800 border-l-2 border-l-violet-500" : ""
              }`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-white truncate">{company.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PLAN_BADGE[company.plan] ?? "bg-zinc-800 text-zinc-400"}`}>
                  {PLAN_LABELS[company.plan] ?? company.plan}
                </span>
              </div>
              {company.email && <span className="text-[10px] text-zinc-600 truncate block">{company.email}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Conteúdo principal ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Erro global */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">×</button>
          </div>
        )}

        {!selectedCompany ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4 opacity-50">
            <span className="text-6xl">📦</span>
            <div>
              <p className="text-white font-semibold">Selecione uma empresa</p>
              <p className="text-zinc-500 text-sm mt-1">para gerenciar os módulos</p>
            </div>
          </div>
        ) : (
          <div className="p-6">

            {/* Header da empresa */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl font-black text-white">{selectedCompany.name}</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {loadingModules ? "Carregando..." : `${activeCount} módulos ativos de ${MODULE_CATALOG.length} disponíveis`}
                </p>
              </div>
              <button onClick={() => loadModules(selectedCompany)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded-xl px-3 py-2 hover:bg-zinc-800 transition-colors">
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>

            {/* Filtros de categoria */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              <button onClick={() => setCatFilter("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                  catFilter === "ALL"
                    ? "bg-white text-black border-white"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}>
                Todos
              </button>
              {Object.entries(CAT_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setCatFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                    catFilter === key
                      ? "bg-white text-black border-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}>
                  {cfg.label}
                </button>
              ))}
            </div>

            {loadingModules ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
            ) : (
              Object.entries(byCategory).map(([cat, mods]) => {
                const catCfg = CAT_CONFIG[cat]
                return (
                  <div key={cat} className="mb-10">
                    {/* Cabeçalho da categoria */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-5 w-1 rounded-full bg-gradient-to-b ${catCfg.color}`} />
                      <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{catCfg.label}</h3>
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[10px] text-zinc-600">{mods.length} módulos</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {mods.map((mod) => {
                        const cm    = companyModules.find(m => m.slug === mod.slug)
                        const isOn  = cm?.status === "ACTIVE" || cm?.status === "TRIAL"
                        const isLoading = toggling === mod.slug

                        return (
                          <div key={mod.slug}
                            className={`group relative rounded-2xl border transition-all flex flex-col ${
                              !mod.isConfigured
                                ? "border-zinc-800 bg-zinc-900/30 opacity-70"
                                : isOn
                                  ? "border-emerald-800/50 bg-emerald-950/10 hover:border-emerald-700/60"
                                  : "border-zinc-800 bg-[#111116] hover:border-zinc-700"
                            }`}>

                            {/* Ribbon "Em breve" */}
                            {!mod.isConfigured && (
                              <div className="absolute top-3 right-3 z-10">
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                                  Em configuração
                                </span>
                              </div>
                            )}

                            {/* Trial badge */}
                            {cm?.status === "TRIAL" && (
                              <div className="absolute top-3 right-3 z-10">
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded-full">
                                  Trial
                                </span>
                              </div>
                            )}

                            {/* Card body — clicável para detalhe */}
                            <button
                              onClick={() => {
                                const q = selectedCompany
                                  ? `?company=${selectedCompany.id}&cname=${encodeURIComponent(selectedCompany.name)}`
                                  : ""
                                router.push(`/super-admin/modulos/${mod.slug}${q}`)
                              }}
                              className="flex-1 p-5 text-left"
                            >
                              {/* Ícone */}
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 bg-gradient-to-br ${catCfg.color} shadow-lg`}>
                                {mod.emoji}
                              </div>

                              <h4 className="text-sm font-bold text-white mb-1 leading-snug pr-12 group-hover:text-zinc-100">
                                {mod.name}
                              </h4>
                              <p className="text-xs font-medium text-zinc-500 mb-2">{mod.tagline}</p>
                              <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2">
                                {mod.description}
                              </p>

                              {/* Setup note */}
                              {!mod.isConfigured && mod.setupNote && (
                                <p className="mt-3 text-[10px] text-amber-600 leading-relaxed border-t border-zinc-800 pt-3">
                                  ⚠️ {mod.setupNote}
                                </p>
                              )}

                              {/* "Ver detalhes" */}
                              <div className="flex items-center gap-1 mt-3 text-[10px] text-zinc-700 group-hover:text-indigo-400 transition-colors">
                                Ver detalhes <ChevronRight className="w-3 h-3" />
                              </div>
                            </button>

                            {/* Footer com toggle */}
                            <div className={`flex items-center justify-between px-5 py-3 border-t ${isOn ? "border-emerald-900/40" : "border-zinc-800"}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  isOn ? "bg-emerald-400 animate-pulse" : "bg-zinc-700"
                                }`} />
                                <span className={`text-[10px] font-semibold ${isOn ? "text-emerald-400" : "text-zinc-600"}`}>
                                  {isOn
                                    ? cm?.status === "TRIAL"
                                      ? `Trial até ${cm.trialEndsAt ? new Date(cm.trialEndsAt).toLocaleDateString("pt-BR") : "?"}`
                                      : "Ativo"
                                    : mod.isConfigured ? "Inativo" : "Não configurado"}
                                </span>
                              </div>

                              {mod.isConfigured ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleModule(mod) }}
                                  disabled={isLoading}
                                  className="shrink-0 transition-all hover:opacity-80 disabled:opacity-40"
                                  title={isOn ? "Desativar" : "Ativar"}
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-7 h-7 text-zinc-400 animate-spin" />
                                  ) : isOn ? (
                                    <ToggleRight className="w-9 h-9 text-emerald-400" />
                                  ) : (
                                    <ToggleLeft className="w-9 h-9 text-zinc-600" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-700 italic">indisponível</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
      </div>{/* /flex */}
    </div>
  )
}
