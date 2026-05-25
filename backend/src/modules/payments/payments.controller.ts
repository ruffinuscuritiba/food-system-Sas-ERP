import {
  Body, Controller, Get, Headers, Param, Post, Query,
  RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // ─── Subscription ──────────────────────────────────────────────────────────

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(@Body() body: { companyId: string; plan: string; provider: 'MERCADOPAGO' | 'STRIPE'; successUrl?: string; cancelUrl?: string }) {
    return this.service.createCheckout(body);
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  activate(@Body() body: { companyId: string; plan: string }) {
    return this.service.activateSubscription(body.companyId, body.plan);
  }

  // ─── Online order PIX ──────────────────────────────────────────────────────

  /** Public — generate PIX for an online order */
  @Post('online-order/:id/pix')
  createOnlinePix(
    @Param('id') id: string,
    @Body('companyId') companyId: string,
  ) {
    return this.service.createOnlinePix(id, companyId);
  }

  /** Public — poll payment status */
  @Get('status/:id')
  getStatus(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.getOnlinePaymentStatus(id, companyId);
  }

  // ─── Webhooks ──────────────────────────────────────────────────────────────

  /** Webhook for online orders (PIX) */
  @Post('webhook/online-order')
  webhookOnlineOrder(@Body() body: any, @Query() query: any) {
    return this.service.handleOnlineOrderWebhook(body, query);
  }

  /** Webhook for subscription plans */
  @Post('webhook/mercadopago')
  webhookMercadoPago(@Body() body: any) {
    return this.service.handleWebhookMercadoPago(body);
  }

  /** Legacy — PDV order checkout */
  @Post('order-checkout')
  createOrderCheckout(@Body() body: { orderId: string; companyId: string }) {
    return this.service.createOrderCheckout(body);
  }

  @Post('webhook/order')
  webhookOrder(@Body() body: any) {
    return this.service.handleOrderWebhook(body);
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
