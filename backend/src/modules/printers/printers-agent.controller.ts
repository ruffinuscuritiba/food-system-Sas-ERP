import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PrintersService } from './printers.service';
import { PrintJobStatus } from '@prisma/client';

/**
 * Agent controller — rotas exclusivas para o agente de impressão (Electron app).
 * NÃO herda o @Roles do PrintersController principal — o agente autentica
 * via JWT (mesmo token do usuário) e só precisa de companyId, sem role check.
 */
@Controller('printers/agent')
@UseGuards(JwtAuthGuard)
export class PrintersAgentController {
  constructor(private service: PrintersService) {}

  @Post('heartbeat')
  agentPing(@Request() req: any) {
    return this.service.agentPing(req.user.companyId);
  }

  @Get('status')
  agentStatus(@Request() req: any) {
    return this.service.getAgentStatus(req.user.companyId);
  }

  @Get('jobs')
  agentGetPendingJobs(@Request() req: any) {
    return this.service.getPendingJobs(req.user.companyId);
  }

  @Patch('jobs/:id')
  agentClaimJob(
    @Param('id') id: string,
    @Body() body: { status: PrintJobStatus; failReason?: string },
    @Request() req: any,
  ) {
    return this.service.claimJob(id, req.user.companyId, body.status, body.failReason);
  }
}