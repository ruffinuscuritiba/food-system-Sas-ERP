import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService, ChatMessage } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  /** Standard (non-streaming) — kept for backward compat */
  @Post('message')
  async sendMessage(
    @Body() body: { companyId: string; messages: ChatMessage[]; sessionId?: string },
  ) {
    if (!body.companyId) throw new BadRequestException('companyId é obrigatório.');
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new BadRequestException('messages deve ser um array não vazio.');
    }
    const reply = await this.service.sendMessage(body.companyId, body.messages, body.sessionId);
    return { reply };
  }

  /** SSE streaming — ChatWidget uses this */
  @Post('stream')
  async streamMessage(
    @Body() body: { companyId: string; messages: ChatMessage[]; sessionId?: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.companyId || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ message: 'companyId e messages são obrigatórios.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // CORS headers são gerenciados pelo middleware global (não sobreescrever aqui)
    res.flushHeaders();

    await this.service.streamMessage(body.companyId, body.messages, body.sessionId, res);
    res.end();
  }
}
