/**
 * Seed de bebidas — Estação Grill
 * Cria categorias + produtos com EAN e imagem do Open Food Facts.
 *
 * Rodar no container do VPS:
 *   docker exec foodsaas-backend-backend-1 node /app/scripts/seed-estacao-grill-bebidas.mjs
 *
 * Ou copiar o arquivo para o container:
 *   docker cp scripts/seed-estacao-grill-bebidas.mjs foodsaas-backend-backend-1:/app/scripts/seed-estacao-grill-bebidas.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Open Food Facts helpers ────────────────────────────────────────────────────

async function searchOFF(name) {
  try {
    const q = encodeURIComponent(name);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&action=process&json=1&page_size=5&fields=code,product_name,brands,image_url&countries_tags=brazil`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const products = (data.products || []).filter(p => p.image_url && p.code);
    return products[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchByEAN(ean) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${ean}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1) return null;
    return {
      code: ean,
      image_url: data.product?.image_url ?? null,
      product_name: data.product?.product_name ?? null,
    };
  } catch {
    return null;
  }
}

async function resolveProduct(name, knownEan) {
  if (knownEan) {
    const r = await fetchByEAN(knownEan);
    if (r?.image_url) return { ean: knownEan, imageUrl: r.image_url };
  }
  const r = await searchOFF(name);
  if (r) return { ean: r.code || knownEan, imageUrl: r.image_url };
  return { ean: knownEan ?? null, imageUrl: null };
}

// ── Catálogo de produtos ───────────────────────────────────────────────────────
// EANs brasileiros comuns — fallback para busca por nome quando null

const CATEGORIES = [
  {
    name: 'Cervejas Lata 269ml',
    categoryType: 'bebidas',
    displayColumns: 3,
    products: [
      { name: 'Skol Lata 269ml',         price: 3.00, ean: '7891991005348' },
      { name: 'Brahma Lata 269ml',        price: 3.25, ean: '7891149100064' },
      { name: 'Amstel Lata 269ml',        price: 3.50, ean: '7896045502072' },
      { name: 'Antarctica Lata 269ml',    price: 3.00, ean: '7891991010397' },
      { name: 'Original Lata 269ml',      price: 3.50, ean: '7891149104857' },
      { name: 'Império Ultra Lata 269ml', price: 4.00, ean: null },
      { name: 'Stella Artois Lata 269ml', price: 4.00, ean: '7789897003015' },
      { name: 'Spaten Lata 269ml',        price: 4.50, ean: '7891149413025' },
      { name: 'Crystal Lata 269ml',       price: 2.50, ean: '7891991014395' },
      { name: 'Itaipava Lata 269ml',      price: 2.75, ean: '7896820027084' },
      { name: 'Budweiser Lata 269ml',     price: 3.50, ean: '7789897501007' },
      { name: 'Conti Lata 269ml',         price: 2.70, ean: null },
    ],
  },
  {
    name: 'Cervejas Lata 350ml',
    categoryType: 'bebidas',
    displayColumns: 3,
    products: [
      { name: 'Michelob Ultra Lata 350ml', price: 6.00, ean: '7789897004418' },
      { name: 'Spaten Lata 350ml',         price: 5.50, ean: '7891149413032' },
      { name: 'Budweiser Zero Lata 350ml', price: 5.00, ean: '7789897005217' },
      { name: 'Brahma Zero Lata 350ml',    price: 5.00, ean: '7891149105977' },
      { name: 'Crystal Lata 350ml',        price: 3.00, ean: '7891991014388' },
    ],
  },
  {
    name: 'Cervejas Long Neck',
    categoryType: 'bebidas',
    displayColumns: 3,
    products: [
      { name: 'Heineken Long Neck 330ml',       price: 7.00, ean: '8710398524430' },
      { name: 'Heineken Zero Long Neck 330ml',   price: 7.00, ean: '8711000371404' },
      { name: 'Coronita 210ml',                  price: 6.50, ean: '7501064161353' },
      { name: 'Corona Extra Long Neck 355ml',    price: 7.50, ean: '7501064163388' },
      { name: 'Budweiser Long Neck 330ml',       price: 7.00, ean: '7789897003077' },
      { name: 'Budweiser Zero Long Neck 330ml',  price: 7.00, ean: null },
      { name: 'Spaten Long Neck 330ml',          price: 6.50, ean: '7891149413063' },
    ],
  },
  {
    name: 'Refrigerantes',
    categoryType: 'bebidas',
    displayColumns: 4,
    products: [
      { name: 'Coca-Cola Lata Mini 220ml',         price: 3.50, ean: '7894900011517' },
      { name: 'Fanta Laranja Lata Mini 220ml',      price: 3.50, ean: '7894900700060' },
      { name: 'Sprite Lata Mini 220ml',             price: 3.50, ean: '7894900010916' },
      { name: 'Coca-Cola Lata 350ml',               price: 4.50, ean: '7894900010824' },
      { name: 'Guaraná Antarctica Lata 350ml',       price: 4.50, ean: '7891991010083' },
      { name: 'Sprite Lata 350ml',                  price: 4.50, ean: '7894900010916' },
      { name: 'Coca-Cola 1 Litro',                  price: 6.00, ean: '7894900011647' },
      { name: 'Coca-Cola 2 Litros',                 price: 12.00, ean: '7894900322842' },
      { name: 'Fanta Laranja 2 Litros',             price: 10.00, ean: '7894900700237' },
      { name: 'Sprite 2 Litros',                    price: 10.00, ean: '7894900010916' },
      { name: 'Guaraná Antarctica 2 Litros',         price: 5.00, ean: '7891991010090' },
      { name: 'Fanta Uva 2 Litros',                 price: 7.50, ean: '7894900700244' },
    ],
  },
  {
    name: 'Águas e Isotônicos',
    categoryType: 'bebidas',
    displayColumns: 4,
    products: [
      { name: 'H2O Água com Vitaminas',  price: 6.00, ean: '7894900011791' },
      { name: 'H2O Limoneto',            price: 6.00, ean: null },
      { name: 'Powerade',                price: 7.00, ean: '7894900700022' },
      { name: 'Água com Gás 350ml',      price: 2.50, ean: null },
    ],
  },
  {
    name: 'Energéticos',
    categoryType: 'bebidas',
    displayColumns: 3,
    products: [
      { name: '8 Segundos Lata 400ml',    price: 8.00,  ean: null },
      { name: '8 Segundos 2 Litros',      price: 10.00, ean: null },
      { name: 'Fusion Energy 2 Litros',   price: 15.00, ean: null },
      { name: 'Furous Energy Lata',       price: 8.00,  ean: null },
    ],
  },
];

// ── Utilitários ────────────────────────────────────────────────────────────────

function generateId() {
  return (
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Procurando Estação Grill...');

  const company = await prisma.company.findFirst({
    where: { name: { contains: 'Esta', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  });

  if (!company) {
    // Lista todas as empresas para o usuário escolher
    const all = await prisma.company.findMany({ select: { id: true, name: true } });
    console.error('❌ Empresa "Estação Grill" não encontrada. Empresas disponíveis:');
    all.forEach(c => console.log(`  - ${c.name} (${c.id})`));
    process.exit(1);
  }

  console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

  let totalCats = 0;
  let totalProds = 0;
  let totalSkipped = 0;

  for (const cat of CATEGORIES) {
    // Cria ou encontra a categoria
    let category = await prisma.category.findFirst({
      where: { name: cat.name, companyId: company.id },
    });

    if (!category) {
      const maxSort = await prisma.category.aggregate({
        where: { companyId: company.id },
        _max: { sortOrder: true },
      });
      category = await prisma.category.create({
        data: {
          id: generateId(),
          name: cat.name,
          companyId: company.id,
          categoryType: cat.categoryType,
          displayColumns: cat.displayColumns,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          updatedAt: new Date(),
        },
      });
      console.log(`\n📂 Categoria criada: ${cat.name}`);
      totalCats++;
    } else {
      console.log(`\n📂 Categoria existente: ${cat.name}`);
    }

    for (const prod of cat.products) {
      // Verifica se produto já existe
      const existing = await prisma.product.findFirst({
        where: { name: prod.name, companyId: company.id, deletedAt: null },
      });
      if (existing) {
        console.log(`  ⏭  ${prod.name} (já existe)`);
        totalSkipped++;
        continue;
      }

      // Busca EAN e imagem no Open Food Facts
      process.stdout.write(`  🔎 ${prod.name}... `);
      const { ean, imageUrl } = await resolveProduct(prod.name, prod.ean);
      process.stdout.write(imageUrl ? `✅ imagem encontrada\n` : `⚠️  sem imagem\n`);

      const maxSortProd = await prisma.product.aggregate({
        where: { companyId: company.id },
        _max: { sortOrder: true },
      });

      await prisma.product.create({
        data: {
          id: generateId(),
          name: prod.name,
          companyId: company.id,
          categoryId: category.id,
          salePrice: prod.price,
          costPrice: 0,
          profitMargin: 0,
          trackStock: false,
          allowNegativeStock: true,
          productType: 'standard',
          eanCode: ean ?? null,
          imageUrl: imageUrl ?? null,
          sortOrder: (maxSortProd._max.sortOrder ?? 0) + 1,
          updatedAt: new Date(),
        },
      });

      totalProds++;
      await sleep(300); // respeita rate-limit do Open Food Facts
    }
  }

  const digitalMenuUrl = `https://food-system-sas-erp-frontend.vercel.app/menu/${company.id}`;

  console.log('\n──────────────────────────────────────────');
  console.log(`✅ Concluído!`);
  console.log(`   📂 Categorias criadas : ${totalCats}`);
  console.log(`   🛒 Produtos criados   : ${totalProds}`);
  console.log(`   ⏭  Pulados (existiam) : ${totalSkipped}`);
  console.log(`\n🔗 Cardápio digital da Estação Grill:`);
  console.log(`   ${digitalMenuUrl}`);
  console.log('──────────────────────────────────────────\n');
}

main()
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
