import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface LeadUpsertDto {
  sessionToken: string;
  name?: string;
  company?: string;
  whatsapp?: string;
  recommendedPlan?: string;
  conversationSummary?: string;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: LeadUpsertDto): Promise<{ id: string }> {
    const lead = await this.prisma.lead.upsert({
      where: { sessionToken: dto.sessionToken },
      create: {
        sessionToken: dto.sessionToken,
        name: dto.name,
        company: dto.company,
        whatsapp: dto.whatsapp,
        recommendedPlan: dto.recommendedPlan,
        conversationSummary: dto.conversationSummary,
      },
      update: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.recommendedPlan !== undefined && { recommendedPlan: dto.recommendedPlan }),
        ...(dto.conversationSummary !== undefined && { conversationSummary: dto.conversationSummary }),
        updatedAt: new Date(),
      },
    });
    return { id: lead.id };
  }

  findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
