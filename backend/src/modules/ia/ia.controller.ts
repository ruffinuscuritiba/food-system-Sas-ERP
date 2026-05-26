import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ia')
export class IaController {
  constructor(private ia: IaService) {}

  @Post('ask')
  ask(
    @Req() req: any,
    @Body() body: { question: string; conversationId?: string },
  ) {
    return this.ia.ask(req.user.companyId, req.user.sub, body.conversationId ?? null, body.question);
  }

  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.ia.listConversations(req.user.companyId);
  }

  @Get('conversations/:id')
  getConversation(@Req() req: any, @Param('id') id: string) {
    return this.ia.getConversation(req.user.companyId, id);
  }
}
