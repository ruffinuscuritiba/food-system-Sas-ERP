import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService, LeadUpsertDto } from './leads.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  upsert(@Body() body: LeadUpsertDto): Promise<{ id: string } | null> {
    const dto: LeadUpsertDto = {
      sessionToken: String(body.sessionToken ?? '').slice(0, 100),
      name: body.name ? String(body.name).slice(0, 100) : undefined,
      company: body.company ? String(body.company).slice(0, 100) : undefined,
      whatsapp: body.whatsapp ? String(body.whatsapp).slice(0, 30) : undefined,
      recommendedPlan: body.recommendedPlan
        ? String(body.recommendedPlan).slice(0, 20)
        : undefined,
      conversationSummary: body.conversationSummary
        ? String(body.conversationSummary).slice(0, 1000)
        : undefined,
      waClicked: body.waClicked === true ? true : undefined,
    };
    return this.leads.upsert(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  findAll() {
    return this.leads.findAll();
  }
}
