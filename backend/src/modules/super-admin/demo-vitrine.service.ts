import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrderType } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAFE_DEMO_IDS = ['demo-basic-001', 'demo-pro-001', 'demo-enterprise-001', 'demo-delivery-001'];

// Base URL served by Next.js /public — images stored at frontend/public/demo-assets/
const DEMO_BASE = 'https://food-system-sas-erp-frontend.vercel.app/demo-assets';

const rnd = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const img = (path: string) => `${DEMO_BASE}/${path}`;
const banner = (path: string) => `${DEMO_BASE}/banners/${path}`;

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(rnd(11, 22), rnd(0, 59), 0, 0);
  return d;
}

function todayAt(hour: number): Date {
  const d = new Date();
  d.setHours(hour, rnd(0, 59), 0, 0);
  return d;
}

// ── Static catalogue ──────────────────────────────────────────────────────────

const CATEGORIES_DEF = [
  {
    key: 'salgadas',
    name: 'Pizzas Salgadas',
    bannerFile: 'pizzas-salgadas.jpg',
    sortOrder: 1,
  },
  {
    key: 'doces',
    name: 'Pizzas Doces',
    bannerFile: 'pizzas-doces.jpg',
    sortOrder: 2,
  },
  { key: 'bebidas', name: 'Bebidas', bannerFile: 'bebidas.jpg', sortOrder: 3 },
  {
    key: 'sobremesas',
    name: 'Sobremesas',
    bannerFile: 'sobremesas.jpg',
    sortOrder: 4,
  },
  { key: 'combos', name: 'Combos', bannerFile: 'combos.jpg', sortOrder: 5 },
  {
    key: 'pratos',
    name: 'Pratos do Dia',
    bannerFile: 'pizzas-salgadas.jpg',
    sortOrder: 1,
  },
];

type ProdDef = {
  key: string;
  name: string;
  price: number;
  cost: number;
  imgId: string;
  desc: string;
};

// imgId = relative path under /demo-assets/ (served by Next.js /public)
const PIZZAS_SALGADAS: ProdDef[] = [
  {
    key: 'calabresa',
    name: 'Pizza Calabresa',
    price: 49.9,
    cost: 15.0,
    imgId: 'pizzas/calabresa.jpg',
    desc: 'Molho especial, mussarela, calabresa artesanal e cebola roxa',
  },
  {
    key: 'frango-catupiry',
    name: 'Pizza Frango com Catupiry',
    price: 52.9,
    cost: 17.0,
    imgId: 'pizzas/frango-catupiry.jpg',
    desc: 'Frango desfiado temperado, catupiry original e mussarela',
  },
  {
    key: 'portuguesa',
    name: 'Pizza Portuguesa',
    price: 55.9,
    cost: 18.0,
    imgId: 'pizzas/portuguesa.jpg',
    desc: 'Presunto, ovos, azeitonas, cebola, mussarela e orégano',
  },
  {
    key: 'margherita',
    name: 'Pizza Margherita',
    price: 44.9,
    cost: 13.0,
    imgId: 'pizzas/calabresa.jpg',
    desc: 'Molho san marzano, mussarela fresca, tomate cereja e manjericão',
  },
  {
    key: 'quatro-queijos',
    name: 'Pizza 4 Queijos',
    price: 57.9,
    cost: 19.0,
    imgId: 'pizzas/quatro-queijos.jpg',
    desc: 'Mussarela, provolone, gorgonzola e parmesão reggiano',
  },
  {
    key: 'bacon-especial',
    name: 'Pizza Bacon Especial',
    price: 54.9,
    cost: 17.5,
    imgId: 'pizzas/bacon-especial.jpg',
    desc: 'Bacon defumado crocante, cream cheese e mussarela extra',
  },
  {
    key: 'pepperoni',
    name: 'Pizza Pepperoni',
    price: 56.9,
    cost: 18.5,
    imgId: 'pizzas/pepperoni.jpg',
    desc: 'Pepperoni importado, molho especial e mussarela',
  },
  {
    key: 'frango-bacon',
    name: 'Pizza Frango com Bacon',
    price: 53.9,
    cost: 17.0,
    imgId: 'pizzas/frango-catupiry.jpg',
    desc: 'Frango grelhado, bacon crocante, catupiry e tomate seco',
  },
  {
    key: 'calabresa-cheddar',
    name: 'Pizza Calabresa Cheddar',
    price: 51.9,
    cost: 16.0,
    imgId: 'pizzas/calabresa.jpg',
    desc: 'Calabresa defumada, cheddar derretido e cebola caramelizada',
  },
  {
    key: 'nordestina',
    name: 'Pizza Nordestina',
    price: 58.9,
    cost: 19.5,
    imgId: 'pizzas/portuguesa.jpg',
    desc: 'Carne de sol, queijo coalho, cebola roxa e manteiga de garrafa',
  },
  {
    key: 'vegetariana',
    name: 'Pizza Vegetariana',
    price: 48.9,
    cost: 15.0,
    imgId: 'pizzas/calabresa.jpg',
    desc: 'Berinjela, abobrinha, pimentão colorido, azeitona e mussarela',
  },
  {
    key: 'strogonoff',
    name: 'Pizza de Strogonoff',
    price: 55.9,
    cost: 17.5,
    imgId: 'pizzas/frango-catupiry.jpg',
    desc: 'Strogonoff de frango cremoso, batata palha e mussarela',
  },
];

const PIZZAS_DOCES: ProdDef[] = [
  {
    key: 'chocolate',
    name: 'Pizza Chocolate com Morango',
    price: 45.9,
    cost: 14.0,
    imgId: 'pizzas/chocolate-morango.jpg',
    desc: 'Chocolate ao leite derretido, morango fresco e granulado',
  },
  {
    key: 'nutella-banana',
    name: 'Pizza Nutella com Banana',
    price: 47.9,
    cost: 15.0,
    imgId: 'pizzas/chocolate-morango.jpg',
    desc: 'Nutella generosa, banana nanica e leite condensado',
  },
  {
    key: 'romeu-julieta',
    name: 'Pizza Romeu e Julieta',
    price: 43.9,
    cost: 13.0,
    imgId: 'pizzas/chocolate-morango.jpg',
    desc: 'Goiabada cremosa com queijo minas frescal',
  },
  {
    key: 'brigadeiro',
    name: 'Pizza Brigadeiro',
    price: 46.9,
    cost: 14.5,
    imgId: 'pizzas/brigadeiro.jpg',
    desc: 'Brigadeiro cremoso, granulado de chocolate e cereja ao marasquino',
  },
];

const BEBIDAS: ProdDef[] = [
  {
    key: 'coca-2l',
    name: 'Coca-Cola 2L',
    price: 12.9,
    cost: 5.0,
    imgId: 'bebidas/coca.jpg',
    desc: 'Refrigerante gelado — serve 4 pessoas',
  },
  {
    key: 'guarana-2l',
    name: 'Guaraná Antarctica 2L',
    price: 11.9,
    cost: 4.5,
    imgId: 'bebidas/coca.jpg',
    desc: 'Guaraná gelado — serve 4 pessoas',
  },
  {
    key: 'coca-600',
    name: 'Coca-Cola 600ml',
    price: 7.9,
    cost: 3.0,
    imgId: 'bebidas/coca.jpg',
    desc: 'Garrafa individual gelada',
  },
  {
    key: 'suco-laranja',
    name: 'Suco de Laranja Natural',
    price: 10.9,
    cost: 3.5,
    imgId: 'bebidas/suco-laranja.jpg',
    desc: 'Suco natural espremido na hora 500ml',
  },
  {
    key: 'agua',
    name: 'Água Mineral 500ml',
    price: 4.9,
    cost: 1.5,
    imgId: 'bebidas/agua.jpg',
    desc: 'Água mineral sem gás gelada',
  },
  {
    key: 'heineken',
    name: 'Heineken Long Neck 330ml',
    price: 9.9,
    cost: 4.0,
    imgId: 'bebidas/cerveja.jpg',
    desc: 'Cerveja gelada, garrafa long neck',
  },
];

const SOBREMESAS: ProdDef[] = [
  {
    key: 'brownie',
    name: 'Brownie com Sorvete',
    price: 18.9,
    cost: 6.0,
    imgId: 'sobremesas/brownie.jpg',
    desc: 'Brownie quente com sorvete de creme e calda de chocolate',
  },
  {
    key: 'pudim',
    name: 'Pudim de Leite',
    price: 14.9,
    cost: 4.5,
    imgId: 'sobremesas/pudim.jpg',
    desc: 'Pudim cremoso com calda de caramelo artesanal',
  },
  {
    key: 'petit-gateau',
    name: 'Petit Gateau',
    price: 22.9,
    cost: 7.5,
    imgId: 'sobremesas/brownie.jpg',
    desc: 'Bolinho de chocolate quente com interior cremoso e sorvete',
  },
];

const COMBOS: ProdDef[] = [
  {
    key: 'familia',
    name: 'Combo Família',
    price: 89.9,
    cost: 28.0,
    imgId: 'combos/familia.jpg',
    desc: '2 pizzas grandes + 1 Coca-Cola 2L + 1 sobremesa — serve até 6 pessoas',
  },
  {
    key: 'casal',
    name: 'Combo Casal',
    price: 59.9,
    cost: 19.0,
    imgId: 'combos/familia.jpg',
    desc: '1 pizza grande + 2 Coca-Cola 600ml — o programa perfeito para dois',
  },
  {
    key: 'solo',
    name: 'Combo Solo',
    price: 34.9,
    cost: 11.0,
    imgId: 'combos/familia.jpg',
    desc: '1 pizza pequena + 1 refrigerante 600ml',
  },
];

const PRATOS_DIA: ProdDef[] = [
  { key: 'frango-grelhado',  name: 'Marmita Frango Grelhado',     price: 22.9, cost: 9.0,  imgId: 'pizzas/margherita.jpg',      desc: 'Frango grelhado, arroz, feijão, salada e farofa' },
  { key: 'bife-milanesa',    name: 'Marmita Bife à Milanesa',      price: 25.9, cost: 10.5, imgId: 'pizzas/portuguesa.jpg',      desc: 'Bife empanado, purê de batata, arroz e feijão' },
  { key: 'peixe-grelhado',   name: 'Marmita Peixe Grelhado',       price: 28.9, cost: 12.0, imgId: 'pizzas/quatro-queijos.jpg',  desc: 'Tilápia grelhada, arroz, legumes no vapor e limão' },
  { key: 'strogonoff',       name: 'Marmita Strogonoff de Frango', price: 26.9, cost: 11.0, imgId: 'pizzas/calabresa.jpg',       desc: 'Strogonoff cremoso, arroz branco e batata palha' },
  { key: 'macarrao-bolonha', name: 'Marmita Macarrão à Bolonhesa', price: 21.9, cost: 8.5,  imgId: 'pizzas/frango-catupiry.jpg', desc: 'Macarrão com molho bolonhesa artesanal e parmesão' },
  { key: 'vegana',           name: 'Marmita Vegana',               price: 20.9, cost: 7.5,  imgId: 'pizzas/vegetariana.jpg',    desc: 'Grão-de-bico, legumes assados, tabule e tahine' },
];

const PRODUCTS_MAP: Record<string, ProdDef[]> = {
  salgadas: PIZZAS_SALGADAS,
  doces: PIZZAS_DOCES,
  bebidas: BEBIDAS,
  sobremesas: SOBREMESAS,
  combos: COMBOS,
  pratos: PRATOS_DIA,
};

const CUSTOMER_NAMES = [
  'Ana Silva',
  'Carlos Mendes',
  'Fernanda Costa',
  'Roberto Lima',
  'Juliana Santos',
  'Marcos Oliveira',
  'Patrícia Rodrigues',
  'Thiago Alves',
  'Camila Ferreira',
  'Diego Sousa',
  'Larissa Carvalho',
  'Bruno Martins',
  'Amanda Pereira',
  'Lucas Ribeiro',
  'Bianca Gomes',
  'Rafael Nascimento',
  'Isabela Castro',
  'Gustavo Araújo',
  'Letícia Barbosa',
  'Leonardo Nunes',
  'Vanessa Campos',
  'Felipe Cardoso',
  'Natália Moreira',
  'Henrique Dias',
  'Priscila Teixeira',
  'Rodrigo Pinto',
  'Mariana Correia',
  'Fabio Cunha',
  'Tatiane Vieira',
  'Anderson Monteiro',
  'Cristina Freitas',
  'Renato Batista',
  'Daniela Azevedo',
  'Leandro Cavalcanti',
  'Monica Ramos',
  'Eduardo Figueiredo',
  'Simone Paiva',
  'Vitor Lopes',
  'Elaine Tavares',
  'Paulo Melo',
  'Cláudia Machado',
  'Jorge Nogueira',
  'Aline Bezerra',
  'Adriano Braga',
  'Sandra Fonseca',
  'Caio Duarte',
  'Viviane Medeiros',
  'Marcos Rocha',
  'Luciana Peixoto',
  'Flávio Borges',
  'Bruna Monteiro',
  'Sérgio Cavalcante',
  'Denise Mota',
  'Alexandre Freire',
  'Regina Lima',
  'Vinícius Ramos',
  'Débora Sousa',
  'Willian Castro',
  'Priscila Gomes',
  'Antônio Ferreira',
  'Miriam Alves',
  'Fábio Correia',
  'Cecília Borges',
  'Otávio Melo',
  'Lívia Santos',
  'Flávio Teixeira',
  'Vera Medeiros',
  'Osmar Barbosa',
  'Cíntia Rocha',
  'Nilton Carvalho',
  'Rosana Cunha',
  'Paulo Roberto Dias',
  'Adriana Vieira',
  'Marco Aurélio Costa',
  'Flávia Nunes',
  'Reinaldo Lima',
  'Sônia Campos',
  'Eder Cardoso',
  'Tatiana Moreira',
  'Wilson Pereira',
  'Carmem Rodrigues',
  'José Antônio Martins',
  'Helena Castro',
  'Cleber Araújo',
  'Alice Ferreira',
  'Sandro Nascimento',
  'Elaine Gomes',
  'Márcio Ribeiro',
  'Núbia Oliveira',
  'Ronaldo Silva',
  'Gisele Mendes',
  'Luís Henrique Costa',
  'Inês Sousa',
  'Claudinho Alves',
  'Beatriz Lima',
  'Davi Santos',
  'Elisa Carvalho',
  'Rodrigo Freire',
  'Tâmara Martins',
  'Heraldo Borges',
  'Izabela Melo',
  'Cássio Teixeira',
  'Marta Monteiro',
  'Felipe Duarte',
  'Renata Barbosa',
  'Gilson Castro',
  'Melissa Rocha',
  'Ivo Cunha',
  'Aparecida Vieira',
  'Washington Gomes',
  'Elisângela Medeiros',
  'Artur Correia',
  'Mônica Sousa',
  'Bruno Henrique Santos',
  'Vera Lúcia Lima',
  'Fernando Cavalcante',
  'Simone Freitas',
  'Leandro Martins',
  'Adriane Campos',
  'Fabrício Ramos',
  'Solange Nunes',
  'Augusto Ferreira',
  'Carina Carvalho',
  'Douglas Oliveira',
  'Fátima Costa',
  'Tomás Mendes',
  'Keila Ribeiro',
  'Vanderlei Alves',
  'Patrícia Moreira',
  'Diogo Nascimento',
  'Camila Azevedo',
  'Rômulo Pereira',
  'Débora Rodrigues',
  'Hélio Santos',
  'Cristiane Dias',
  'Pâmela Lima',
  'Rodrigo Borges',
  'Joice Martins',
  'Cláudio Ferreira',
  'Márcia Silva',
  'Alexandre Costa',
  'Elisa Monteiro',
  'Jefferson Teixeira',
  'Silvana Rocha',
  'Emerson Melo',
  'Lara Barbosa',
  'Caio Freitas',
  'Fernanda Vieira',
  'Saulo Castro',
  'Aila Gomes',
  'Joel Ribeiro',
  'Andreia Cunha',
  'Marcos Mendes',
  'Cris Cardoso',
  'Iuri Araújo',
  'Patsy Lima',
  'Murilo Sousa',
  'Gleice Nascimento',
  'Danilo Carvalho',
  'Tainara Santos',
  'Rafael Moreira',
  'Lorena Ferreira',
  'Hugo Martins',
  'Camille Oliveira',
  'Reinaldo Costa',
  'Edna Freire',
  'Celso Barbosa',
  'Suely Ramos',
  'Alisson Rodrigues',
  'Fernanda Alves',
  'Tiago Medeiros',
  'Geovana Lima',
  'Evandro Nunes',
  'Isadora Campos',
  'Joel Ferreira',
  'Nathalia Pereira',
  'Diego Borges',
  'Andreia Sousa',
  'Paulo Cunha',
  'Carla Melo',
  'Rodrigo Teixeira',
  'Fernanda Batista',
  'João Victor Rocha',
  'Cristina Vieira',
  'Marcos Gomes',
];

const DRIVER_NAMES = [
  'Marcos Pereira (Moto)',
  'José Carlos Santos (Carro)',
  'Pedro Henrique Lima (Moto)',
  'Antonio Ferreira (Bicicleta)',
  'Ricardo Borges (Moto)',
];

const ADDRESSES = [
  'Rua das Palmeiras, 123 — Jardim Primavera',
  'Av. Brasil, 456 — Centro',
  'Rua São João, 789 — Vila Nova',
  'Rua dos Ipês, 321 — Jardim América',
  'Av. Paulista, 1000 — Bela Vista',
  'Rua da Saudade, 55 — Bairro Alto',
  'Rua das Flores, 200 — Parque das Nações',
  'Av. das Acácias, 700 — Vila Jardim',
  'Rua do Comércio, 88 — Centro Histórico',
  'Rua Independência, 444 — Vila Real',
  'Rua Tiradentes, 67 — Jardim Esperança',
  'Av. Santos Dumont, 230 — Aeroporto',
  'Rua Getúlio Vargas, 180 — Centro',
  'Rua das Orquídeas, 350 — Residencial Park',
  'Rua 7 de Setembro, 99 — Boa Vista',
];

const PAYMENT_METHODS = [
  'CASH',
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PIX',
  'PIX',
  'CREDIT_CARD',
]; // PIX mais comum
const ORDER_TYPES = ['DELIVERY', 'DELIVERY', 'DELIVERY', 'PICKUP', 'DINE_IN']; // Delivery dominante

// ── Tier config ───────────────────────────────────────────────────────────────

interface TierConfig {
  companyId: string;
  companyName: string;
  catKeys: string[];
  historyDays: number;
  historyOrders: number;
  todayOrders: number;
  todayRevTarget: number;
  customerCount: number;
  driverCount: number;
}

const TIERS: TierConfig[] = [
  {
    companyId: 'demo-basic-001',
    companyName: 'Pizzaria Bella Napoli',
    catKeys: ['salgadas', 'bebidas', 'sobremesas', 'combos'],
    historyDays: 7,
    historyOrders: 20,
    todayOrders: 13,
    todayRevTarget: 720,
    customerCount: 10,
    driverCount: 1,
  },
  {
    companyId: 'demo-pro-001',
    companyName: 'Pizzaria Don Corleone',
    catKeys: ['salgadas', 'doces', 'bebidas', 'sobremesas', 'combos'],
    historyDays: 30,
    historyOrders: 100,
    todayOrders: 28,
    todayRevTarget: 2100,
    customerCount: 50,
    driverCount: 3,
  },
  {
    companyId: 'demo-enterprise-001',
    companyName: 'Grupo Milano Pizzaria',
    catKeys: ['salgadas', 'doces', 'bebidas', 'sobremesas', 'combos'],
    historyDays: 60,
    historyOrders: 305,
    todayOrders: 64,
    todayRevTarget: 5300,
    customerCount: 200,
    driverCount: 5,
  },
  {
    companyId: 'demo-delivery-001',
    companyName: 'Marmita Express Delivery',
    catKeys: ['pratos', 'bebidas', 'sobremesas', 'combos'],
    historyDays: 14,
    historyOrders: 60,
    todayOrders: 18,
    todayRevTarget: 950,
    customerCount: 35,
    driverCount: 4,
  },
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class DemoVitrineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent — updates category names for all demo companies to the current
   * CATEGORIES_DEF values (no emoji). Safe to run on every boot.
   */
  async patchDemoCategoryNames(): Promise<void> {
    for (const cid of SAFE_DEMO_IDS) {
      for (const cat of CATEGORIES_DEF) {
        const id = `${cid}-cat-${cat.key}`;
        await this.prisma.category.updateMany({
          where: { id, companyId: cid },
          data: { name: cat.name },
        });
      }
    }
  }

  /**
   * Always-run idempotent patch: ensures correct primaryColor and ALL_MODULES
   * for every demo company, regardless of when initDemoCompanies last ran.
   * Called on every Render restart so prod state stays in sync with code.
   */
  async patchDemoThemesAndModules(): Promise<void> {
    const ALL_MODULES = [
      'TABLES',
      'CASH',
      'FINANCIAL',
      'STOCK',
      'RECIPES',
      'DELIVERY',
      'BI',
      'AI',
      'LOYALTY',
      'MARKETING',
      'SMART_IMPORT',
      'WHATSAPP',
    ];

    const DEMO_COLORS: Record<string, string> = {
      'demo-basic-001': '#16a34a',
      'demo-pro-001': '#2563eb',
      'demo-enterprise-001': '#7c3aed',
      'demo-delivery-001': '#ea580c',
    };

    for (const cid of SAFE_DEMO_IDS) {
      const primaryColor = DEMO_COLORS[cid];

      // Ensure CompanyTheme exists with correct brand color
      await this.prisma.companyTheme.upsert({
        where: { companyId: cid },
        update: { primaryColor },
        create: { companyId: cid, primaryColor, darkMode: false },
      });

      // Ensure all modules are active (additive — never deactivates)
      for (const mod of ALL_MODULES) {
        const cmId = `cm-${mod.toLowerCase()}-${cid}`;
        await this.prisma.companyModule.upsert({
          where: { id: cmId },
          update: {
            active: true,
            status: 'ACTIVE',
            module: mod.toUpperCase(),
            moduleSlug: mod.toLowerCase(),
          },
          create: {
            id: cmId,
            module: mod.toUpperCase(),
            active: true,
            moduleSlug: mod.toLowerCase(),
            status: 'ACTIVE',
            activatedAt: new Date(),
            companyId: cid,
          },
        });
      }
    }
  }

  async populateAll() {
    const results: any[] = [];
    for (const tier of TIERS) {
      const r = await this.populateTier(tier);
      results.push(r);
    }
    return { ok: true, tiers: results };
  }

  // ── Populate one tier ──────────────────────────────────────────────────────

  private async populateTier(t: TierConfig) {
    const db = this.prisma as any;
    const cid = t.companyId;

    if (!SAFE_DEMO_IDS.includes(cid))
      throw new Error(`Not a demo company: ${cid}`);

    // 1. Clear all existing demo data
    await this.clearDemo(cid);

    // 2. Rename company to professional name
    await this.prisma.company.update({
      where: { id: cid },
      data: { name: t.companyName },
    });

    // 3. Categories
    const catIds: Record<string, string> = {};
    for (const catDef of CATEGORIES_DEF.filter((c) =>
      t.catKeys.includes(c.key),
    )) {
      const id = `${cid}-cat-${catDef.key}`;
      await this.prisma.category.upsert({
        where: { id },
        update: {
          name: catDef.name,
          bannerImage: banner(catDef.bannerFile),
          sortOrder: catDef.sortOrder,
        },
        create: {
          id,
          name: catDef.name,
          bannerImage: banner(catDef.bannerFile),
          sortOrder: catDef.sortOrder,
          companyId: cid,
        },
      });
      catIds[catDef.key] = id;
    }

    // 4. Products
    const products: { id: string; salePrice: number; name: string }[] = [];
    for (const catKey of t.catKeys) {
      const catId = catIds[catKey];
      if (!catId) continue;
      for (const p of PRODUCTS_MAP[catKey]) {
        const id = `${cid}-prod-${p.key}`;
        await this.prisma.product.upsert({
          where: { id },
          update: {
            name: p.name,
            salePrice: p.price,
            costPrice: p.cost,
            imageUrl: img(p.imgId),
            description: p.desc,
            categoryId: catId,
          },
          create: {
            id,
            name: p.name,
            salePrice: p.price,
            costPrice: p.cost,
            imageUrl: img(p.imgId),
            description: p.desc,
            categoryId: catId,
            companyId: cid,
          },
        });
        products.push({ id, salePrice: p.price, name: p.name });
      }
    }

    // 5. Customers
    const customers: { id: string; name: string; phone: string }[] = [];
    const names = CUSTOMER_NAMES.slice(0, t.customerCount);
    for (let i = 0; i < names.length; i++) {
      const phone = `119${String(i + 10).padStart(8, '0')}`;
      const c = await this.prisma.customer.create({
        data: { name: names[i], phone, companyId: cid },
      });
      customers.push({ id: c.id, name: names[i], phone });
    }

    // 6. Drivers
    for (let i = 0; i < t.driverCount; i++) {
      const email = `driver${i + 1}@${cid}.demo`;
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const user = await this.prisma.user.create({
          data: {
            name: DRIVER_NAMES[i] ?? `Entregador ${i + 1}`,
            email,
            password: await bcrypt.hash('Demo@Driver123', 10),
            role: 'DELIVERY',
            isActive: true,
            companyId: cid,
          },
        });
        await db.driverProfile
          .create({
            data: {
              userId: user.id,
              companyId: cid,
              isAvailable: i === 0,
              vehicleType: i % 2 === 0 ? 'MOTO' : 'CARRO',
            },
          })
          .catch(() => {});
      }
    }

    // 7. Historical orders
    const histTotal = await this.createHistoricalOrders({
      cid,
      products,
      customers,
      count: t.historyOrders,
      daysSpread: t.historyDays,
    });

    // 8. Today's orders (to hit dashboard revenue target)
    const todayTotal = await this.createTodayOrders({
      cid,
      products,
      customers,
      count: t.todayOrders,
      target: t.todayRevTarget,
    });

    // 9. WhatsApp IA vitrine
    await this.setupWhatsappIa(cid, t.companyName);

    // 10. Financial records (expenses for realism)
    await this.createFinancial(cid, t.historyDays);

    return {
      companyId: cid,
      name: t.companyName,
      categories: Object.keys(catIds).length,
      products: products.length,
      customers: customers.length,
      histOrders: t.historyOrders,
      todayOrders: t.todayOrders,
      todayRevenue: Math.round(todayTotal),
      histRevenue: Math.round(histTotal),
    };
  }

  // ── Clear demo data ────────────────────────────────────────────────────────

  private async clearDemo(cid: string) {
    const db = this.prisma as any;
    const safe = async (fn: () => Promise<any>) => {
      try {
        await fn();
      } catch {}
    };

    await safe(() =>
      db.whatsappMessage.deleteMany({ where: { companyId: cid } }),
    );
    await safe(() =>
      db.whatsappConversation.deleteMany({ where: { companyId: cid } }),
    );
    await safe(() =>
      db.whatsappAiSettings.deleteMany({ where: { companyId: cid } }),
    );
    await safe(() =>
      db.whatsappConnection.deleteMany({ where: { companyId: cid } }),
    );
    await safe(() =>
      db.orderItemComplement.deleteMany({
        where: { orderItem: { companyId: cid } },
      }),
    );
    await this.prisma.orderItem.deleteMany({ where: { companyId: cid } });
    await this.prisma.order.deleteMany({ where: { companyId: cid } });
    await safe(() => db.onlineOrder.deleteMany({ where: { companyId: cid } }));
    await safe(() =>
      db.tableOrderItem.deleteMany({ where: { companyId: cid } }),
    );
    await safe(() => db.tableOrder.deleteMany({ where: { companyId: cid } }));
    await this.prisma.financial.deleteMany({ where: { companyId: cid } });
    await safe(() =>
      db.loyaltyAccount.deleteMany({ where: { companyId: cid } }),
    );
    await this.prisma.customer.deleteMany({ where: { companyId: cid } });
    await safe(() =>
      db.driverProfile.deleteMany({ where: { companyId: cid } }),
    );
    await this.prisma.user.deleteMany({
      where: { companyId: cid, role: 'DELIVERY' },
    });
    await safe(() => db.productSize.deleteMany({ where: { companyId: cid } }));
    await safe(() => db.complement.deleteMany({ where: { companyId: cid } }));
    await this.prisma.product.deleteMany({ where: { companyId: cid } });
    await this.prisma.category.deleteMany({ where: { companyId: cid } });
  }

  // ── Historical orders ──────────────────────────────────────────────────────

  private async createHistoricalOrders(p: {
    cid: string;
    products: { id: string; salePrice: number; name: string }[];
    customers: { id: string; name: string; phone: string }[];
    count: number;
    daysSpread: number;
  }) {
    let total = 0;
    for (let i = 0; i < p.count; i++) {
      const customer = pick(p.customers);
      const daysAgo = rnd(2, p.daysSpread);
      const createdAt = pastDate(daysAgo);
      total += await this.createOneOrder({
        ...p,
        customer,
        createdAt,
        status: 'DELIVERED',
      });
    }
    return total;
  }

  // ── Today's orders ─────────────────────────────────────────────────────────

  private async createTodayOrders(p: {
    cid: string;
    products: { id: string; salePrice: number; name: string }[];
    customers: { id: string; name: string; phone: string }[];
    count: number;
    target: number;
  }) {
    let total = 0;
    const recentCount = Math.floor(p.count * 0.25); // 25% still in progress
    for (let i = 0; i < p.count; i++) {
      const customer = pick(p.customers);
      const hour = rnd(11, 22);
      const createdAt = todayAt(hour);
      const status =
        i < recentCount
          ? pick(['CONFIRMED', 'PREPARING', 'READY'])
          : 'DELIVERED';
      total += await this.createOneOrder({ ...p, customer, createdAt, status });
    }
    return total;
  }

  // ── Single order ───────────────────────────────────────────────────────────

  private async createOneOrder(p: {
    cid: string;
    products: { id: string; salePrice: number; name: string }[];
    customers: { id: string; name: string; phone: string }[];
    customer: { id: string; name: string; phone: string };
    createdAt: Date;
    status: string;
  }) {
    const itemCount = rnd(1, 3);
    const items = Array.from({ length: itemCount }, () => pick(p.products));
    const subtotal = items.reduce((s, it) => s + Number(it.salePrice), 0);
    const delivFee = rnd(4, 9);
    const total = subtotal + delivFee;
    const orderType = pick(ORDER_TYPES) as OrderType;

    const ts = (offset: number) =>
      new Date(p.createdAt.getTime() + offset * 60_000);
    const isDelivered = p.status === 'DELIVERED';

    const order = await this.prisma.order.create({
      data: {
        companyId: p.cid,
        customerId: p.customer.id,
        customerName: p.customer.name,
        customerPhone: p.customer.phone,
        orderType,
        deliveryAddress: orderType === 'DELIVERY' ? pick(ADDRESSES) : null,
        status: p.status as any,
        paymentMethod: pick(PAYMENT_METHODS) as any,
        subtotal,
        deliveryFee: delivFee,
        total,
        confirmedAt: p.status !== 'PENDING' ? ts(rnd(2, 5)) : null,
        preparingAt: ['PREPARING', 'READY', 'DELIVERED'].includes(p.status)
          ? ts(rnd(6, 10))
          : null,
        readyAt: ['READY', 'DELIVERED'].includes(p.status)
          ? ts(rnd(22, 28))
          : null,
        deliveredAt: isDelivered ? ts(rnd(36, 45)) : null,
        completedAt: isDelivered ? ts(rnd(36, 45)) : null,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      },
    });

    for (const prod of items) {
      await this.prisma.orderItem.create({
        data: {
          orderId: order.id,
          companyId: p.cid,
          productId: prod.id,
          productName: prod.name,
          productSku: prod.id.split('-').pop() ?? '',
          quantity: 1,
          unitPrice: prod.salePrice,
          subtotal: Number(prod.salePrice),
          productCost: 0,
          createdAt: p.createdAt,
        },
      });
    }

    return total;
  }

  // ── WhatsApp IA vitrine ────────────────────────────────────────────────────

  private async setupWhatsappIa(cid: string, companyName: string) {
    const db = this.prisma as any;

    const conn = await db.whatsappConnection.create({
      data: {
        companyId: cid,
        name: `${companyName} — Atendimento`,
        provider: 'EVOLUTION',
        phoneNumber: `(11) 9${rnd(4, 9)}${rnd(100, 999)}-${rnd(1000, 9999)}`,
        isActive: false,
      },
    });

    await db.whatsappAiSettings.create({
      data: {
        connectionId: conn.id,
        companyId: cid,
        aiProvider: 'GEMINI',
        aiModel: 'gemini-1.5-flash',
        attendantName: 'Carol',
        mode: 'AUTO',
        isActive: true,
        typingDelay: 1200,
        messageDelay: 800,
        useEmojis: true,
        businessHoursStart: '11:00',
        businessHoursEnd: '23:00',
        businessDays: '0,1,2,3,4,5,6',
        greetingMessage: `Olá! 😊 Seja bem-vindo à ${companyName}! Sou a Carol, sua atendente virtual. Posso te ajudar a montar seu pedido ou tirar dúvidas. O que você vai querer hoje?`,
        offlineMessage:
          'Olá! Estamos fora do horário agora, mas voltamos às 11h! 🍕 Deixa sua mensagem que te respondo assim que abrir.',
        transferKeywords: 'humano,atendente,falar com pessoa,gerente',
        systemPrompt: '',
      },
    });

    const CONVOS = [
      {
        phone: '5511987654321',
        name: 'João Pedro',
        msgs: [
          { role: 'USER', content: 'Oi, boa noite!' },
          {
            role: 'ASSISTANT',
            content: `Boa noite, João! 😊 Bem-vindo à ${companyName}! Sou a Carol. Tem alguma pizza em mente ou prefere que eu sugira a mais pedida aqui?`,
          },
          { role: 'USER', content: 'Me indica aí' },
          {
            role: 'ASSISTANT',
            content:
              'Com certeza! 🍕 Nossa Pizza Calabresa é a mais pedida — calabresa artesanal, mussarela e cebola roxa. Vai ser para quantas pessoas?',
          },
          { role: 'USER', content: 'Eu e minha esposa' },
          {
            role: 'ASSISTANT',
            content:
              'Perfeito para dois! 😊 Uma grande já resolve bem. Quer adicionar uma Coca-Cola 2L por R$12,90? Fica ótimo junto.',
          },
          { role: 'USER', content: 'Sim, pode adicionar' },
          {
            role: 'ASSISTANT',
            content:
              'Feito! 🎉 Pedido: Pizza Calabresa Grande + Coca-Cola 2L. Total: R$62,80. Vai ser entrega ou retirada?',
          },
        ],
      },
      {
        phone: '5511976543210',
        name: 'Maria Clara',
        msgs: [
          { role: 'USER', content: 'Vocês têm pizza de frango com catupiry?' },
          {
            role: 'ASSISTANT',
            content: `Sim! 🎉 Temos a Pizza Frango com Catupiry — frango desfiado temperado, catupiry original cremoso e mussarela. Muito boa! É pra quantas pessoas?`,
          },
          { role: 'USER', content: '4 pessoas' },
          {
            role: 'ASSISTANT',
            content:
              'Para 4 recomendo uma pizza família! R$52,90 e abastece bem 😊 Vai querer adicionar bebida ou sobremesa?',
          },
          { role: 'USER', content: 'Coloca uma Coca 2L e um brownie' },
          {
            role: 'ASSISTANT',
            content:
              '🤩 Pedido: Pizza Frango Catupiry Família + Coca-Cola 2L + Brownie com Sorvete. Total: R$76,70. Qual o endereço de entrega?',
          },
        ],
      },
      {
        phone: '5511965432109',
        name: 'Rafael Costa',
        msgs: [
          { role: 'USER', content: 'Qual o tempo de entrega?' },
          {
            role: 'ASSISTANT',
            content:
              'Olá, Rafael! 😊 Nossa estimativa é de 35 a 50 minutos dependendo do bairro. Posso te ajudar a montar seu pedido agora?',
          },
          { role: 'USER', content: 'Quero ver o cardápio' },
          {
            role: 'ASSISTANT',
            content:
              'Claro! Temos pizzas salgadas a partir de R$44,90, pizzas doces a partir de R$43,90, bebidas e combos especiais. Qual categoria te interessa mais?',
          },
        ],
      },
    ];

    for (const conv of CONVOS) {
      const c = await db.whatsappConversation.create({
        data: {
          connectionId: conn.id,
          companyId: cid,
          customerPhone: conv.phone,
          customerName: conv.name,
          status: 'ACTIVE',
          mode: 'AI',
        },
      });
      for (const msg of conv.msgs) {
        await db.whatsappMessage.create({
          data: {
            conversationId: c.id,
            companyId: cid,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(Date.now() - rnd(5, 120) * 60_000),
          },
        });
      }
    }
  }

  // ── Financial records ──────────────────────────────────────────────────────

  private async createFinancial(cid: string, days: number) {
    const EXPENSE_CATS = [
      'Ingredientes',
      'Embalagens',
      'Energia Elétrica',
      'Mão de Obra',
      'Aluguel',
      'Marketing',
      'Manutenção',
      'Combustível',
    ];
    const count = Math.min(days, 20);
    for (let i = 0; i < count; i++) {
      await this.prisma.financial.create({
        data: {
          companyId: cid,
          type: 'EXPENSE' as any,
          category: pick(EXPENSE_CATS),
          description: `Despesa operacional — ${new Date(Date.now() - i * 3 * 86_400_000).toLocaleDateString('pt-BR')}`,
          amount: rnd(60, 600),
          createdAt: new Date(Date.now() - i * 3 * 86_400_000),
        },
      });
    }
  }
}
