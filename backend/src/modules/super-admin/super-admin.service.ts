import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '@/database/prisma.service'

const SA_EMAIL = 'superadmin@system.com'
const SA_PASSWORD = 'SuperAdmin@123'
const DEFAULT_MODULES = ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY']

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    if (email !== SA_EMAIL || password !== SA_PASSWORD) {
      throw new UnauthorizedException('Credenciais inválidas')
    }
    const accessToken = await this.jwtService.signAsync(
      { email, role: 'SYSTEM_SUPER_ADMIN' },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'secret',
        expiresIn: '8h',
      },
    )
    return { accessToken, email }
  }

  async listCompanies(showArchived = false) {
    return this.prisma.company.findMany({
      where: showArchived ? undefined : { archivedAt: null },
      include: {
        modules: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async archiveCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    return this.prisma.company.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
  }

  async restoreCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    return this.prisma.company.update({
      where: { id },
      data: { archivedAt: null },
    })
  }

  async createCompany(data: {
    name: string
    email: string
    adminPassword: string
    plan?: string
    phone?: string
  }) {
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10)

    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        plan: data.plan || 'BASIC',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    })

    await this.prisma.user.create({
      data: {
        name: `Admin ${data.name}`,
        email: data.email,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        companyId: company.id,
      },
    })

    await Promise.all(
      DEFAULT_MODULES.map((mod) =>
        this.prisma.companyModule.create({
          data: { module: mod, active: true, companyId: company.id },
        }),
      ),
    )

    return company
  }

  async fixModules(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    for (const mod of DEFAULT_MODULES) {
      const existing = await this.prisma.companyModule.findFirst({ where: { companyId, module: mod } })
      if (!existing) {
        await this.prisma.companyModule.create({ data: { module: mod, active: true, companyId } })
      } else if (!existing.active) {
        await this.prisma.companyModule.update({ where: { id: existing.id }, data: { active: true } })
      }
    }
    return { ok: true, modules: DEFAULT_MODULES, companyId }
  }

  async toggleBlock(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    return this.prisma.company.update({
      where: { id },
      data: { isBlocked: !company.isBlocked },
    })
  }

  async impersonateCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Empresa não encontrada')

    const adminUser = await this.prisma.user.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!adminUser) throw new NotFoundException('Nenhum usuário ativo nesta empresa')

    const accessToken = await this.jwtService.signAsync(
      { sub: adminUser.id, email: adminUser.email, companyId: adminUser.companyId, role: adminUser.role },
      { secret: this.configService.get<string>('JWT_SECRET') || 'secret', expiresIn: '4h' },
    )

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
    }
  }

  async deleteCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Empresa não encontrada')
    // cascade: remove all FK-dependent rows before deleting the company
    await this.prisma.orderItem.deleteMany({ where: { companyId: id } })
    await this.prisma.order.deleteMany({ where: { companyId: id } })
    await this.prisma.product.deleteMany({ where: { companyId: id } })
    await this.prisma.category.deleteMany({ where: { companyId: id } })
    await this.prisma.companyModule.deleteMany({ where: { companyId: id } })
    await this.prisma.user.deleteMany({ where: { companyId: id } })
    return this.prisma.company.delete({ where: { id } })
  }

  async cloneMenu(sourceId: string, targetId: string) {
    const [sourceCats, sourceProds] = await Promise.all([
      this.prisma.category.findMany({ where: { companyId: sourceId } }),
      this.prisma.product.findMany({ where: { companyId: sourceId } }),
    ])

    // Map old categoryId → new categoryId
    const catMap: Record<string, string> = {}
    for (const cat of sourceCats) {
      const newCat = await this.prisma.category.create({
        data: { name: cat.name, companyId: targetId },
      })
      catMap[cat.id] = newCat.id
    }

    for (const prod of sourceProds) {
      await this.prisma.product.create({
        data: {
          name: prod.name,
          description: prod.description,
          salePrice: prod.salePrice,
          costPrice: prod.costPrice,
          imageUrl: prod.imageUrl,
          categoryId: prod.categoryId ? (catMap[prod.categoryId] ?? null) : null,
          companyId: targetId,
        },
      })
    }

    return { categories: sourceCats.length, products: sourceProds.length }
  }

  async getStats() {
    const [total, active, blocked, archived] = await Promise.all([
      this.prisma.company.count({ where: { archivedAt: null } }),
      this.prisma.company.count({ where: { archivedAt: null, isBlocked: false, subscriptionStatus: 'ACTIVE' } }),
      this.prisma.company.count({ where: { archivedAt: null, isBlocked: true } }),
      this.prisma.company.count({ where: { archivedAt: { not: null } } }),
    ])
    return { total, active, blocked, archived }
  }

  async runDemoSeed() {
    const COMPANY_ID = 'company-seed-001'

    await this.prisma.company.upsert({
      where: { id: COMPANY_ID },
      update: { name: 'Restaurante Demo', isBlocked: false, subscriptionStatus: 'ACTIVE' },
      create: {
        id: COMPANY_ID,
        name: 'Restaurante Demo',
        email: 'demo@foodsaas.com',
        plan: 'PROFESSIONAL',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    })

    const existingUser = await this.prisma.user.findFirst({ where: { companyId: COMPANY_ID } })
    if (!existingUser) {
      const hashed = await (await import('bcrypt')).hash('Demo@123456', 10)
      await this.prisma.user.create({
        data: {
          name: 'Admin Demo',
          email: 'demo@foodsaas.com',
          password: hashed,
          role: 'ADMIN',
          isActive: true,
          companyId: COMPANY_ID,
        },
      })
      for (const mod of DEFAULT_MODULES) {
        const existing = await this.prisma.companyModule.findFirst({ where: { companyId: COMPANY_ID, module: mod } })
        if (!existing) {
          await this.prisma.companyModule.create({ data: { module: mod, active: true, companyId: COMPANY_ID } })
        }
      }
    }

    const CATEGORIES = [
      { id: 'cat-lanches',    name: 'Lanches' },
      { id: 'cat-pizzas',     name: 'Pizzas' },
      { id: 'cat-bebidas',    name: 'Bebidas' },
      { id: 'cat-sobremesas', name: 'Sobremesas' },
      { id: 'cat-salgados',   name: 'Salgados' },
      { id: 'cat-massas',     name: 'Massas' },
      { id: 'cat-saladas',    name: 'Saladas' },
      { id: 'cat-carnes',     name: 'Carnes' },
      { id: 'cat-peixes',     name: 'Frutos do Mar' },
      { id: 'cat-caldos',     name: 'Caldos e Sopas' },
      { id: 'cat-cafe',       name: 'Café' },
      { id: 'cat-sucos',      name: 'Sucos' },
      { id: 'cat-acai',       name: 'Açaí' },
      { id: 'cat-combos',     name: 'Combos' },
      { id: 'cat-kids',       name: 'Kids' },
    ]

    for (const cat of CATEGORIES) {
      await this.prisma.category.upsert({
        where: { id: cat.id },
        update: { name: cat.name },
        create: { id: cat.id, name: cat.name, companyId: COMPANY_ID },
      })
    }

    const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=500&auto=format&q=80`

    const PRODUCTS = [
      // Lanches
      { id: 'prod-001', name: 'Hambúrguer Clássico', desc: 'Pão brioche, carne 180g, queijo, alface e tomate', price: 28.90, cost: 11.00, cat: 'cat-lanches', img: img('1568901346423-7b7a1f89e39b') },
      { id: 'prod-002', name: 'X-Bacon',             desc: 'Pão, carne 180g, bacon crocante, queijo cheddar', price: 34.90, cost: 14.00, cat: 'cat-lanches', img: img('1565299507177-b37ef9dba198') },
      { id: 'prod-003', name: 'X-Salada',            desc: 'Pão, carne 180g, queijo, alface, tomate e maionese', price: 26.90, cost: 10.00, cat: 'cat-lanches', img: img('1550950158-d0ad627d2a42') },
      // Pizzas
      { id: 'prod-004', name: 'Pizza Margherita',    desc: 'Molho de tomate, mussarela, manjericão fresco', price: 45.90, cost: 18.00, cat: 'cat-pizzas', img: img('1574071318508-1cdbab80d002') },
      { id: 'prod-005', name: 'Pizza Calabresa',     desc: 'Molho, mussarela, calabresa fatiada e cebola', price: 47.90, cost: 19.00, cat: 'cat-pizzas', img: img('1565299624946-b28f40a0ae38') },
      { id: 'prod-006', name: 'Pizza Portuguesa',    desc: 'Molho, mussarela, presunto, ovos e azeitonas', price: 52.90, cost: 21.00, cat: 'cat-pizzas', img: img('1513104890138-7c749659a591') },
      // Bebidas
      { id: 'prod-007', name: 'Coca-Cola 350ml',     desc: 'Refrigerante gelado lata', price: 7.90, cost: 3.00, cat: 'cat-bebidas', img: img('1554866585-cd94860890b7') },
      { id: 'prod-008', name: 'Suco de Laranja',     desc: 'Suco natural 400ml', price: 12.90, cost: 4.00, cat: 'cat-bebidas', img: img('1621506289937-a27a00e7aa61') },
      { id: 'prod-009', name: 'Água Mineral 500ml',  desc: 'Água mineral sem gás', price: 4.90, cost: 1.50, cat: 'cat-bebidas', img: img('1548839140-29a749e1cf4d') },
      // Sobremesas
      { id: 'prod-010', name: 'Pudim de Leite',      desc: 'Pudim cremoso com calda de caramelo', price: 14.90, cost: 5.00, cat: 'cat-sobremesas', img: img('1624353365286-6f6e9d2cc5e0') },
      { id: 'prod-011', name: 'Sorvete 2 Bolas',     desc: 'Escolha 2 sabores, cobertura à parte', price: 16.90, cost: 6.00, cat: 'cat-sobremesas', img: img('1560008581-09826d1de69e') },
      { id: 'prod-012', name: 'Brownie com Sorvete', desc: 'Brownie quente com sorvete de baunilha', price: 22.90, cost: 8.00, cat: 'cat-sobremesas', img: img('1606313564200-e75d5e394746') },
      // Salgados
      { id: 'prod-013', name: 'Coxinha de Frango',   desc: 'Coxinha crocante recheada com frango desfiado', price: 8.90, cost: 3.00, cat: 'cat-salgados', img: img('1604908177453-7462950a6a3b') },
      { id: 'prod-014', name: 'Esfiha de Carne',     desc: 'Esfiha fechada, massa macia, recheio temperado', price: 7.90, cost: 2.50, cat: 'cat-salgados', img: img('1511689915-b0f718c2cf2e') },
      { id: 'prod-015', name: 'Pastel de Queijo',    desc: 'Pastel crocante recheado com queijo mussarela', price: 9.90, cost: 3.50, cat: 'cat-salgados', img: img('1626200419199-391ae0eb3cfe') },
      // Massas
      { id: 'prod-016', name: 'Lasanha Bolonhesa',   desc: 'Lasanha gratinada com molho bolonhesa e béchamel', price: 38.90, cost: 15.00, cat: 'cat-massas', img: img('1619895092538-128341789043') },
      { id: 'prod-017', name: 'Espaguete ao Sugo',   desc: 'Espaguete com molho de tomate fresco e manjericão', price: 32.90, cost: 11.00, cat: 'cat-massas', img: img('1621996346565-ead4ee7b3de3') },
      { id: 'prod-018', name: 'Fettuccine Alfredo',  desc: 'Fettuccine com molho cremoso e parmesão', price: 36.90, cost: 13.00, cat: 'cat-massas', img: img('1563379091339-03b21ab4a4f8') },
      // Saladas
      { id: 'prod-019', name: 'Salada Caesar',       desc: 'Alface romana, croutons, parmesão e molho caesar', price: 24.90, cost: 8.00, cat: 'cat-saladas', img: img('1540420773420-3450942cabb7') },
      { id: 'prod-020', name: 'Salada Caprese',      desc: 'Tomate, mussarela de búfala, manjericão e azeite', price: 28.90, cost: 10.00, cat: 'cat-saladas', img: img('1592417817098-8fd3d3a40588') },
      { id: 'prod-021', name: 'Salada Grega',        desc: 'Pepino, tomate, azeitona preta, feta e orégano', price: 26.90, cost: 9.00, cat: 'cat-saladas', img: img('1529193591184-b1d58069ecdd') },
      // Carnes
      { id: 'prod-022', name: 'Picanha Grelhada',    desc: 'Picanha 300g grelhada com arroz e farofa', price: 79.90, cost: 35.00, cat: 'cat-carnes', img: img('1544025162-d76538b20714') },
      { id: 'prod-023', name: 'Frango Grelhado',     desc: 'Peito de frango grelhado com legumes', price: 42.90, cost: 16.00, cat: 'cat-carnes', img: img('1532550884008-b943a3ef1e37') },
      { id: 'prod-024', name: 'Costelinha BBQ',      desc: 'Costelinha suína ao molho barbecue com fritas', price: 64.90, cost: 28.00, cat: 'cat-carnes', img: img('1529193591184-b1d58069ecdd') },
      // Peixes
      { id: 'prod-025', name: 'Salmão Grelhado',     desc: 'Filé de salmão 200g grelhado com limão e ervas', price: 68.90, cost: 30.00, cat: 'cat-peixes', img: img('1519708227418-a8a551ddd806') },
      { id: 'prod-026', name: 'Tilápia ao Forno',    desc: 'Filé de tilápia 250g ao forno com alho e azeite', price: 48.90, cost: 20.00, cat: 'cat-peixes', img: img('1565680018434-b03b52b7a8b2') },
      { id: 'prod-027', name: 'Camarão ao Ajillo',   desc: 'Camarão médio ao ajillo com pão rústico', price: 72.90, cost: 32.00, cat: 'cat-peixes', img: img('1625943901889-bace8c2bd1b3') },
      // Caldos
      { id: 'prod-028', name: 'Caldo Verde',         desc: 'Caldo de couve, batata e linguiça calabresa', price: 22.90, cost: 8.00, cat: 'cat-caldos', img: img('1547592180-85f173d888e7') },
      { id: 'prod-029', name: 'Sopa de Cebola',      desc: 'Sopa clássica com croûtons e queijo gratinado', price: 24.90, cost: 9.00, cat: 'cat-caldos', img: img('1603105037259-952a59b2b1de') },
      { id: 'prod-030', name: 'Creme de Abóbora',    desc: 'Creme de abóbora com creme de leite e azeite', price: 21.90, cost: 7.00, cat: 'cat-caldos', img: img('1476718406336-6e4cc3a3f27b') },
      // Café
      { id: 'prod-031', name: 'Espresso',            desc: 'Café espresso curto e encorpado', price: 6.90, cost: 1.50, cat: 'cat-cafe', img: img('1510707577719-ae7c14805e3a') },
      { id: 'prod-032', name: 'Cappuccino',          desc: 'Espresso com leite vaporizado e espuma', price: 12.90, cost: 3.00, cat: 'cat-cafe', img: img('1534040385115-33943c78bf6d') },
      { id: 'prod-033', name: 'Latte Macchiato',     desc: 'Leite vaporizado com toque de espresso', price: 14.90, cost: 3.50, cat: 'cat-cafe', img: img('1556742393-d75f468bfcb0') },
      // Sucos
      { id: 'prod-034', name: 'Suco de Manga',       desc: 'Suco natural de manga 400ml', price: 13.90, cost: 4.50, cat: 'cat-sucos', img: img('1546173159-315724a31696') },
      { id: 'prod-035', name: 'Suco de Morango',     desc: 'Suco natural de morango 400ml', price: 14.90, cost: 5.00, cat: 'cat-sucos', img: img('1553279768-865429fa0078') },
      { id: 'prod-036', name: 'Vitamina de Banana',  desc: 'Vitamina de banana com leite 400ml', price: 11.90, cost: 3.50, cat: 'cat-sucos', img: img('1571771894821-ce9b6c11b08e') },
      // Açaí
      { id: 'prod-037', name: 'Açaí 300ml',          desc: 'Açaí puro batido 300ml', price: 18.90, cost: 7.00, cat: 'cat-acai', img: img('1590301157408-b3b4a6c4b1f8') },
      { id: 'prod-038', name: 'Açaí com Granola',    desc: 'Açaí 400ml com granola e mel', price: 24.90, cost: 9.00, cat: 'cat-acai', img: img('1511689915-b0f718c2cf2e') },
      { id: 'prod-039', name: 'Açaí com Frutas',     desc: 'Açaí 500ml com banana, morango e granola', price: 29.90, cost: 11.00, cat: 'cat-acai', img: img('1568901346423-7b7a1f89e39b') },
      // Combos
      { id: 'prod-040', name: 'Combo Individual',    desc: 'Hambúrguer + fritas + refrigerante 350ml', price: 39.90, cost: 16.00, cat: 'cat-combos', img: img('1550950158-d0ad627d2a42') },
      { id: 'prod-041', name: 'Combo Duplo',         desc: '2 Hambúrgueres + 2 fritas + 2 refrigerantes', price: 72.90, cost: 29.00, cat: 'cat-combos', img: img('1565299507177-b37ef9dba198') },
      { id: 'prod-042', name: 'Combo Família',       desc: '4 Hambúrgueres + 4 fritas + 2L refrigerante', price: 134.90, cost: 55.00, cat: 'cat-combos', img: img('1568901346423-7b7a1f89e39b') },
      // Kids
      { id: 'prod-043', name: 'Nuggets Kids',        desc: '6 nuggets de frango com molho e suco de caixinha', price: 22.90, cost: 8.00, cat: 'cat-kids', img: img('1597231702551-ca8b7f2d1a59') },
      { id: 'prod-044', name: 'Mini Hambúrguer',     desc: 'Hambúrguer pequeno com fritas e suco de caixinha', price: 24.90, cost: 9.00, cat: 'cat-kids', img: img('1550950158-d0ad627d2a42') },
      { id: 'prod-045', name: 'Macarrão Infantil',   desc: 'Macarrão ao sugo com frango grelhado e suco', price: 26.90, cost: 10.00, cat: 'cat-kids', img: img('1621996346565-ead4ee7b3de3') },
    ]

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
      })
    }

    return { categories: CATEGORIES.length, products: PRODUCTS.length, companyId: COMPANY_ID }
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
    const secret = this.configService.get<string>('JWT_SECRET') || 'secret';

    // Garante que o seed principal existe antes de clonar
    await this.runDemoSeed();

    const DEMOS = [
      {
        id:       'demo-basic-001',
        name:     'Demo BASIC — FoodSaaS',
        email:    'demo-basic@foodsaas.demo',
        password: 'DemoBasic@123',
        plan:     'BASIC',
        // Somente módulos do plano BASIC — financial/stock/recipes são bloqueados pelo ModuleGuard
        modules:  ['TABLES', 'CASH'],
      },
      {
        id:       'demo-pro-001',
        name:     'Demo PRO — FoodSaaS',
        email:    'demo-pro@foodsaas.demo',
        password: 'DemoPro@123',
        plan:     'PRO',
        modules:  ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY'],
      },
      {
        id:       'demo-enterprise-001',
        name:     'Demo ENTERPRISE — FoodSaaS',
        email:    'demo-enterprise@foodsaas.demo',
        password: 'DemoEnterprise@123',
        plan:     'ENTERPRISE',
        // ENTERPRISE tem wildcard no ModuleGuard — lista aqui garante visibilidade no sidebar
        modules:  ['TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY',
                   'BI', 'AI', 'LOYALTY', 'MARKETING', 'SMART_IMPORT', 'WHATSAPP'],
      },
    ];

    const results: any[] = [];

    for (const demo of DEMOS) {
      // 1. Empresa — garante arquivamento nulo e status ativo
      await this.prisma.company.upsert({
        where:  { id: demo.id },
        update: {
          name: demo.name, plan: demo.plan,
          subscriptionStatus: 'ACTIVE', isBlocked: false, archivedAt: null,
        },
        create: {
          id: demo.id, name: demo.name, email: demo.email,
          plan: demo.plan, subscriptionStatus: 'ACTIVE', isBlocked: false,
        },
      });

      // 2. Usuário DEMO (cria apenas se não existir)
      const hashed = await bcrypt.hash(demo.password, 10);
      const existingUser = await this.prisma.user.findUnique({ where: { email: demo.email } });
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
        data:  { active: false, status: 'INACTIVE' },
      });

      for (const mod of demo.modules) {
        const cmId = `cm-${mod.toLowerCase()}-${demo.id}`;
        await this.prisma.companyModule.upsert({
          where:  { id: cmId },
          update: {
            active: true, status: 'ACTIVE', activatedAt: new Date(),
            module: mod.toUpperCase(), moduleSlug: mod.toLowerCase(),
          },
          create: {
            id:          cmId,
            module:      mod.toUpperCase(),
            active:      true,
            moduleSlug:  mod.toLowerCase(),
            status:      'ACTIVE',
            activatedAt: new Date(),
            companyId:   demo.id,
          },
        });
      }

      // 4. Cardápio — clona do seed se empresa ainda não tem produtos
      const prodCount = await this.prisma.product.count({ where: { companyId: demo.id } });
      if (prodCount === 0) {
        await this.cloneMenu('company-seed-001', demo.id).catch(() => null);
      }

      // 5. Token de demonstração (365 dias)
      const user = await this.prisma.user.findUnique({ where: { email: demo.email } });
      const token = user
        ? await this.jwtService.signAsync(
            { sub: user.id, email: user.email, companyId: demo.id, role: 'DEMO' },
            { secret, expiresIn: '365d' },
          )
        : null;

      results.push({
        plan:      demo.plan,
        email:     demo.email,
        password:  demo.password,
        token,
        companyId: demo.id,
      });
    }

    return {
      message: '3 empresas de demonstração criadas/atualizadas.',
      demos:   results,
    };
  }
}
