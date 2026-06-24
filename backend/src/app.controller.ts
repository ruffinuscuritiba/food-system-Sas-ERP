import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    // Diagnóstico de canais — apenas booleanos (nunca expõe valores/segredos).
    const emailConfigured = !!(
      this.config.get<string>('SMTP_HOST') &&
      this.config.get<string>('SMTP_USER') &&
      this.config.get<string>('SMTP_PASS')
    );
    const waConfigured = !!(
      this.config.get<string>('EVOLUTION_API_URL') &&
      this.config.get<string>('EVOLUTION_API_KEY') &&
      this.config.get<string>('EVOLUTION_INSTANCE_NAME')
    );

    return {
      status: 'ok',
      service: 'food-system-backend',
      timestamp: new Date().toISOString(),
      channels: {
        email: emailConfigured,
        whatsapp: waConfigured,
      },
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
