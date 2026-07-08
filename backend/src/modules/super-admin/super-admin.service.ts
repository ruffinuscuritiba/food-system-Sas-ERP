import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/database/prisma.service';

const DEFAULT_MODULES = [
  'TABLES',
  'CASH',
  'FINANCIAL',
  'STOCK',
  'RECIPES',
  'DELIVERY',
];

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const saEmail =
      this.configService.get<string>('SUPER_ADMIN_EMAIL') ??
      'superadmin@system.com';
    const saPassword =
      this.configService.get<string>('SUPER_ADMIN_PASSWORD') ??
      'SuperAdmin@123';
    if (email !== saEmail || password !== saPassword) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const accessToken = await this.jwtService.signAsync(
      { email, role: 'SYSTEM_SUPER_ADMIN' },
      {
        secret:
          this.configService.get<string>('JWT_SECRET') ||
          (() => {
            throw new Error('JWT_SECRET env var is required');
          })(),
        expiresIn: '8h',
      },
    );
    return { accessToken, email };
  }

  async listCompanies(showArchived = false) {
    return this.prisma.company.findMany({
      where: showArchived ? undefined : { archivedAt: null },
      include: {
        modules: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async archiveCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return this.prisma.company.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restoreCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return this.prisma.company.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  async createCompany(data: {
    name: string;
    email: string;
    adminPassword: string;
    plan?: string;
    phone?: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        plan: data.plan || 'BASIC',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    });

    await this.prisma.user.create({
      data: {
        name: `Admin ${data.name}`,
        email: data.email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        companyId: company.id,
      },
    });

    await Promise.all(
      DEFAULT_MODULES.map((mod) =>
        this.prisma.companyModule.create({
          data: { module: mod, active: true, companyId: company.id },
        }),
      ),
    );

    return company;
  }

  async fixModules(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    for (const mod of DEFAULT_MODULES) {
      const existing = await this.prisma.companyModule.findFirst({
        where: { companyId, module: mod },
      });
      if (!existing) {
        await this.prisma.companyModule.create({
          data: { module: mod, active: true, companyId },
        });
      } else if (!existing.active) {
        await this.prisma.companyModule.update({
          where: { id: existing.id },
          data: { active: true },
        });
      }
    }
    return { ok: true, modules: DEFAULT_MODULES, companyId };
  }

  async toggleBlock(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return this.prisma.company.update({
      where: { id },
      data: { isBlocked: !company.isBlocked },
    });
  }

  async getPlatformImpersonation() {
    const platformEmail = 'platform@foodsaas.internal';

    let company = await this.prisma.company.findFirst({
      where: { email: platformEmail },
    });

    if (!company) {
      company = await this.prisma.company.create({
        data: {
          name: 'R FoodSaaS Plataforma',
          email: platformEmail,
          plan: 'ENTERPRISE',
          subscriptionStatus: 'ACTIVE',
          isBlocked: false,
          archivedAt: new Date(), // hidden from companies list
        },
      });

      const { randomUUID } = await import('crypto');
      const { hash } = await import('bcrypt');
      const pwd = await hash(randomUUID(), 10);

      await this.prisma.user.create({
        data: {
          name: 'Admin Plataforma',
          email: platformEmail,
          password: pwd,
          role: 'ADMIN',
          isActive: true,
          companyId: company.id,
        },
      });

      const ALL_MODULES = [
        'TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY',
        'whatsapp', 'whatsapp-ia',
      ];
      await Promise.all(
        ALL_MODULES.map((mod) =>
          this.prisma.companyModule.create({
            data: { module: mod, active: true, companyId: company!.id },
          }),
        ),
      );
    }

    return this.impersonateCompany(company.id);
  }

  async impersonateCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const adminUser = await this.prisma.user.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!adminUser)
      throw new NotFoundException('Nenhum usuário ativo nesta empresa');

    const accessToken = await this.jwtService.signAsync(
      {
        sub: adminUser.id,
        email: adminUser.email,
        companyId: adminUser.companyId,
        role: adminUser.role,
      },
      {
        secret:
          this.configService.get<string>('JWT_SECRET') ||
          (() => {
            throw new Error('JWT_SECRET env var is required');
          })(),
        expiresIn: '4h',
      },
    );

    return {
      accessToken,
      companyName: company.name,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.companyId,
      },
    };
  }

  async deleteCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    // Wrap in a single transaction so a mid-delete crash leaves no orphan rows.
    // timeout=60s to accommodate large tenants with many records.
    return this.prisma.$transaction(
      async (tx) => {
        const db = tx as any;

        // ── WhatsApp (leaf → root) ───────────────────────────────────────────
        await db.whatsappMessage.deleteMany({ where: { companyId: id } });
        await db.whatsappConversation.deleteMany({ where: { companyId: id } });
        await db.whatsappAiSettings.deleteMany({ where: { companyId: id } });
        await db.whatsappConnection.deleteMany({ where: { companyId: id } });

        // ── IA / Chat ────────────────────────────────────────────────────────
        await db.aiMessage.deleteMany({
          where: { conversation: { companyId: id } },
        });
        await db.aiConversation.deleteMany({ where: { companyId: id } });
        await db.chatMessage.deleteMany({
          where: { session: { companyId: id } },
        });
        await db.chatSession.deleteMany({ where: { companyId: id } });

        // ── Smart Import ─────────────────────────────────────────────────────
        await db.importLog.deleteMany({
          where: { session: { companyId: id } },
        });
        await db.importItem.deleteMany({
          where: { session: { companyId: id } },
        });
        await db.importSession.deleteMany({ where: { companyId: id } });

        // ── Pedidos mesa ─────────────────────────────────────────────────────
        await db.tableOrderItem.deleteMany({ where: { companyId: id } });
        await db.tableOrder.deleteMany({ where: { companyId: id } });
        await tx.table.deleteMany({ where: { companyId: id } });

        // ── Pedidos delivery / PDV ────────────────────────────────────────────
        await db.orderItemComplement.deleteMany({
          where: { orderItem: { companyId: id } },
        });
        await tx.orderItem.deleteMany({ where: { companyId: id } });
        await tx.order.deleteMany({ where: { companyId: id } });
        await db.onlineOrder.deleteMany({ where: { companyId: id } });
        await db.paymentWebhook.deleteMany({ where: { companyId: id } });
        await db.payment.deleteMany({ where: { companyId: id } });

        // ── Estoque / Receitas ────────────────────────────────────────────────
        await db.stockMovement.deleteMany({ where: { companyId: id } });
        await db.recipeItem.deleteMany({
          where: { recipe: { companyId: id } },
        });
        await db.recipe.deleteMany({ where: { companyId: id } });
        await tx.ingredient.deleteMany({ where: { companyId: id } });

        // ── Cardápio ─────────────────────────────────────────────────────────
        await db.complementOption.deleteMany({
          where: { complement: { companyId: id } },
        });
        await db.complement.deleteMany({ where: { companyId: id } });
        await db.productSize.deleteMany({ where: { companyId: id } });
        await tx.product.deleteMany({ where: { companyId: id } });
        await tx.category.deleteMany({ where: { companyId: id } });
        await db.pizzaBorderSize.deleteMany({
          where: { pizzaBorder: { companyId: id } },
        });
        await db.pizzaBorder.deleteMany({ where: { companyId: id } });
        await db.pizzaSizeConfig.deleteMany({ where: { companyId: id } });

        // ── Financeiro / Caixa ────────────────────────────────────────────────
        await tx.financial.deleteMany({ where: { companyId: id } });
        await db.cash.deleteMany({ where: { companyId: id } });
        await db.kpiSnapshot.deleteMany({ where: { companyId: id } });
        await db.operationalCost.deleteMany({ where: { companyId: id } });

        // ── Clientes / Fidelidade ─────────────────────────────────────────────
        await db.pointTransaction.deleteMany({
          where: { loyaltyAccount: { companyId: id } },
        });
        await db.loyaltyAccount.deleteMany({ where: { companyId: id } });
        await db.coupon.deleteMany({ where: { companyId: id } });
        await tx.customer.deleteMany({ where: { companyId: id } });

        // ── Entrega ───────────────────────────────────────────────────────────
        await db.driverProfile.deleteMany({ where: { companyId: id } });
        await db.deliveryZone.deleteMany({ where: { companyId: id } });

        // ── BI / Alertas ──────────────────────────────────────────────────────
        await db.alert.deleteMany({ where: { companyId: id } });

        // ── Sistema ───────────────────────────────────────────────────────────
        await db.companyTheme.deleteMany({ where: { companyId: id } });
        await tx.auditLog.deleteMany({ where: { companyId: id } });
        await tx.companyModule.deleteMany({ where: { companyId: id } });
        await tx.user.deleteMany({ where: { companyId: id } });
        return tx.company.delete({ where: { id } });
      },
      { timeout: 60_000 },
    );
  }

  async cloneMenu(sourceId: string, targetId: string) {
    const [sourceCats, sourceProds] = await Promise.all([
      this.prisma.category.findMany({ where: { companyId: sourceId } }),
      this.prisma.product.findMany({ where: { companyId: sourceId } }),
    ]);

    // Map old categoryId → new categoryId
    const catMap: Record<string, string> = {};
    for (const cat of sourceCats) {
      const newCat = await this.prisma.category.create({
        data: { name: cat.name, companyId: targetId },
      });
      catMap[cat.id] = newCat.id;
    }

    for (const prod of sourceProds) {
      await this.prisma.product.create({
        data: {
          name: prod.name,
          description: prod.description,
          salePrice: prod.salePrice,
          costPrice: prod.costPrice,
          imageUrl: prod.imageUrl,
          categoryId: prod.categoryId
            ? (catMap[prod.categoryId] ?? null)
            : null,
          companyId: targetId,
        },
      });
    }

    return { categories: sourceCats.length, products: sourceProds.length };
  }

  // ── Precificação ─────────────────────────────────────────────────────────

  async getPlanConfig() {
    // Garantir que todos os planos padrão existam (incluindo DELIVERY)
    const defaults = [
      { plan: 'BASIC',      price: 149, label: 'Basic',      tagline: 'Para começar com o essencial'     },
      { plan: 'PRO',        price: 249, label: 'Pro',        tagline: 'Para operações em crescimento'    },
      { plan: 'ENTERPRISE', price: 399, label: 'Enterprise', tagline: 'Tudo liberado, sem limites'       },
      { plan: 'DELIVERY',   price: 197, label: 'Delivery',   tagline: 'Foco em entregas e rastreamento'  },
    ];
    const existing = await this.prisma.planConfig.findMany({ select: { plan: true } });
    const existingPlans = new Set(existing.map((c) => c.plan));
    for (const d of defaults) {
      if (!existingPlans.has(d.plan)) {
        await this.prisma.planConfig.create({ data: d });
      }
    }
    return this.prisma.planConfig.findMany({ orderBy: { plan: 'asc' } });
  }

  async updatePlanConfig(
    plan: string,
    data: { price?: number; label?: string; tagline?: string },
  ) {
    return this.prisma.planConfig.upsert({
      where: { plan },
      update: {
        ...(data.price !== undefined && { price: data.price }),
        ...(data.label && { label: data.label }),
        ...(data.tagline !== undefined && { tagline: data.tagline }),
      },
      create: {
        plan,
        price: data.price ?? 0,
        label: data.label ?? plan,
        tagline: data.tagline,
      },
    });
  }

  async listModuleCatalog() {
    return this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        price: true,
        isFree: true,
        description: true,
      },
    });
  }

  async updateModulePrice(slug: string, price: number, isFree = false) {
    const mod = await this.prisma.module.findUnique({ where: { slug } });
    if (!mod) throw new NotFoundException(`Módulo "${slug}" não encontrado`);
    return this.prisma.module.update({
      where: { slug },
      data: { price, isFree },
      select: { id: true, slug: true, name: true, price: true, isFree: true },
    });
  }

  async getStats() {
    const [total, active, blocked, archived] = await Promise.all([
      this.prisma.company.count({ where: { archivedAt: null } }),
      this.prisma.company.count({
        where: {
          archivedAt: null,
          isBlocked: false,
          subscriptionStatus: 'ACTIVE',
        },
      }),
      this.prisma.company.count({
        where: { archivedAt: null, isBlocked: true },
      }),
      this.prisma.company.count({ where: { archivedAt: { not: null } } }),
    ]);
    return { total, active, blocked, archived };
  }

  async runDemoSeed() {
    const COMPANY_ID = 'company-seed-001';

    await this.prisma.company.upsert({
      where: { id: COMPANY_ID },
      update: {
        name: 'Restaurante Demo',
        isBlocked: false,
        subscriptionStatus: 'ACTIVE',
      },
      create: {
        id: COMPANY_ID,
        name: 'Restaurante Demo',
        email: 'demo@foodsaas.com',
        plan: 'PROFESSIONAL',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    });

    const existingUser = await this.prisma.user.findFirst({
      where: { companyId: COMPANY_ID },
    });
    if (!existingUser) {
      const hashed = await (await import('bcrypt')).hash('Demo@123456', 10);
      await this.prisma.user.create({
        data: {
          name: 'Admin Demo',
          email: 'demo@foodsaas.com',
          password: hashed,
          role: 'ADMIN',
          isActive: true,
          companyId: COMPANY_ID,
        },
      });
      for (const mod of DEFAULT_MODULES) {
        const existing = await this.prisma.companyModule.findFirst({
          where: { companyId: COMPANY_ID, module: mod },
        });
        if (!existing) {
          await this.prisma.companyModule.create({
            data: { module: mod, active: true, companyId: COMPANY_ID },
          });
        }
      }
    }

    const CATEGORIES = [
      { id: 'cat-lanches', name: 'Lanches' },
      { id: 'cat-pizzas', name: 'Pizzas' },
      { id: 'cat-bebidas', name: 'Bebidas' },
      { id: 'cat-sobremesas', name: 'Sobremesas' },
      { id: 'cat-salgados', name: 'Salgados' },
      { id: 'cat-massas', name: 'Massas' },
      { id: 'cat-saladas', name: 'Saladas' },
      { id: 'cat-carnes', name: 'Carnes' },
      { id: 'cat-peixes', name: 'Frutos do Mar' },
      { id: 'cat-caldos', name: 'Caldos e Sopas' },
      { id: 'cat-cafe', name: 'Café' },
      { id: 'cat-sucos', name: 'Sucos' },
      { id: 'cat-acai', name: 'Açaí' },
      { id: 'cat-combos', name: 'Combos' },
      { id: 'cat-kids', name: 'Kids' },
    ];

    for (const cat of CATEGORIES) {
      await this.prisma.category.upsert({
        where: { id: cat.id },
        update: { name: cat.name },
        create: { id: cat.id, name: cat.name, companyId: COMPANY_ID },
      });
    }

    const img = (id: string) =>
      `https://images.unsplash.com/photo-${id}?w=500&auto=format&q=80`;

    const PRODUCTS = [
      // Lanches
      {
        id: 'prod-001',
        name: 'Hambúrguer Clássico',
        desc: 'Pão brioche, carne 180g, queijo, alface e tomate',
        price: 28.9,
        cost: 11.0,
        cat: 'cat-lanches',
        img: img('1568901346423-7b7a1f89e39b'),
      },
      {
        id: 'prod-002',
        name: 'X-Bacon',
        desc: 'Pão, carne 180g, bacon crocante, queijo cheddar',
        price: 34.9,
        cost: 14.0,
        cat: 'cat-lanches',
        img: img('1565299507177-b37ef9dba198'),
      },
      {
        id: 'prod-003',
        name: 'X-Salada',
        desc: 'Pão, carne 180g, queijo, alface, tomate e maionese',
        price: 26.9,
        cost: 10.0,
        cat: 'cat-lanches',
        img: img('1550950158-d0ad627d2a42'),
      },
      // Pizzas
      {
        id: 'prod-004',
        name: 'Pizza Margherita',
        desc: 'Molho de tomate, mussarela, manjericão fresco',
        price: 45.9,
        cost: 18.0,
        cat: 'cat-pizzas',
        img: img('1574071318508-1cdbab80d002'),
      },
      {
        id: 'prod-005',
        name: 'Pizza Calabresa',
        desc: 'Molho, mussarela, calabresa fatiada e cebola',
        price: 47.9,
        cost: 19.0,
        cat: 'cat-pizzas',
        img: img('1565299624946-b28f40a0ae38'),
      },
      {
        id: 'prod-006',
        name: 'Pizza Portuguesa',
        desc: 'Molho, mussarela, presunto, ovos e azeitonas',
        price: 52.9,
        cost: 21.0,
        cat: 'cat-pizzas',
        img: img('1513104890138-7c749659a591'),
      },
      // Bebidas
      {
        id: 'prod-007',
        name: 'Coca-Cola 350ml',
        desc: 'Refrigerante gelado lata',
        price: 7.9,
        cost: 3.0,
        cat: 'cat-bebidas',
        img: img('1554866585-cd94860890b7'),
      },
      {
        id: 'prod-008',
        name: 'Suco de Laranja',
        desc: 'Suco natural 400ml',
        price: 12.9,
        cost: 4.0,
        cat: 'cat-bebidas',
        img: img('1621506289937-a27a00e7aa61'),
      },
      {
        id: 'prod-009',
        name: 'Água Mineral 500ml',
        desc: 'Água mineral sem gás',
        price: 4.9,
        cost: 1.5,
        cat: 'cat-bebidas',
        img: img('1548839140-29a749e1cf4d'),
      },
      // Sobremesas
      {
        id: 'prod-010',
        name: 'Pudim de Leite',
        desc: 'Pudim cremoso com calda de caramelo',
        price: 14.9,
        cost: 5.0,
        cat: 'cat-sobremesas',
        img: img('1624353365286-6f6e9d2cc5e0'),
      },
      {
        id: 'prod-011',
        name: 'Sorvete 2 Bolas',
        desc: 'Escolha 2 sabores, cobertura à parte',
        price: 16.9,
        cost: 6.0,
        cat: 'cat-sobremesas',
        img: img('1560008581-09826d1de69e'),
      },
      {
        id: 'prod-012',
        name: 'Brownie com Sorvete',
        desc: 'Brownie quente com sorvete de baunilha',
        price: 22.9,
        cost: 8.0,
        cat: 'cat-sobremesas',
        img: img('1606313564200-e75d5e394746'),
      },
      // Salgados
      {
        id: 'prod-013',
        name: 'Coxinha de Frango',
        desc: 'Coxinha crocante recheada com frango desfiado',
        price: 8.9,
        cost: 3.0,
        cat: 'cat-salgados',
        img: img('1604908177453-7462950a6a3b'),
      },
      {
        id: 'prod-014',
        name: 'Esfiha de Carne',
        desc: 'Esfiha fechada, massa macia, recheio temperado',
        price: 7.9,
        cost: 2.5,
        cat: 'cat-salgados',
        img: img('1511689915-b0f718c2cf2e'),
      },
      {
        id: 'prod-015',
        name: 'Pastel de Queijo',
        desc: 'Pastel crocante recheado com queijo mussarela',
        price: 9.9,
        cost: 3.5,
        cat: 'cat-salgados',
        img: img('1626200419199-391ae0eb3cfe'),
      },
      // Massas
      {
        id: 'prod-016',
        name: 'Lasanha Bolonhesa',
        desc: 'Lasanha gratinada com molho bolonhesa e béchamel',
        price: 38.9,
        cost: 15.0,
        cat: 'cat-massas',
        img: img('1619895092538-128341789043'),
      },
      {
        id: 'prod-017',
        name: 'Espaguete ao Sugo',
        desc: 'Espaguete com molho de tomate fresco e manjericão',
        price: 32.9,
        cost: 11.0,
        cat: 'cat-massas',
        img: img('1621996346565-ead4ee7b3de3'),
      },
      {
        id: 'prod-018',
        name: 'Fettuccine Alfredo',
        desc: 'Fettuccine com molho cremoso e parmesão',
        price: 36.9,
        cost: 13.0,
        cat: 'cat-massas',
        img: img('1563379091339-03b21ab4a4f8'),
      },
      // Saladas
      {
        id: 'prod-019',
        name: 'Salada Caesar',
        desc: 'Alface romana, croutons, parmesão e molho caesar',
        price: 24.9,
        cost: 8.0,
        cat: 'cat-saladas',
        img: img('1540420773420-3450942cabb7'),
      },
      {
        id: 'prod-020',
        name: 'Salada Caprese',
        desc: 'Tomate, mussarela de búfala, manjericão e azeite',
        price: 28.9,
        cost: 10.0,
        cat: 'cat-saladas',
        img: img('1592417817098-8fd3d3a40588'),
      },
      {
        id: 'prod-021',
        name: 'Salada Grega',
        desc: 'Pepino, tomate, azeitona preta, feta e orégano',
        price: 26.9,
        cost: 9.0,
        cat: 'cat-saladas',
        img: img('1529193591184-b1d58069ecdd'),
      },
      // Carnes
      {
        id: 'prod-022',
        name: 'Picanha Grelhada',
        desc: 'Picanha 300g grelhada com arroz e farofa',
        price: 79.9,
        cost: 35.0,
        cat: 'cat-carnes',
        img: img('1544025162-d76538b20714'),
      },
      {
        id: 'prod-023',
        name: 'Frango Grelhado',
        desc: 'Peito de frango grelhado com legumes',
        price: 42.9,
        cost: 16.0,
        cat: 'cat-carnes',
        img: img('1532550884008-b943a3ef1e37'),
      },
      {
        id: 'prod-024',
        name: 'Costelinha BBQ',
        desc: 'Costelinha suína ao molho barbecue com fritas',
        price: 64.9,
        cost: 28.0,
        cat: 'cat-carnes',
        img: img('1529193591184-b1d58069ecdd'),
      },
      // Peixes
      {
        id: 'prod-025',
        name: 'Salmão Grelhado',
        desc: 'Filé de salmão 200g grelhado com limão e ervas',
        price: 68.9,
        cost: 30.0,
        cat: 'cat-peixes',
        img: img('1519708227418-a8a551ddd806'),
      },
      {
        id: 'prod-026',
        name: 'Tilápia ao Forno',
        desc: 'Filé de tilápia 250g ao forno com alho e azeite',
        price: 48.9,
        cost: 20.0,
        cat: 'cat-peixes',
        img: img('1565680018434-b03b52b7a8b2'),
      },
      {
        id: 'prod-027',
        name: 'Camarão ao Ajillo',
        desc: 'Camarão médio ao ajillo com pão rústico',
        price: 72.9,
        cost: 32.0,
        cat: 'cat-peixes',
        img: img('1625943901889-bace8c2bd1b3'),
      },
      // Caldos
      {
        id: 'prod-028',
        name: 'Caldo Verde',
        desc: 'Caldo de couve, batata e linguiça calabresa',
        price: 22.9,
        cost: 8.0,
        cat: 'cat-caldos',
        img: img('1547592180-85f173d888e7'),
      },
      {
        id: 'prod-029',
        name: 'Sopa de Cebola',
        desc: 'Sopa clássica com croûtons e queijo gratinado',
        price: 24.9,
        cost: 9.0,
        cat: 'cat-caldos',
        img: img('1603105037259-952a59b2b1de'),
      },
      {
        id: 'prod-030',
        name: 'Creme de Abóbora',
        desc: 'Creme de abóbora com creme de leite e azeite',
        price: 21.9,
        cost: 7.0,
        cat: 'cat-caldos',
        img: img('1476718406336-6e4cc3a3f27b'),
      },
      // Café
      {
        id: 'prod-031',
        name: 'Espresso',
        desc: 'Café espresso curto e encorpado',
        price: 6.9,
        cost: 1.5,
        cat: 'cat-cafe',
        img: img('1510707577719-ae7c14805e3a'),
      },
      {
        id: 'prod-032',
        name: 'Cappuccino',
        desc: 'Espresso com leite vaporizado e espuma',
        price: 12.9,
        cost: 3.0,
        cat: 'cat-cafe',
        img: img('1534040385115-33943c78bf6d'),
      },
      {
        id: 'prod-033',
        name: 'Latte Macchiato',
        desc: 'Leite vaporizado com toque de espresso',
        price: 14.9,
        cost: 3.5,
        cat: 'cat-cafe',
        img: img('1556742393-d75f468bfcb0'),
      },
      // Sucos
      {
        id: 'prod-034',
        name: 'Suco de Manga',
        desc: 'Suco natural de manga 400ml',
        price: 13.9,
        cost: 4.5,
        cat: 'cat-sucos',
        img: img('1546173159-315724a31696'),
      },
      {
        id: 'prod-035',
        name: 'Suco de Morango',
        desc: 'Suco natural de morango 400ml',
        price: 14.9,
        cost: 5.0,
        cat: 'cat-sucos',
        img: img('1553279768-865429fa0078'),
      },
      {
        id: 'prod-036',
        name: 'Vitamina de Banana',
        desc: 'Vitamina de banana com leite 400ml',
        price: 11.9,
        cost: 3.5,
        cat: 'cat-sucos',
        img: img('1571771894821-ce9b6c11b08e'),
      },
      // Açaí
      {
        id: 'prod-037',
        name: 'Açaí 300ml',
        desc: 'Açaí puro batido 300ml',
        price: 18.9,
        cost: 7.0,
        cat: 'cat-acai',
        img: img('1590301157408-b3b4a6c4b1f8'),
      },
      {
        id: 'prod-038',
        name: 'Açaí com Granola',
        desc: 'Açaí 400ml com granola e mel',
        price: 24.9,
        cost: 9.0,
        cat: 'cat-acai',
        img: img('1511689915-b0f718c2cf2e'),
      },
      {
        id: 'prod-039',
        name: 'Açaí com Frutas',
        desc: 'Açaí 500ml com banana, morango e granola',
        price: 29.9,
        cost: 11.0,
        cat: 'cat-acai',
        img: img('1568901346423-7b7a1f89e39b'),
      },
      // Combos
      {
        id: 'prod-040',
        name: 'Combo Individual',
        desc: 'Hambúrguer + fritas + refrigerante 350ml',
        price: 39.9,
        cost: 16.0,
        cat: 'cat-combos',
        img: img('1550950158-d0ad627d2a42'),
      },
      {
        id: 'prod-041',
        name: 'Combo Duplo',
        desc: '2 Hambúrgueres + 2 fritas + 2 refrigerantes',
        price: 72.9,
        cost: 29.0,
        cat: 'cat-combos',
        img: img('1565299507177-b37ef9dba198'),
      },
      {
        id: 'prod-042',
        name: 'Combo Família',
        desc: '4 Hambúrgueres + 4 fritas + 2L refrigerante',
        price: 134.9,
        cost: 55.0,
        cat: 'cat-combos',
        img: img('1568901346423-7b7a1f89e39b'),
      },
      // Kids
      {
        id: 'prod-043',
        name: 'Nuggets Kids',
        desc: '6 nuggets de frango com molho e suco de caixinha',
        price: 22.9,
        cost: 8.0,
        cat: 'cat-kids',
        img: img('1597231702551-ca8b7f2d1a59'),
      },
      {
        id: 'prod-044',
        name: 'Mini Hambúrguer',
        desc: 'Hambúrguer pequeno com fritas e suco de caixinha',
        price: 24.9,
        cost: 9.0,
        cat: 'cat-kids',
        img: img('1550950158-d0ad627d2a42'),
      },
      {
        id: 'prod-045',
        name: 'Macarrão Infantil',
        desc: 'Macarrão ao sugo com frango grelhado e suco',
        price: 26.9,
        cost: 10.0,
        cat: 'cat-kids',
        img: img('1621996346565-ead4ee7b3de3'),
      },
    ];

    for (const p of PRODUCTS) {
      await this.prisma.product.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          description: p.desc,
          salePrice: p.price,
          costPrice: p.cost,
          imageUrl: p.img,
          categoryId: p.cat,
          isActive: true,
          deletedAt: null,
        },
        create: {
          id: p.id,
          name: p.name,
          description: p.desc,
          salePrice: p.price,
          costPrice: p.cost,
          imageUrl: p.img,
          categoryId: p.cat,
          isActive: true,
          companyId: COMPANY_ID,
        },
      });
    }

    return {
      categories: CATEGORIES.length,
      products: PRODUCTS.length,
      companyId: COMPANY_ID,
    };
  }

  /**
   * Cria (ou recria) as 3 empresas de demonstração comercial com usuários DEMO.
   * - Idempotente: pode ser chamado múltiplas vezes sem efeitos colaterais.
   * - Garante seed principal antes de clonar cardápio.
   * - Reseta módulos de cada demo para garantir isolamento correto por plano.
   *
   * BASIC      → TABLES, CASH (sem stock/financial/recipes)
   * PRO        → TABLES, CASH, FINANCIAL, STOCK, RECIPES, DELIVERY
   * ENTERPRISE → todos os módulos (plan=ENTERPRISE tem wildcard no ModuleGuard)
   */
  async initDemoCompanies() {
    const bcrypt = await import('bcrypt');
    const secret =
      this.configService.get<string>('JWT_SECRET') ||
      (() => {
        throw new Error('JWT_SECRET env var is required');
      })();

    // Garante que o seed principal existe antes de clonar
    await this.runDemoSeed();

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

    const DEMOS = [
      {
        id: 'demo-basic-001',
        name: 'Demo BASIC — FoodSaaS',
        email: 'demo-basic@foodsaas.demo',
        password: 'DemoBasic@123',
        plan: 'BASIC',
        primaryColor: '#16a34a',
        modules: ALL_MODULES,
      },
      {
        id: 'demo-pro-001',
        name: 'Demo PRO — FoodSaaS',
        email: 'demo-pro@foodsaas.demo',
        password: 'DemoPro@123',
        plan: 'PRO',
        primaryColor: '#2563eb',
        modules: ALL_MODULES,
      },
      {
        id: 'demo-enterprise-001',
        name: 'Demo ENTERPRISE — FoodSaaS',
        email: 'demo-enterprise@foodsaas.demo',
        password: 'DemoEnterprise@123',
        plan: 'ENTERPRISE',
        primaryColor: '#7c3aed',
        modules: ALL_MODULES,
      },
      {
        id: 'demo-delivery-001',
        name: 'Demo DELIVERY — FoodSaaS',
        email: 'demo-delivery@foodsaas.demo',
        password: 'DemoDelivery@123',
        plan: 'DELIVERY',
        primaryColor: '#ea580c',
        modules: ALL_MODULES,
      },
    ];

    const results: any[] = [];

    for (const demo of DEMOS) {
      // 1. Empresa — garante arquivamento nulo e status ativo
      await this.prisma.company.upsert({
        where: { id: demo.id },
        update: {
          name: demo.name,
          plan: demo.plan,
          subscriptionStatus: 'ACTIVE',
          isBlocked: false,
          archivedAt: null,
        },
        create: {
          id: demo.id,
          name: demo.name,
          email: demo.email,
          plan: demo.plan,
          subscriptionStatus: 'ACTIVE',
          isBlocked: false,
        },
      });

      // 2. Usuário DEMO (cria apenas se não existir)
      const hashed = await bcrypt.hash(demo.password, 10);
      const existingUser = await this.prisma.user.findUnique({
        where: { email: demo.email },
      });
      if (!existingUser) {
        await this.prisma.user.create({
          data: {
            name: `Demo ${demo.plan}`,
            email: demo.email,
            password: hashed,
            role: 'DEMO' as any,
            isActive: true,
            companyId: demo.id,
          },
        });
      }

      // 3. Módulos — reseta tudo e reaplica somente os corretos para o plano
      // Garante isolamento: demo basic não herda módulos de runs anteriores
      await this.prisma.companyModule.updateMany({
        where: { companyId: demo.id },
        data: { active: false, status: 'INACTIVE' },
      });

      for (const mod of demo.modules) {
        const cmId = `cm-${mod.toLowerCase()}-${demo.id}`;
        await this.prisma.companyModule.upsert({
          where: { id: cmId },
          update: {
            active: true,
            status: 'ACTIVE',
            activatedAt: new Date(),
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
            companyId: demo.id,
          },
        });
      }

      // 4. Cardápio — clona do seed se empresa ainda não tem produtos
      const prodCount = await this.prisma.product.count({
        where: { companyId: demo.id },
      });
      if (prodCount === 0) {
        await this.cloneMenu('company-seed-001', demo.id).catch(() => null);
      }

      // 4b. CompanyTheme — garante que a cor correta do plano está no banco
      // (o menu público lê daqui via GET /api/themes/:companyId)
      await this.prisma.companyTheme.upsert({
        where: { companyId: demo.id },
        update: { primaryColor: demo.primaryColor },
        create: {
          companyId: demo.id,
          primaryColor: demo.primaryColor,
          darkMode: false,
        },
      });

      // 5. Token de demonstração (365 dias)
      const user = await this.prisma.user.findUnique({
        where: { email: demo.email },
      });
      const token = user
        ? await this.jwtService.signAsync(
            {
              sub: user.id,
              email: user.email,
              companyId: demo.id,
              role: 'DEMO',
            },
            { secret, expiresIn: '365d' },
          )
        : null;

      results.push({
        plan: demo.plan,
        email: demo.email,
        password: demo.password,
        token,
        companyId: demo.id,
      });
    }

    return {
      message: '3 empresas de demonstração criadas/atualizadas.',
      demos: results,
    };
  }

  // ── Customers Report ─────────────────────────────────────────────────────────

  private classifyCompany(company: {
    id: string;
    email?: string | null;
    subscriptionStatus: string;
    wasEverActive: boolean;
    dueDate?: Date | null;
  }): { type: string; status: string } {
    const isDemo =
      company.email?.endsWith('@foodsaas.demo') || company.id.startsWith('demo-');

    if (isDemo) return { type: 'DEMO', status: 'Demonstração' };

    if (company.subscriptionStatus === 'ACTIVE') {
      return { type: 'ACTIVE', status: 'Ativo' };
    }

    if (company.wasEverActive) {
      const days = company.dueDate
        ? Math.ceil((Date.now() - company.dueDate.getTime()) / 86_400_000)
        : null;
      return {
        type: 'EX_CLIENT',
        status: `Vencido há ${days ?? '?'} dias`,
      };
    }

    // Never paid
    const inWindow =
      company.dueDate && new Date() < new Date(company.dueDate);
    return {
      type: 'TRIAL',
      status: inWindow ? 'Em trial' : 'Trial expirado',
    };
  }

  async getCustomersReport(opts: {
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
  }) {
    const page  = Math.max(1, opts.page  ?? 1);
    const limit = Math.min(100, opts.limit ?? 50);

    // 1. Fetch all companies (with admin user for contact info)
    const companies = await this.prisma.company.findMany({
      where: {
        // Exclui demos e empresa matriz — apenas lojas reais
        NOT: [
          { email: { endsWith: '@foodsaas.demo' } },
          { id: { startsWith: 'demo-' } },
          { email: 'platform@foodsaas.internal' },
        ],
      },
      select: {
        id: true, name: true, email: true,
        subscriptionStatus: true, wasEverActive: true, dueDate: true,
        plan: true, createdAt: true, archivedAt: true,
        whatsapp: true, phone: true,
        users: { where: { role: 'ADMIN' }, take: 1, select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch all leads
    const leads = await this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, company: true, whatsapp: true,
        recommendedPlan: true, status: true, createdAt: true, waClickedAt: true,
        // sessionToken is internal-only
      },
    } as any);

    // Build email set from companies to deduplicate leads
    const companyEmails = new Set(companies.map((c) => c.email?.toLowerCase()));

    // 3. Map companies → unified records
    const companyRows: any[] = companies.map((c) => {
      const { type, status } = this.classifyCompany(c);
      const admin = c.users[0];
      return {
        id:             c.id,
        contactName:    admin?.name ?? c.name,
        restaurantName: c.name,
        email:          admin?.email ?? c.email ?? '',
        whatsapp:       c.whatsapp ?? c.phone ?? '',
        type,
        status,
        plan:           c.plan ?? '',
        createdAt:      c.createdAt,
        dueDate:        c.dueDate,
        isArchived:     !!c.archivedAt,
      };
    });

    // 4. Map leads → unified records (skip if email matches a company)
    const leadRows: any[] = (leads as any[])
      .filter((l: any) => !companyEmails.has((l.email ?? '').toLowerCase()))
      .map((l: any) => ({
        id:             `lead-${l.id}`,
        contactName:    l.name ?? '',
        restaurantName: l.company ?? '',
        email:          '',
        whatsapp:       l.whatsapp ?? '',
        type:           'LEAD',
        status:         `Lead (${l.status ?? 'NOVO'})`,
        plan:           l.recommendedPlan ?? '',
        createdAt:      l.createdAt,
        dueDate:        null,
        isArchived:     false,
      }));

    const unfiltered = [...companyRows, ...leadRows];

    // 6. KPI summary always from UNFILTERED data so cards never zero out
    const summary = {
      total:     unfiltered.length,
      active:    unfiltered.filter((r) => r.type === 'ACTIVE').length,
      trial:     unfiltered.filter((r) => r.type === 'TRIAL').length,
      demo:      unfiltered.filter((r) => r.type === 'DEMO').length,
      exClient:  unfiltered.filter((r) => r.type === 'EX_CLIENT').length,
      leads:     unfiltered.filter((r) => r.type === 'LEAD').length,
    };

    // 5. Filter items (case-insensitive type comparison)
    let filtered = unfiltered;
    if (opts.type && opts.type !== 'ALL') {
      const t = opts.type.toUpperCase();
      filtered = filtered.filter((r) => r.type === t);
    }
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.contactName.toLowerCase().includes(q) ||
          r.restaurantName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.whatsapp.includes(q),
      );
    }

    const total = filtered.length;
    const items = filtered.slice((page - 1) * limit, page * limit);

    return { items, total, page, limit, summary };
  }

  async getCustomersReportCsv(): Promise<string> {
    const { items } = await this.getCustomersReport({ limit: 10000 });

    const header = [
      'Nome do Contato', 'Nome do Restaurante', 'E-mail', 'WhatsApp',
      'Tipo', 'Status', 'Plano', 'Cadastro',
    ].join(',');

    const rows = items.map((r: any) => [
      this.csvCell(r.contactName),
      this.csvCell(r.restaurantName),
      this.csvCell(r.email),
      this.csvCell(r.whatsapp),
      this.csvCell(r.type),
      this.csvCell(r.status),
      this.csvCell(r.plan),
      this.csvCell(r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : ''),
    ].join(','));

    return [header, ...rows].join('\n');
  }

  async getCustomersReportTxt(): Promise<string> {
    const { items } = await this.getCustomersReport({ limit: 10000 });
    const phones = items
      .map((r: any) => (r.whatsapp ?? '').replace(/\D/g, ''))
      .filter(Boolean);
    // Deduplicate
    return [...new Set(phones)].join('\n');
  }

  private csvCell(value: any): string {
    const str = String(value ?? '').replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * Status de caixa (aberto/fechado) por tenant, para o painel de operações
   * do Super Admin — não exige login em cada empresa pra saber se o caixa
   * está aberto. Somente leitura, não bloqueia nenhuma venda.
   */
  async getCashStatusReport() {
    const companies = await this.prisma.company.findMany({
      where: {
        NOT: [
          { email: { endsWith: '@foodsaas.demo' } },
          { id: { startsWith: 'demo-' } },
          { email: 'platform@foodsaas.internal' },
        ],
        archivedAt: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const latestCashes = await this.prisma.cash.findMany({
      where: { companyId: { in: companies.map((c) => c.id) } },
      orderBy: { createdAt: 'desc' },
      select: {
        companyId: true, isOpen: true, openingValue: true, balance: true,
        createdAt: true, closedAt: true,
      },
    });
    const byCompany = new Map<string, (typeof latestCashes)[number]>();
    for (const c of latestCashes) {
      if (!byCompany.has(c.companyId)) byCompany.set(c.companyId, c);
    }

    const items = companies.map((c) => {
      const cash = byCompany.get(c.id);
      return {
        companyId:   c.id,
        companyName: c.name,
        isOpen:      cash?.isOpen ?? false,
        openingValue: cash ? Number(cash.openingValue) : null,
        balance:     cash ? Number(cash.balance) : null,
        since:       cash?.isOpen ? cash.createdAt : null,
        lastClosedAt: !cash?.isOpen ? cash?.closedAt ?? null : null,
        hasEverOpened: !!cash,
      };
    });

    return {
      items,
      summary: {
        total: items.length,
        open: items.filter((i) => i.isOpen).length,
        neverOpened: items.filter((i) => !i.hasEverOpened).length,
      },
    };
  }
}
