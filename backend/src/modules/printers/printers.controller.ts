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
import { PrintersService } from './printers.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PrintJobStatus } from '@prisma/client';

@Controller('printers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class PrintersController {
  constructor(private service: PrintersService) {}

  // ── Printers ───────────────────────────────────────────────────────────────

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  create(@Body() dto: CreatePrinterDto, @Request() req: any) {
    return this.service.create(req.user.companyId, dto);
  }

  @Patch(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Request() req: any) {
    return this.service.heartbeat(id, req.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePrinterDto>,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.companyId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.companyId);
  }

  // ── Profiles ───────────────────────────────────────────────────────────────

  @Get('profiles')
  findProfiles(@Request() req: any) {
    return this.service.findProfiles(req.user.companyId);
  }

  @Post('profiles')
  upsertProfile(@Body() dto: CreateProfileDto, @Request() req: any) {
    return this.service.upsertProfile(req.user.companyId, dto);
  }

  @Delete('profiles/:id')
  removeProfile(@Param('id') id: string, @Request() req: any) {
    return this.service.removeProfile(id, req.user.companyId);
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  @Get('jobs')
  findJobs(@Request() req: any, @Query('status') status?: PrintJobStatus) {
    return this.service.findJobs(req.user.companyId, status);
  }

  @Patch('jobs/:id/status')
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
