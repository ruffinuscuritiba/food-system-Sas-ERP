import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface LeadUpsertDto {
  sessionToken: string;
  name?: string;
  company?: string;
  whatsapp?: string;
  recommendedPlan?: string;
  conversationSummary?: string;
  waClicked?: boolean;
}

export interface LeadStats {
  total: number;
  novos: number;
  qualificados: number;
  contatados: number;
  perdidos: number;
  waClicked: number;
  porPlano: { BASIC: number; PRO: number; ENTERPRISE: number };
}

function resolveStatus(currentStatus: string | undefined, dto: LeadUpsertDto): string {
  const qualifies = !!(dto.recommendedPlan || dto.whatsapp);
  if (!currentStatus) return qualifies ? 'QUALIFICADO' : 'NOVO';
  // Never downgrade from CONTATADO/PERDIDO; upgrade NOVO → QUALIFICADO
  if (currentStatus === 'NOVO' && qualifies) return 'QUALIFICADO';
  return currentStatus;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private prisma: PrismaService) {}

  async upsert(dto: LeadUpsertDto): Promise<{ id: string } | null> {
    // Do not persist anonymous sessions with no qualifying data
    if (!dto.name && !dto.company && !dto.whatsapp && !dto.recommendedPlan && !dto.waClicked) {
      return null;
    }

    const existing = await this.prisma.lead.findUnique({
      where: { sessionToken: dto.sessionToken },
      select: { id: true, status: true, waClickedAt: true },
    });

    const newStatus = resolveStatus(existing?.status, dto);

    const lead = await this.prisma.lead.upsert({
      where: { sessionToken: dto.sessionToken },
      create: {
        sessionToken: dto.sessionToken,
        name: dto.name,
        company: dto.company,
        whatsapp: dto.whatsapp,
        recommendedPlan: dto.recommendedPlan,
        conversationSummary: dto.conversationSummary,
        status: newStatus,
        ...(dto.waClicked && { waClickedAt: new Date() }),
      },
      update: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.recommendedPlan !== undefined && { recommendedPlan: dto.recommendedPlan }),
        ...(dto.conversationSummary !== undefined && { conversationSummary: dto.conversationSummary }),
        // First-touch: only set waClickedAt once (attribution)
        ...(dto.waClicked && !existing?.waClickedAt && { waClickedAt: new Date() }),
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // Trigger follow-up only when a lead first becomes QUALIFICADO
    const wasUnqualifiedBefore = !existing || existing.status === 'NOVO';
    if (newStatus === 'QUALIFICADO' && wasUnqualifiedBefore) {
      this.triggerFollowUp(lead);
    }

    return { id: lead.id };
  }

  // Structured log — architecture ready for WhatsApp/E-mail/CRM dispatch
  private triggerFollowUp(lead: {
    id: string;
    name: string | null;
    company: string | null;
    whatsapp: string | null;
    recommendedPlan: string | null;
    conversationSummary: string | null;
  }): void {
    this.logger.log(
      JSON.stringify({
        event: 'LEAD_QUALIFIED',
        leadId: lead.id,
        nome: lead.name ?? '—',
        empresa: lead.company ?? '—',
        whatsapp: lead.whatsapp ?? '—',
        plano: lead.recommendedPlan ?? '—',
        resumo: lead.conversationSummary?.slice(0, 200) ?? '—',
        // TODO(follow-up): dispatch via WhatsApp / E-mail / CRM when integrated
      }),
    );
  }

  findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(): Promise<LeadStats> {
    const [total, byStatus, byPlan, waClicked] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['recommendedPlan'], _count: { _all: true } }),
      this.prisma.lead.count({ where: { waClickedAt: { not: null } } }),
    ]);

    const sm: Record<string, number> = {};
    for (const r of byStatus) sm[r.status] = r._count._all;

    const pm: Record<string, number> = {};
    for (const r of byPlan) {
      if (r.recommendedPlan) pm[r.recommendedPlan] = r._count._all;
    }

    return {
      total,
      novos: sm['NOVO'] ?? 0,
      qualificados: sm['QUALIFICADO'] ?? 0,
      contatados: sm['CONTATADO'] ?? 0,
      perdidos: sm['PERDIDO'] ?? 0,
      waClicked,
      porPlano: {
        BASIC: pm['BASIC'] ?? 0,
        PRO: pm['PRO'] ?? 0,
        ENTERPRISE: pm['ENTERPRISE'] ?? 0,
      },
    };
  }
}
