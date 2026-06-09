import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IaService, DemoMessage, LeadInfo } from './ia.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ia')
export class IaController {
  constructor(private ia: IaService) {}

  // ─── Public: commercial platform demo (no auth) ──────────────────────────
  @Post('platform-demo')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async platformDemo(
    @Body()
    body: {
      messages?: { role: string; content: string }[];
      leadInfo?: LeadInfo;
    },
    @Res() res: Response,
  ): Promise<void> {
    const messages: DemoMessage[] = (
      Array.isArray(body?.messages) ? body.messages : []
    )
      .slice(0, 50)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        content: String(m.content ?? '').slice(0, 2000),
      }));

    const leadInfo: LeadInfo | undefined = body?.leadInfo
      ? {
          name: String(body.leadInfo.name ?? '').slice(0, 100) || undefined,
          company:
            String(body.leadInfo.company ?? '').slice(0, 100) || undefined,
          phone: String(body.leadInfo.phone ?? '').slice(0, 30) || undefined,
        }
      : undefined;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.ia.streamPlatformDemo(messages, res, leadInfo);
    res.end();
  }

  // ─── Authenticated endpoints ─────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('ask')
  ask(
    @Req() req: any,
    @Body() body: { question: string; conversationId?: string },
  ) {
    return this.ia.ask(
      req.user.companyId,
      req.user.sub,
      body.conversationId ?? null,
      body.question,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  listConversations(@Req() req: any) {
    return this.ia.listConversations(req.user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  getConversation(@Req() req: any, @Param('id') id: string) {
    return this.ia.getConversation(req.user.companyId, id);
  }
}
