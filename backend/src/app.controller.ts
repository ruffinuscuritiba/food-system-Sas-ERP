import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

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
      version: '2.0.0-payment-loyalty-chat',
      status: 'active',
      features: ['gateway', 'loyalty', 'chatbot', 'meta-pixel', 'ga4']
    };
  }

}
