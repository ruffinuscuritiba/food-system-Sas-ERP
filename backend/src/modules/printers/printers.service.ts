import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PrintJobStatus } from '@prisma/client';

@Injectable()
export class PrintersService {
  constructor(private prisma: PrismaService) {}

  // ── Printers ───────────────────────────────────────────────────────────────

  findAll(companyId: string) {
    return this.prisma.printer.findMany({
      where: { companyId },
      include: { profiles: true, _count: { select: { jobs: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(companyId: string, dto: CreatePrinterDto) {
    return this.prisma.printer.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, companyId: string, dto: Partial<CreatePrinterDto>) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.delete({ where: { id } });
  }

  async heartbeat(id: string, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.printer.update({
      where: { id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });
  }

  private async assertOwnership(id: string, companyId: string) {
    const p = await this.prisma.printer.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Impressora não encontrada');
  }

  // ── Profiles ───────────────────────────────────────────────────────────────

  findProfiles(companyId: string) {
    return this.prisma.printerProfile.findMany({
      where: { companyId },
      include: {
        printer: {
          select: { name: true, connectionType: true, isOnline: true },
        },
      },
    });
  }

  async upsertProfile(companyId: string, dto: CreateProfileDto) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: dto.printerId, companyId },
    });
    if (!printer) throw new ForbiddenException('Impressora fora da empresa');

    return this.prisma.printerProfile.upsert({
      where: { printerId_role: { printerId: dto.printerId, role: dto.role } },
      create: { ...dto, companyId },
      update: { isActive: dto.isActive ?? true },
    });
  }

  async removeProfile(id: string, companyId: string) {
    const p = await this.prisma.printerProfile.findFirst({
      where: { id, companyId },
    });
    if (!p) throw new NotFoundException('Perfil não encontrado');
    return this.prisma.printerProfile.delete({ where: { id } });
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  findJobs(companyId: string, status?: PrintJobStatus) {
    return this.prisma.printerJob.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { printer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateJobStatus(
    id: string,
    companyId: string,
    status: PrintJobStatus,
    failReason?: string,
  ) {
    const job = await this.prisma.printerJob.findFirst({
      where: { id, companyId },
    });
    if (!job) throw new NotFoundException('Job não encontrado');
    return this.prisma.printerJob.update({
      where: { id },
      data: {
        status,
        ...(status === 'PRINTED' ? { printedAt: new Date() } : {}),
        ...(failReason ? { failReason, attempts: { increment: 1 } } : {}),
      },
    });
  }

  // ── Enqueue (called by PrintService after order events) ────────────────────

  async enqueueJob(params: {
    companyId: string;
    printerId: string;
    orderId?: string;
    template: string;
    payload: object;
  }) {
    return this.prisma.printerJob.create({
      data: {
        companyId: params.companyId,
        printerId: params.printerId,
        orderId: params.orderId,
        template: params.template,
        payload: params.payload,
        status: 'PENDING',
      },
    });
  }
}
