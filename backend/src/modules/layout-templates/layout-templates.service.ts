import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class LayoutTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return (this.prisma as any).layoutTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateTemplateDto) {
    return (this.prisma as any).layoutTemplate.create({
      data: {
        name: dto.name,
        segment: dto.segment ?? 'CUSTOM',
        config: JSON.parse(JSON.stringify(dto.config)),
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async delete(id: string) {
    const tpl = await (this.prisma as any).layoutTemplate.findUnique({ where: { id } });
    if (!tpl) throw new NotFoundException('Template não encontrado');
    return (this.prisma as any).layoutTemplate.delete({ where: { id } });
  }

  /** Aplica um template a uma empresa: copia config.layoutConfig e campos simples. */
  async applyToCompany(templateId: string, companyId: string) {
    const tpl = await (this.prisma as any).layoutTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException('Template não encontrado');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const cfg = tpl.config as Record<string, unknown>;
    const extraData: Record<string, unknown> = {};
    if (cfg.layoutType) extraData.layoutType = cfg.layoutType;
    if (cfg.buttonRadius) extraData.buttonRadius = cfg.buttonRadius;

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(extraData as any),
        layoutConfig: JSON.parse(JSON.stringify(cfg)),
      },
      select: { id: true, name: true, layoutType: true, buttonRadius: true },
    });
  }

  /** Salva layoutConfig diretamente em uma empresa (usado pelo construtor). */
  async saveCompanyLayout(companyId: string, config: Record<string, unknown>) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const extraData: Record<string, unknown> = {};
    if (config.layoutType) extraData.layoutType = config.layoutType;
    if (config.buttonRadius) extraData.buttonRadius = config.buttonRadius;

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(extraData as any),
        layoutConfig: JSON.parse(JSON.stringify(config)),
      },
      select: { id: true, name: true, layoutType: true, buttonRadius: true },
    });
  }
}
