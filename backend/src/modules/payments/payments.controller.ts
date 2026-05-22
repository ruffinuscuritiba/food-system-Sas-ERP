import {
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @Body()
    body: {
      companyId: string;
      plan: string;
      provider: 'MERCADOPAGO' | 'STRIPE';
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    return this.service.createCheckout(body);
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  activate(@Body() body: { companyId: string; plan: string }) {
    return this.service.activateSubscription(body.companyId, body.plan);
  }

  @Post('webhook/mercadopago')
  webhookMercadoPago(@Body() body: any) {
    return this.service.handleWebhookMercadoPago(body);
  }

  @Post('webhook/stripe')
  webhookStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
    return this.service.handleWebhookStripe(rawBody, signature);
  }
}
