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

  console.log('\n🎉 Seed concluído!')
  console.log('\n📋 Super Admin: superadmin@system.com / SuperAdmin@123')
  console.log('📋 Restaurante principal: admin@teste.com / 123456')
  console.log('📋 Menu público: /menu/company-seed-001')
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
