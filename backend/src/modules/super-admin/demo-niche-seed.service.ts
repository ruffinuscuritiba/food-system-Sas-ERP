import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SegmentSeedService } from '@/modules/segment-seed/segment-seed.service';

const ALL_MODULES = [
  'TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY',
  'BI', 'AI', 'LOYALTY', 'MARKETING', 'SMART_IMPORT', 'WHATSAPP',
];

interface NicheDemoConfig {
  companyId: string;
  email: string;
  password: string;
  companyName: string;
  /** Chave em SEGMENT_DATA (segment-seed.service.ts) — catálogo já curado. */
  segment: string;
  primaryColor: string;
}

/**
 * 9 contas de demo comercial, uma por nicho, além das 5 já existentes
 * (basic/pro/enterprise = pizzarias, delivery = marmitaria, conveniência —
 * ver DemoConvenienciaSeedService). Reaproveita o mesmo catálogo curado de
 * SegmentSeedService usado no cadastro real de lojista novo, em vez de
 * escrever produtos duplicados só pra demo — mesma decisão já tomada pra
 * Conveniência. Fecha o gap de "nicho selecionado mostra produto de outro
 * negócio" pros 9 nichos que ainda caíam em pizza/marmita por padrão.
 */
export const NICHE_DEMO_CONFIGS: NicheDemoConfig[] = [
  { companyId: 'demo-hamburgueria-001', email: 'demo-hamburgueria@foodsaas.demo', password: 'DemoHamburgueria@123', companyName: 'Grelha & Cia Hamburgueria',     segment: 'HAMBURGUERIA', primaryColor: '#B91C1C' },
  { companyId: 'demo-lanchonete-001',   email: 'demo-lanchonete@foodsaas.demo',   password: 'DemoLanchonete@123',   companyName: 'Ponto do Lanche',                 segment: 'LANCHONETE',   primaryColor: '#B45309' },
  { companyId: 'demo-churrascaria-001', email: 'demo-churrascaria@foodsaas.demo', password: 'DemoChurrascaria@123', companyName: 'Espeto & Brasa Churrascaria',     segment: 'CHURRASCARIA', primaryColor: '#7C2D12' },
  { companyId: 'demo-hotdog-001',       email: 'demo-hotdog@foodsaas.demo',       password: 'DemoHotdog@123',       companyName: 'Dog House Lanches',               segment: 'HOT_DOG',      primaryColor: '#A16207' },
  { companyId: 'demo-padaria-001',      email: 'demo-padaria@foodsaas.demo',      password: 'DemoPadaria@123',      companyName: 'Padaria Trigo Dourado',           segment: 'PADARIA',      primaryColor: '#92400E' },
  { companyId: 'demo-confeitaria-001',  email: 'demo-confeitaria@foodsaas.demo',  password: 'DemoConfeitaria@123',  companyName: 'Doce Encanto Confeitaria',        segment: 'DOCERIA',      primaryColor: '#BE185D' },
  { companyId: 'demo-pastelaria-001',   email: 'demo-pastelaria@foodsaas.demo',   password: 'DemoPastelaria@123',   companyName: 'Pastelaria Sabor & Cia',          segment: 'PASTELARIA',   primaryColor: '#CA8A04' },
  { companyId: 'demo-acai-001',         email: 'demo-acai@foodsaas.demo',         password: 'DemoAcai@123',         companyName: 'Açaí Tropical Point',             segment: 'ACAI',         primaryColor: '#6D28D9' },
  { companyId: 'demo-mercado-001',      email: 'demo-mercado@foodsaas.demo',      password: 'DemoMercado@123',      companyName: 'Mercadinho Bom Preço',            segment: 'MERCADO',      primaryColor: '#1D4ED8' },
];

@Injectable()
export class DemoNicheSeedService {
  private readonly logger = new Logger(DemoNicheSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segmentSeed: SegmentSeedService,
  ) {}

  async ensureAll(): Promise<void> {
    for (const cfg of NICHE_DEMO_CONFIGS) {
      try {
        await this.ensureOne(cfg);
      } catch (err) {
        // Uma falha isolada (ex.: 1 empresa com dado inconsistente) nunca
        // deve impedir as outras 8 de serem garantidas nem derrubar o boot.
        this.logger.error(`[DemoNicheSeed] ${cfg.companyId} failed`, (err as Error)?.message ?? String(err));
      }
    }
    this.logger.log(`[DemoNicheSeed] ${NICHE_DEMO_CONFIGS.length} demos de nicho garantidas.`);
  }

  private async ensureOne(cfg: NicheDemoConfig): Promise<void> {
    const bcrypt = await import('bcrypt');

    await this.prisma.company.upsert({
      where: { id: cfg.companyId },
      update: {
        name: cfg.companyName,
        plan: cfg.segment,
        businessSegment: cfg.segment,
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
        archivedAt: null,
      },
      create: {
        id: cfg.companyId,
        name: cfg.companyName,
        email: cfg.email,
        plan: cfg.segment,
        businessSegment: cfg.segment,
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    });

    const existingUser = await this.prisma.user.findUnique({ where: { email: cfg.email } });
    if (!existingUser) {
      const hashed = await bcrypt.hash(cfg.password, 10);
      await this.prisma.user.create({
        data: {
          name: `Demo ${cfg.companyName}`,
          email: cfg.email,
          password: hashed,
          role: 'DEMO' as any,
          isActive: true,
          companyId: cfg.companyId,
        },
      });
    }

    for (const mod of ALL_MODULES) {
      const cmId = `cm-${mod.toLowerCase()}-${cfg.companyId}`;
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
          companyId: cfg.companyId,
        },
      });
    }

    // Idempotente por dentro: pula se a empresa já tiver categorias.
    await this.segmentSeed.seedForCompany(cfg.companyId, cfg.segment);

    await this.prisma.companyTheme.upsert({
      where: { companyId: cfg.companyId },
      update: { primaryColor: cfg.primaryColor },
      create: { companyId: cfg.companyId, primaryColor: cfg.primaryColor, darkMode: false },
    });
  }
}
