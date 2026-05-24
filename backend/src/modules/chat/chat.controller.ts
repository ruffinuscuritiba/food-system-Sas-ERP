import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { ChatService, ChatMessage } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  /** Public — customer-facing chatbot, no auth required */
  @Post('message')
  async sendMessage(
    @Body()
    body: {
      companyId: string;
      messages: ChatMessage[];
    },
  ) {
    if (!body.companyId) throw new BadRequestException('companyId é obrigatório.');
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new BadRequestException('messages deve ser um array não vazio.');
    }

    const reply = await this.service.sendMessage(body.companyId, body.messages);
    return { reply };
  }
}
