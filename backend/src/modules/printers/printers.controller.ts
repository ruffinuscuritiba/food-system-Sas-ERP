import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { PrinterAgentGuard } from './printer-agent.guard';
import { PrintersService } from './printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PrintJobStatus } from '@prisma/client';

// Guards aplicados por método (não na classe): as rotas de job (GET jobs,
// PATCH jobs/:id/status) são as que o printer-agent.exe realmente chama —
// precisam aceitar o token dedicado do agente (PrinterAgentGuard), não só
// JWT de admin. O resto do controller (CRUD de impressoras/perfis) continua
// admin-only.
@Controller('printers')
export class PrintersController {
  constructor(private service: PrintersService) {}

  // ── Printers ───────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() dto: CreatePrinterDto, @Request() req: any) {
    return this.service.create(req.user.companyId, dto);
  }

  // Token dedicado do Printer Agent — não expira, diferente do JWT de sessão
  // que era mostrado antes (7 dias, quebrava o agente silenciosamente).
  @Get('agent-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getAgentToken(@Request() req: any) {
    const token = await this.service.getOrCreateAgentToken(req.user.companyId);
    return { token };
  }

  @Patch(':id/heartbeat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  heartbeat(@Param('id') id: string, @Request() req: any) {
    return this.service.heartbeat(id, req.user.companyId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePrinterDto>,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }

  // ── Profiles ───────────────────────────────────────────────────────────────

  @Get('profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findProfiles(@Request() req: any) {
    return this.service.findProfiles(req.user.companyId);
  }

  @Post('profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  upsertProfile(@Body() dto: CreateProfileDto, @Request() req: any) {
    return this.service.upsertProfile(req.user.companyId, dto);
  }

  @Delete('profiles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  removeProfile(@Param('id') id: string, @Request() req: any) {
    return this.service.removeProfile(id, req.user.companyId);
  }

  // ── Jobs (chamadas reais do printer-agent.exe) ──────────────────────────────

  @Get('jobs')
  @UseGuards(PrinterAgentGuard)
  findJobs(@Request() req: any, @Query('status') status?: PrintJobStatus) {
    return this.service.findJobs(req.user.companyId, status);
  }

  @Patch('jobs/:id/status')
  @UseGuards(PrinterAgentGuard)
  updateJobStatus(
    @Param('id') id: string,
    @Body() body: { status: PrintJobStatus; failReason?: string },
    @Request() req: any,
  ) {
    return this.service.updateJobStatus(
      id,
      req.user.companyId,
      body.status,
      body.failReason,
    );
  }
}
