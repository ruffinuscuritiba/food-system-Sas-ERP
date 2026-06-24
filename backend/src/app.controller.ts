import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // NOTE: /api/health é interceptado pelo middleware em main.ts (antes do
  // roteador Nest) — este handler não é alcançado. O diagnóstico de canais
  // (email/whatsapp) fica no main.ts. Mantido por compatibilidade.
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'food-system-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('version')
  getVersion() {
    return {
      version: '3.0.0-complete',
      status: 'active',
      features: ['gateway', 'loyalty', 'chatbot', 'meta-pixel', 'ga4'],
    };
  }
}
