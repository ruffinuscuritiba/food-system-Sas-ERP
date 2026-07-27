import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { PrinterAgentGuard } from './printer-agent.guard';
import { PrintersService } from './printers.service';

/**
 * Agent controller — rotas exclusivas para o agente de impressão (Electron app).
 * NÃO herda o @Roles do PrintersController principal. Autentica via
 * PrinterAgentGuard: aceita o token dedicado do agente (nunca expira) OU um
 * JWT normal de sessão (fallback pra teste manual) — nos dois casos só
 * precisa de companyId, sem role check.
 */
@Controller('printers/agent')
@UseGuards(PrinterAgentGuard)
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

  // Polling/status de job real do agente vive em PrintersController
  // (GET /printers/jobs, PATCH /printers/jobs/:id/status) — são os caminhos
  // que o executável do agente de fato chama (printer-agent/index.js). Essas
  // 2 rotas aqui (printers/agent/jobs, printers/agent/jobs/:id) nunca foram
  // chamadas por ninguém — removidas pra não confundir com as reais.
}