import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const DEFAULT_MODULES = ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY']

async function seedCompanyWithModules(
  id: string, name: string, email: string,
  plan: string, password: string, role: 'SUPER_ADMIN' | 'ADMIN',
) {
  const company = await prisma.company.upsert({
    where: { id },
    update: {},
    create: { id, name, email, plan, subscriptionStatus: 'ACTIVE', isBlocked: false },
  })
  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, role, isActive: true },
    create: { name: `Admin ${name}`, email, password: hashedPassword, role, isActive: true, companyId: company.id },
  })
  for (const mod of DEFAULT_MODULES) {
    await prisma.companyModule.upsert({
      where: { id: `module-${mod.toLowerCase()}-${id}` },
      update: { active: true },
      create: { id: `module-${mod.toLowerCase()}-${id}`, module: mod, active: true, companyId: company.id },
    })
  }
  return company
}

// ─── CATEGORIAS ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'cat-lanches',     name: '🍔 Lanches' },
  { id: 'cat-porcoes',     name: '🍟 Porções' },
  { id: 'cat-hotdogs',     name: '🌭 Hot Dogs' },
  { id: 'cat-pizzas',      name: '🍕 Pizzas' },
  { id: 'cat-sanduiches',  name: '🥙 Sanduíches' },
  { id: 'cat-combos',      name: '🌮 Combos' },
  { id: 'cat-pratos',      name: '🍛 Pratos Executivos' },
  { id: 'cat-saladas',     name: '🥗 Saladas' },
  { id: 'cat-sobremesas',  name: '🍰 Sobremesas' },
  { id: 'cat-bomboniere',  name: '🍬 Bomboniere' },
  { id: 'cat-bebidas',     name: '🥤 Bebidas' },
  { id: 'cat-sucos',       name: '🧃 Sucos' },
  { id: 'cat-cafes',       name: '☕ Cafés' },
  { id: 'cat-cervejas',    name: '🍺 Cervejas' },
  { id: 'cat-drinks',      name: '🥃 Drinks' },
]

// ─── PRODUTOS ──────────────────────────────────────────────────────────────────
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=500&auto=format&q=80`

const PRODUCTS = [
  // ── 🍔 Lanches ─────────────────────────────────────────────────────────────
  { id: 'prod-smash-burger',   categoryId: 'cat-lanches', name: 'Smash Burger Classic',
    description: 'Blend 180g smashado, queijo cheddar derretido, pickles e molho especial',
    salePrice: 29.90, costPrice: 9.50, imageUrl: img('1568901346375-23c9450c58cd') },
  { id: 'prod-bbq-double',     categoryId: 'cat-lanches', name: 'BBQ Bacon Double',
    description: 'Duplo blend 2x150g, bacon crocante, onion ring e molho BBQ defumado',
    salePrice: 39.90, costPrice: 13.00, imageUrl: img('1550317138-10000687a72b') },
  { id: 'prod-veggie-burger',  categoryId: 'cat-lanches', name: 'Burger Veggie Gourmet',
    description: 'Blend de grão-de-bico, rúcula, brie e geleia de pimenta',
    salePrice: 27.90, costPrice: 8.50, imageUrl: img('1561758033-d89a9ad46330') },

  // ── 🍟 Porções ─────────────────────────────────────────────────────────────
  { id: 'prod-batata-rustica', categoryId: 'cat-porcoes', name: 'Batata Rústica Temperada',
    description: 'Batata corte country com ervas finas, alho e azeite — serve 2',
    salePrice: 19.90, costPrice: 5.00, imageUrl: img('1573080496219-bb080dd4f877') },
  { id: 'prod-onion-rings',   categoryId: 'cat-porcoes', name: 'Onion Rings Premium',
    description: 'Anéis de cebola empanados com panko dourado e molho ranch artesanal',
    salePrice: 22.90, costPrice: 6.50, imageUrl: img('1519984388953-d2406bc725e1') },
  { id: 'prod-chicken-strips', categoryId: 'cat-porcoes', name: 'Chicken Strips Crocantes',
    description: 'Tiras de frango empanadas no panko, acompanha molho mel-mostarda',
    salePrice: 24.90, costPrice: 8.00, imageUrl: img('1504674900247-0877df9cc836') },

  // ── 🌭 Hot Dogs ────────────────────────────────────────────────────────────
  { id: 'prod-hotdog-ny',      categoryId: 'cat-hotdogs', name: 'Hot Dog New York Style',
    description: 'Salsicha defumada, chucrute artesanal, mostarda Dijon e relish de pepino',
    salePrice: 18.90, costPrice: 5.50, imageUrl: img('1612392166886-ee8475b03af2') },
  { id: 'prod-hotdog-texas',   categoryId: 'cat-hotdogs', name: 'Hot Dog Texano',
    description: 'Salsicha grossa, cheddar derretido, bacon bits, jalapeño e molho barbecue',
    salePrice: 22.90, costPrice: 7.00, imageUrl: img('1612392166886-ee8475b03af2') },
  { id: 'prod-hotdog-gourmet', categoryId: 'cat-hotdogs', name: 'Hot Dog Caprese',
    description: 'Salsicha gourmet, tomate seco, mussarela de búfala e molho pesto',
    salePrice: 21.90, costPrice: 7.50, imageUrl: img('1612392166886-ee8475b03af2') },

  // ── 🍕 Pizzas ──────────────────────────────────────────────────────────────
  { id: 'prod-pizza-margherita', categoryId: 'cat-pizzas', name: 'Pizza Margherita DOP',
    description: 'Molho San Marzano, mussarela de búfala, tomate fresco e manjericão',
    salePrice: 45.90, costPrice: 14.00, imageUrl: img('1565299624946-b28f40a0ae38') },
  { id: 'prod-pizza-pepperoni', categoryId: 'cat-pizzas', name: 'Pizza Pepperoni Gold',
    description: 'Pepperoni importado fatiado, queijo blend e fio de azeite trufado',
    salePrice: 52.90, costPrice: 16.00, imageUrl: img('1513104890138-7c749659a591') },
  { id: 'prod-pizza-funghi',    categoryId: 'cat-pizzas', name: 'Pizza Funghi Secchi',
    description: 'Funghi réhydraté, gorgonzola, rúcula fresca e raspas de parmesão',
    salePrice: 54.90, costPrice: 17.00, imageUrl: img('1565299624946-b28f40a0ae38') },

  // ── 🥙 Sanduíches ──────────────────────────────────────────────────────────
  { id: 'prod-club-sandwich',  categoryId: 'cat-sanduiches', name: 'Club Sandwich Executivo',
    description: 'Frango grelhado, bacon, ovo, tomate, alface americana e maionese artesanal',
    salePrice: 26.90, costPrice: 8.50, imageUrl: img('1528735602780-2552fd46c7af') },
  { id: 'prod-focaccia',       categoryId: 'cat-sanduiches', name: 'Focaccia Caprese',
    description: 'Pão focaccia assado, tomate confit, mussarela e redução de balsâmico',
    salePrice: 24.90, costPrice: 7.50, imageUrl: img('1528735602780-2552fd46c7af') },
  { id: 'prod-wrap-med',       categoryId: 'cat-sanduiches', name: 'Wrap Mediterrâneo',
    description: 'Pão sírio integral, homus, legumes grelhados, feta e molho tzatziki',
    salePrice: 25.90, costPrice: 7.00, imageUrl: img('1504674900247-0877df9cc836') },

  // ── 🌮 Combos ──────────────────────────────────────────────────────────────
  { id: 'prod-combo-burger',   categoryId: 'cat-combos', name: 'Combo Smash Clássico',
    description: 'Smash Burger + batata rústica + refrigerante lata 350ml',
    salePrice: 44.90, costPrice: 16.00, imageUrl: img('1568901346375-23c9450c58cd') },
  { id: 'prod-combo-familia',  categoryId: 'cat-combos', name: 'Combo Família Pizza',
    description: '2 pizzas médias + 2 refrigerantes + 1 sobremesa da casa',
    salePrice: 99.90, costPrice: 38.00, imageUrl: img('1565299624946-b28f40a0ae38') },
  { id: 'prod-combo-exec',     categoryId: 'cat-combos', name: 'Combo Executivo',
    description: 'Prato do dia + suco natural 300ml + café expresso',
    salePrice: 38.90, costPrice: 14.00, imageUrl: img('1504674900247-0877df9cc836') },

  // ── 🍛 Pratos Executivos ───────────────────────────────────────────────────
  { id: 'prod-file-madeira',   categoryId: 'cat-pratos', name: 'Filé ao Molho Madeira',
    description: 'Medalhão 200g, batata gratinada, legumes salteados e molho madeira',
    salePrice: 49.90, costPrice: 18.00, imageUrl: img('1504674900247-0877df9cc836') },
  { id: 'prod-parmegiana',     categoryId: 'cat-pratos', name: 'Frango Parmegiana',
    description: 'Filé de frango empanado, molho pomodoro, mussarela e parmesão reggiano',
    salePrice: 42.90, costPrice: 14.00, imageUrl: img('1504674900247-0877df9cc836') },
  { id: 'prod-salmao',         categoryId: 'cat-pratos', name: 'Salmão ao Limão Siciliano',
    description: 'Filé de salmão grelhado, arroz negro, brócolis e manteiga de ervas',
    salePrice: 59.90, costPrice: 22.00, imageUrl: img('1504674900247-0877df9cc836') },

  // ── 🥗 Saladas ─────────────────────────────────────────────────────────────
  { id: 'prod-caesar',         categoryId: 'cat-saladas', name: 'Salada Caesar Premium',
    description: 'Alface romana, croutons artesanais, anchova, parmesão e molho caesar',
    salePrice: 28.90, costPrice: 8.00, imageUrl: img('1512621776951-a57141f2eefd') },
  { id: 'prod-caprese-salad',  categoryId: 'cat-saladas', name: 'Salada Caprese Suprema',
    description: 'Tomate heirloom, mussarela de búfala, rúcula e azeite trufado',
    salePrice: 32.90, costPrice: 10.00, imageUrl: img('1540189549336-e6e99eb4b225') },
  { id: 'prod-bowl-med',       categoryId: 'cat-saladas', name: 'Bowl Mediterrâneo',
    description: 'Quinoa, falafel, pepino, tomate, azeitona, feta e molho tahine',
    salePrice: 34.90, costPrice: 10.50, imageUrl: img('1512621776951-a57141f2eefd') },

  // ── 🍰 Sobremesas ──────────────────────────────────────────────────────────
  { id: 'prod-brownie',        categoryId: 'cat-sobremesas', name: 'Brownie com Sorvete',
    description: 'Brownie belga quente, sorvete de baunilha e calda de chocolate amargo',
    salePrice: 22.90, costPrice: 6.00, imageUrl: img('1563805042-7684c019e1cb') },
  { id: 'prod-cheesecake',     categoryId: 'cat-sobremesas', name: 'Cheesecake New York',
    description: 'Cheesecake cremoso no estilo nova-iorquino com calda de frutas vermelhas',
    salePrice: 24.90, costPrice: 7.00, imageUrl: img('1578985545062-69928b1d9587') },
  { id: 'prod-petit-gateau',   categoryId: 'cat-sobremesas', name: 'Petit Gâteau Pistache',
    description: 'Bolinho de chocolate com coração quente e sorvete de pistache importado',
    salePrice: 26.90, costPrice: 7.50, imageUrl: img('1551024506-0bccd828d307') },

  // ── 🍬 Bomboniere ──────────────────────────────────────────────────────────
  { id: 'prod-trufa',          categoryId: 'cat-bomboniere', name: 'Trufas Belgas Sortidas',
    description: 'Caixa com 6 trufas artesanais em chocolate belga 70% cacau',
    salePrice: 28.90, costPrice: 9.00, imageUrl: img('1549007994-668185ef5a46') },
  { id: 'prod-brigadeiro',     categoryId: 'cat-bomboniere', name: 'Brigadeiro Gourmet (4un)',
    description: 'Brigadeiros nobres com cobertura de cacau em pó belga',
    salePrice: 16.90, costPrice: 4.50, imageUrl: img('1549007994-668185ef5a46') },
  { id: 'prod-caixa-presente', categoryId: 'cat-bomboniere', name: 'Caixa Especial Presente',
    description: 'Mix de doces finos — trufas, brigadeiros e macaron em embalagem presente',
    salePrice: 48.90, costPrice: 16.00, imageUrl: img('1549007994-668185ef5a46') },

  // ── 🥤 Bebidas ─────────────────────────────────────────────────────────────
  { id: 'prod-refri-lata',     categoryId: 'cat-bebidas', name: 'Refrigerante Lata 350ml',
    description: 'Coca-Cola, Pepsi, Guaraná Antarctica ou Sprite gelados',
    salePrice: 7.90, costPrice: 3.00, imageUrl: img('1581006852029-8ebb52e853d7') },
  { id: 'prod-agua',           categoryId: 'cat-bebidas', name: 'Água Mineral 500ml',
    description: 'Água mineral natural ou com gás bem gelada',
    salePrice: 5.90, costPrice: 1.50, imageUrl: img('1548839140-29a749e1cf4d') },
  { id: 'prod-energetico',     categoryId: 'cat-bebidas', name: 'Energético Monster 473ml',
    description: 'Monster Energy original, verde, ultra ou mango loco',
    salePrice: 14.90, costPrice: 7.00, imageUrl: img('1581006852029-8ebb52e853d7') },

  // ── 🧃 Sucos ───────────────────────────────────────────────────────────────
  { id: 'prod-detox',          categoryId: 'cat-sucos', name: 'Suco Detox Verde',
    description: 'Couve, abacaxi, gengibre fresco e hortelã — 300ml',
    salePrice: 14.90, costPrice: 4.00, imageUrl: img('1542621334-a254cf47733d') },
  { id: 'prod-tropical',       categoryId: 'cat-sucos', name: 'Suco Tropical Premium',
    description: 'Manga, maracujá, laranja e limão tahiti — 300ml',
    salePrice: 14.90, costPrice: 4.00, imageUrl: img('1622597467836-f3285f2131b8') },
  { id: 'prod-vitamina',       categoryId: 'cat-sucos', name: 'Vitamina Power',
    description: 'Banana, morango, aveia, mel e leite vegetal de amêndoas — 350ml',
    salePrice: 16.90, costPrice: 5.00, imageUrl: img('1622597467836-f3285f2131b8') },

  // ── ☕ Cafés ────────────────────────────────────────────────────────────────
  { id: 'prod-espresso',       categoryId: 'cat-cafes', name: 'Espresso Duplo Italiano',
    description: 'Blend especial arábica, encorpado com crema dourada perfeita',
    salePrice: 8.90, costPrice: 2.00, imageUrl: img('1509042239860-f550ce710b93') },
  { id: 'prod-cappuccino',     categoryId: 'cat-cafes', name: 'Cappuccino Cremoso',
    description: 'Espresso, leite vaporizado e espuma sedosa com canela opcional',
    salePrice: 12.90, costPrice: 3.50, imageUrl: img('1572442388796-11668a67e53d') },
  { id: 'prod-cold-brew',      categoryId: 'cat-cafes', name: 'Cold Brew Premium',
    description: 'Café extraído a frio por 18h, suave e encorpado — servido com gelo',
    salePrice: 16.90, costPrice: 4.50, imageUrl: img('1554118811-1e0d58224f24') },

  // ── 🍺 Cervejas ────────────────────────────────────────────────────────────
  { id: 'prod-heineken',       categoryId: 'cat-cervejas', name: 'Heineken Long Neck 330ml',
    description: 'Cerveja pilsen holandesa gelada — a mais vendida do mundo',
    salePrice: 12.90, costPrice: 5.50, imageUrl: img('1608270586620-248524c67de9') },
  { id: 'prod-stella',         categoryId: 'cat-cervejas', name: 'Stella Artois 550ml',
    description: 'Cerveja premium belga com copo gelado — refrescante e elegante',
    salePrice: 16.90, costPrice: 7.00, imageUrl: img('1608270586620-248524c67de9') },
  { id: 'prod-colorado',       categoryId: 'cat-cervejas', name: 'Colorado Appia 600ml',
    description: 'Cerveja artesanal brasileira com mel — suave, encorpada e frutada',
    salePrice: 18.90, costPrice: 8.00, imageUrl: img('1608270586620-248524c67de9') },

  // ── 🥃 Drinks ──────────────────────────────────────────────────────────────
  { id: 'prod-mojito',         categoryId: 'cat-drinks', name: 'Mojito Clássico',
    description: 'Rum branco, limão siciliano, hortelã fresca, açúcar e água com gás',
    salePrice: 22.90, costPrice: 6.00, imageUrl: img('1551538827-9c037cb4f32a') },
  { id: 'prod-negroni',        categoryId: 'cat-drinks', name: 'Negroni Premium',
    description: 'Gin premium, vermute rosso e Campari com twist de laranja',
    salePrice: 28.90, costPrice: 9.00, imageUrl: img('1514362545857-3bc16c4c7d1b') },
  { id: 'prod-caipirinha',     categoryId: 'cat-drinks', name: 'Caipirinha Gourmet',
    description: 'Cachaça premium envelhecida, limão siciliano e açúcar demerara',
    salePrice: 19.90, costPrice: 5.00, imageUrl: img('1514362545857-3bc16c4c7d1b') },
]

async function seedDemoProducts(companyId: string) {
  // Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name },
      create: { id: cat.id, name: cat.name, companyId },
    })
  }
  console.log(`✅ ${CATEGORIES.length} categorias criadas`)

  // Products
  let count = 0
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { salePrice: p.salePrice, imageUrl: p.imageUrl, description: p.description, isActive: true, deletedAt: null },
      create: {
        id: p.id,
        name: p.name,
        description: p.description,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        profitMargin: Math.round((p.salePrice - p.costPrice) / p.salePrice * 100),
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
        companyId,
        isActive: true,
        trackStock: false,
        unit: 'un',
      },
    })
    count++
  }
  console.log(`✅ ${count} produtos com imagens criados`)
}

const MODULE_CATALOG = [
  // ── OPERACAO ────────────────────────────────────────────────────────────────
  { id: 'mod-pdv', slug: 'pdv', name: 'PDV Completo', description: 'Frente de caixa com emissão de pedidos, gestão de mesas e atendimento rápido.', icon: '🖥️', category: 'OPERACAO' as const, isFree: true, badge: 'Incluso', badgeColor: 'green', benefits: ['Pedidos ilimitados', 'Gestão de mesas', 'Impressão de comanda'], isHighlighted: false, sortOrder: 1 },
  { id: 'mod-delivery', slug: 'delivery', name: 'Delivery Inteligente', description: 'Módulo completo de entregas: cadastro de entregadores, taxa por bairro ou km, split financeiro e acompanhamento em tempo real.', icon: '🛵', category: 'OPERACAO' as const, price: 49.00, badge: 'Popular', badgeColor: 'orange', benefits: ['Cadastro de entregadores', 'Taxa por bairro ou km', 'Split taxa cliente / entregador', 'App do entregador em tempo real'], isHighlighted: true, sortOrder: 2 },
  { id: 'mod-nfce', slug: 'nfce', name: 'Emissor Fiscal NFC-e', description: 'Nunca mais tenha problemas fiscais. Emita NFC-e automaticamente integrada a cada pedido.', icon: '🧾', category: 'OPERACAO' as const, price: 79.00, badge: 'Essencial', badgeColor: 'red', benefits: ['Emissão automática', 'Contingência offline', 'Certificado digital'], isHighlighted: true, sortOrder: 3 },
  { id: 'mod-estoque', slug: 'estoque', name: 'Controle de Estoque', description: 'Gestão completa de ingredientes, receitas e movimentação de estoque em tempo real.', icon: '📦', category: 'OPERACAO' as const, price: 39.00, badge: 'Muito usado', badgeColor: 'blue', benefits: ['Alertas de estoque baixo', 'CMV automático', 'Fichas técnicas'], isHighlighted: false, sortOrder: 4 },
  { id: 'mod-cozinha', slug: 'cozinha', name: 'Display de Cozinha', description: 'Tela digital para cozinha com pedidos em tempo real, temporizador e prioridades.', icon: '👨‍🍳', category: 'OPERACAO' as const, price: 29.00, benefits: ['Pedidos em tempo real', 'Temporizador por item', 'Prioridade de preparo'], isHighlighted: false, sortOrder: 5 },
  { id: 'mod-multi-loja', slug: 'multi-loja', name: 'Gestão Multi Loja', description: 'Gerencie múltiplas unidades em um único painel com relatórios consolidados.', icon: '🏢', category: 'OPERACAO' as const, price: 149.00, badge: 'Enterprise', badgeColor: 'purple', benefits: ['Painel unificado', 'Relatórios consolidados', 'Controle por unidade'], isHighlighted: true, sortOrder: 6 },

  // ── MARKETING ───────────────────────────────────────────────────────────────
  { id: 'mod-pixel', slug: 'meta-pixel', name: 'Facebook & Meta Pixel', description: 'Rastreie conversões e crie campanhas de remarketing automático para quem visitou seu cardápio.', icon: '📊', category: 'MARKETING' as const, isFree: true, badge: 'Grátis', badgeColor: 'green', benefits: ['Remarketing automático', 'Conversões rastreadas', 'Audiências personalizadas'], isHighlighted: false, sortOrder: 1 },
  { id: 'mod-ga', slug: 'google-analytics', name: 'Google Analytics', description: 'Métricas completas do seu cardápio digital: visitantes, conversões e comportamento.', icon: '📈', category: 'MARKETING' as const, isFree: true, badge: 'Grátis', badgeColor: 'green', benefits: ['Tráfego em tempo real', 'Taxa de conversão', 'Origem dos pedidos'], isHighlighted: false, sortOrder: 2 },
  { id: 'mod-fidelidade', slug: 'fidelidade', name: 'Programa de Fidelidade', description: 'Sistema de pontos e recompensas que faz o cliente sempre querer voltar.', icon: '⭐', category: 'MARKETING' as const, price: 39.00, badge: 'Aumenta retenção', badgeColor: 'yellow', benefits: ['Pontos por pedido', 'Resgates automáticos', 'Ranking de clientes'], isHighlighted: true, sortOrder: 3 },
  { id: 'mod-cupons', slug: 'cupons', name: 'Cupons Automáticos', description: 'Crie campanhas de cupom segmentadas por perfil de cliente com disparo automático.', icon: '🎟️', category: 'MARKETING' as const, price: 29.00, benefits: ['Cupons por segmento', 'Disparo automático', 'Relatório de uso'], isHighlighted: false, sortOrder: 4 },
  { id: 'mod-crm', slug: 'crm-whatsapp', name: 'CRM WhatsApp', description: 'Atenda, fidelize e venda mais pelo WhatsApp com automação e histórico completo.', icon: '💬', category: 'MARKETING' as const, price: 59.00, badge: 'Alta demanda', badgeColor: 'green', benefits: ['Atendimento automatizado', 'Histórico do cliente', 'Campanhas em massa'], isHighlighted: true, sortOrder: 5 },
  { id: 'mod-recuperacao', slug: 'recuperacao-clientes', name: 'Recuperação de Clientes', description: 'Reengaje clientes inativos automaticamente com ofertas personalizadas no momento certo.', icon: '🔄', category: 'MARKETING' as const, price: 49.00, benefits: ['Identificação de inativos', 'Ofertas automáticas', 'Aumento do LTV'], isHighlighted: false, sortOrder: 6 },

  // ── FINANCEIRO ──────────────────────────────────────────────────────────────
  { id: 'mod-caixa', slug: 'fluxo-caixa', name: 'Fluxo de Caixa', description: 'Controle total de entradas, saídas e saldo do caixa com fechamento automático.', icon: '💰', category: 'FINANCEIRO' as const, isFree: true, badge: 'Incluso', badgeColor: 'green', benefits: ['Abertura e fechamento', 'Sangrias e suprimentos', 'Relatório diário'], isHighlighted: false, sortOrder: 1 },
  { id: 'mod-dash-fin', slug: 'dashboard-financeiro', name: 'Dashboard Financeiro', description: 'Visão 360° da saúde financeira: faturamento, ticket médio, lucro e tendências.', icon: '💹', category: 'FINANCEIRO' as const, price: 39.00, badge: 'Recomendado', badgeColor: 'blue', benefits: ['KPIs em tempo real', 'Gráficos de tendência', 'Comparativo mensal'], isHighlighted: true, sortOrder: 2 },
  { id: 'mod-dre', slug: 'dre', name: 'DRE Automático', description: 'Demonstrativo de Resultados gerado automaticamente. Saiba exatamente seu lucro real.', icon: '📑', category: 'FINANCEIRO' as const, price: 59.00, badge: 'Contador aprova', badgeColor: 'purple', benefits: ['DRE mensal automático', 'CMV integrado', 'Exportação para Excel'], isHighlighted: true, sortOrder: 3 },
  { id: 'mod-pix', slug: 'pix-automatico', name: 'PIX Automático', description: 'Receba pagamentos via PIX com confirmação automática e reconciliação instantânea.', icon: '⚡', category: 'FINANCEIRO' as const, price: 29.00, benefits: ['QR Code dinâmico', 'Confirmação automática', 'Sem taxa por transação'], isHighlighted: false, sortOrder: 4 },
  { id: 'mod-relatorios', slug: 'relatorios-avancados', name: 'Relatórios Avançados', description: 'Relatórios personalizados de vendas, produtos mais lucrativos, horário de pico e mais.', icon: '📋', category: 'FINANCEIRO' as const, price: 49.00, benefits: ['Relatórios customizáveis', 'Exportação PDF/Excel', 'Agendamento automático'], isHighlighted: false, sortOrder: 5 },

  // ── AUTOMACAO ───────────────────────────────────────────────────────────────
  { id: 'mod-ia', slug: 'cardapio-ia', name: 'Cardápio com IA', description: 'Gere descrições irresistíveis, sugira preços e otimize seu cardápio com Inteligência Artificial.', icon: '🤖', category: 'AUTOMACAO' as const, price: 39.00, badge: 'Novo', badgeColor: 'blue', benefits: ['Descrições geradas por IA', 'Sugestão de preços', 'Otimização de cardápio'], isHighlighted: true, sortOrder: 1 },
  { id: 'mod-ifood', slug: 'ifood', name: 'Integração iFood', description: 'Receba pedidos do iFood diretamente no sistema. Zero redigitação, zero erro.', icon: '🍔', category: 'AUTOMACAO' as const, price: 99.00, badge: 'Mais solicitado', badgeColor: 'red', benefits: ['Pedidos automáticos', 'Cardápio sincronizado', 'Relatórios unificados'], isHighlighted: true, sortOrder: 2 },
  { id: 'mod-99food', slug: '99food', name: 'Integração 99Food', description: 'Integração completa com a plataforma 99Food para receber mais pedidos.', icon: '🛺', category: 'AUTOMACAO' as const, price: 79.00, benefits: ['Pedidos automáticos', 'Cardápio sincronizado', 'Suporte dedicado'], isHighlighted: false, sortOrder: 3 },
  { id: 'mod-automacao-mkt', slug: 'automacao-marketing', name: 'Automação de Marketing', description: 'Dispare campanhas automáticas baseadas no comportamento: aniversário, inatividade, volume.', icon: '🚀', category: 'AUTOMACAO' as const, price: 69.00, badge: 'Aumenta faturamento', badgeColor: 'orange', benefits: ['Gatilhos comportamentais', 'E-mail + WhatsApp', 'A/B testing'], isHighlighted: true, sortOrder: 4 },
  { id: 'mod-webhooks', slug: 'webhooks', name: 'Webhooks & API', description: 'Conecte seu sistema a qualquer ferramenta externa via webhooks e API REST documentada.', icon: '🔗', category: 'AUTOMACAO' as const, price: 49.00, benefits: ['API REST completa', 'Webhooks em tempo real', 'Documentação Swagger'], isHighlighted: false, sortOrder: 5 },
]

async function seedModuleCatalog() {
  for (const mod of MODULE_CATALOG) {
    await prisma.module.upsert({
      where: { id: mod.id },
      update: {
        name: mod.name,
        description: mod.description,
        badge: mod.badge ?? null,
        badgeColor: mod.badgeColor ?? null,
        isHighlighted: mod.isHighlighted,
        sortOrder: mod.sortOrder,
      },
      create: {
        id: mod.id,
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
        category: mod.category,
        price: mod.price ?? null,
        isFree: mod.isFree ?? false,
        badge: mod.badge ?? null,
        badgeColor: mod.badgeColor ?? null,
        benefits: mod.benefits ?? [],
        isHighlighted: mod.isHighlighted,
        sortOrder: mod.sortOrder,
      },
    })
  }
  console.log(`✅ ${MODULE_CATALOG.length} módulos do catálogo criados`)
}

async function main() {
  console.log('🌱 Iniciando seed...')

  const c1 = await seedCompanyWithModules('company-seed-001', 'Ruffinus Food System', 'admin@teste.com', 'ENTERPRISE', '123456', 'SUPER_ADMIN')
  console.log(`✅ ${c1.name}`)

  const c2 = await seedCompanyWithModules('company-seed-002', 'Pizzaria Bella Napoli', 'admin@bellanapoli.com', 'PROFESSIONAL', '123456', 'ADMIN')
  console.log(`✅ ${c2.name}`)

  const c3 = await seedCompanyWithModules('company-seed-003', 'Burger Fusion', 'admin@burgerfusion.com', 'BASIC', '123456', 'ADMIN')
  console.log(`✅ ${c3.name}`)

  // Produtos demo para empresa principal
  await seedDemoProducts('company-seed-001')

  // Catálogo de módulos — isolado: falha aqui não deve bloquear o deploy
  try {
    await seedModuleCatalog()
  } catch (e: any) {
    console.warn('⚠️  seedModuleCatalog falhou (não crítico):', e?.message ?? e)
  }

  console.log('\n🎉 Seed concluído!')
  console.log('\n📋 Super Admin: superadmin@system.com / SuperAdmin@123')
  console.log('📋 Restaurante principal: admin@teste.com / 123456')
  console.log('📋 Menu público: /menu/company-seed-001')
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
