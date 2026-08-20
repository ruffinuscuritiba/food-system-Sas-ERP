import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SegmentSeedService } from '@/modules/segment-seed/segment-seed.service';

const COMPANY_ID = 'demo-conveniencia-001';
const EMAIL = 'demo-conveniencia@foodsaas.demo';
const PASSWORD = 'DemoConveniencia@123';

const ALL_MODULES = [
  'TABLES', 'CASH', 'FINANCIAL', 'STOCK', 'RECIPES', 'DELIVERY',
  'BI', 'AI', 'LOYALTY', 'MARKETING', 'SMART_IMPORT', 'WHATSAPP',
];

// Fotos reais só nos itens mais visíveis da vitrine (grid de bebidas/destaques
// do cardápio) — o resto do catálogo (SEGMENT_DATA.CONVENIENCIA) fica sem
// imagem, igual qualquer produto real cadastrado sem foto no app; não é o
// mesmo problema de "pizza aparecendo pra marmitaria" (categoria/produto
// errado), só ausência de foto.
const PRODUCT_IMAGES: Record<string, string> = {
  'Cerveja Long Neck 355ml':  'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&h=500&fit=crop&q=80',
  'Refrigerante Lata 350ml':  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&h=500&fit=crop&q=80',
  'Energético 250ml':         'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&h=500&fit=crop&q=80',
  'Chips de Batata 90g':      'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&h=500&fit=crop&q=80',
  'Água Mineral 500ml':       'https://images.unsplash.com/photo-1616118132534-381148898bb4?w=500&h=500&fit=crop&q=80',
};

/**
 * Ensina o 5º "assento" de demo comercial — Conveniência & Adega — reaproveitando
 * o catálogo já curado de SegmentSeedService (mesma fonte usada no seed real de
 * lojistas novos que escolhem esse segmento no cadastro), em vez de escrever um
 * conjunto de produtos duplicado só pra demo. Mesmo padrão idempotente de
 * SuperAdminService.initDemoCompanies() para as 4 contas originais, mas mantido
 * num service próprio: aquele método é caminho crítico (super-admin manual
 * "Seed Demo"/"Init Demos") e não deveria ganhar um 5º item hardcoded ali dentro.
 */
@Injectable()
export class DemoConvenienciaSeedService {
  private readonly logger = new Logger(DemoConvenienciaSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segmentSeed: SegmentSeedService,
  ) {}

  async ensure(): Promise<void> {
    const bcrypt = await import('bcrypt');

    await this.prisma.company.upsert({
      where: { id: COMPANY_ID },
      update: {
        name: 'Adega & Conveniência Point',
        plan: 'CONVENIENCIA',
        businessSegment: 'CONVENIENCIA',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
        archivedAt: null,
      },
      create: {
        id: COMPANY_ID,
        name: 'Adega & Conveniência Point',
        email: EMAIL,
        plan: 'CONVENIENCIA',
        businessSegment: 'CONVENIENCIA',
        subscriptionStatus: 'ACTIVE',
        isBlocked: false,
      },
    });

    const existingUser = await this.prisma.user.findUnique({ where: { email: EMAIL } });
    if (!existingUser) {
      const hashed = await bcrypt.hash(PASSWORD, 10);
      await this.prisma.user.create({
        data: {
          name: 'Demo Conveniência',
          email: EMAIL,
          password: hashed,
          role: 'DEMO' as any,
          isActive: true,
          companyId: COMPANY_ID,
        },
      });
    }

    for (const mod of ALL_MODULES) {
      const cmId = `cm-${mod.toLowerCase()}-${COMPANY_ID}`;
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
          companyId: COMPANY_ID,
        },
      });
    }

    // Idempotente por dentro: pula se a empresa já tiver categorias.
    await this.segmentSeed.seedForCompany(COMPANY_ID, 'CONVENIENCIA');

    for (const [name, url] of Object.entries(PRODUCT_IMAGES)) {
      await this.prisma.product.updateMany({
        where: { companyId: COMPANY_ID, name, imageUrl: null },
        data: { imageUrl: url },
      });
    }

    await this.prisma.companyTheme.upsert({
      where: { companyId: COMPANY_ID },
      update: { primaryColor: '#9f1239' },
      create: { companyId: COMPANY_ID, primaryColor: '#9f1239', darkMode: false },
    });

    this.logger.log('[DemoConvenienciaSeed] Conveniência demo ensured.');
  }
}
