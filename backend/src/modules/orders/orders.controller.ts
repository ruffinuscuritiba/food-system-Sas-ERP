import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";

import { OrdersService } from "./orders.service";
import { LoyaltyService } from "../loyalty/loyalty.service";

// Definição manual do OrderStatus para evitar erro do Prisma
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED' | any;

// Importe os Guards e Decorators usando caminhos relativos
// Se as linhas vermelhas continuarem aqui, me avise onde fica a pasta 'common'
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "WAITER")
  create(@Body() body: any, @Request() req: any) {
    return this.service.create({
      ...body,
      companyId: req.user.companyId,
    });
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "KITCHEN", "CASHIER")
  updateStatus(
    @Param("id") id: string,
    @Body("status") status: OrderStatus,
    @Request() req: any
  ) {
    const companyId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.companyId;
    return this.service.updateStatus(id, status, req.user.id, companyId);
  }

  @Patch(":id/production-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "KITCHEN")
  updateProductionStatus(
    @Param("id") id: string,
    @Body("productionStatus") productionStatus: OrderStatus,
    @Request() req: any
  ) {
    const companyId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.companyId;
    return this.service.updateStatus(id, productionStatus, req.user.id, companyId);
  }

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
  dashboard(@Request() req: any) {
    console.log("USER DASHBOARD:", req.user);
    return this.service.dashboard(req.user.companyId);
  }

  // Public endpoint — no auth required (customer ordering from menu)
  @Post("public")
  async createPublic(@Body() body: any) {
    const {
      redeemPoints = 0,
      customerPhone,
      companyId,
      ...rest
    } = body;

    // Apply loyalty redemption if requested
    let loyaltyDiscount = 0;
    if (redeemPoints > 0 && customerPhone && companyId) {
      loyaltyDiscount = await this.loyaltyService.validateAndRedeem(
        customerPhone,
        companyId,
        redeemPoints,
      );
    }

    const rawTotal = Number(rest.total || 0);
    const finalTotal = Math.max(0, rawTotal - loyaltyDiscount);

    const order = await this.service.create({
      companyId,
      customerName: rest.customerName,
      customerPhone,
      deliveryAddress: rest.deliveryAddress,
      orderType: rest.orderType || 'DELIVERY',
      paymentMethod: rest.paymentMethod || 'PIX',
      items: rest.items,
      total: finalTotal,
      notes: rest.notes,
    });

    // Award points (fire-and-forget — never blocks the response)
    if (customerPhone && companyId) {
      this.loyaltyService
        .awardPoints(customerPhone, companyId, order.id, finalTotal)
        .catch(() => {});
    }

    return { ...order, loyaltyDiscount, loyaltyPointsEarned: Math.floor(finalTotal) };
  }
}
