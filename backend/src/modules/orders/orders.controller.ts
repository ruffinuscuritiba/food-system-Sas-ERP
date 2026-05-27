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

// Definição manual do OrderStatus para evitar erro do Prisma
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED' | any;

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
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
    return this.service.updateStatus(id, status, req.user.id);
  }

  @Patch(":id/production-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "KITCHEN")
  updateProductionStatus(
    @Param("id") id: string,
    @Body("productionStatus") productionStatus: OrderStatus,
    @Request() req: any
  ) {
    return this.service.updateStatus(id, productionStatus, req.user.id);
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
    const { customerPhone, companyId, ...rest } = body;

    const finalTotal = Number(rest.total || 0);

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

    return { ...order, loyaltyDiscount: 0, loyaltyPointsEarned: 0 };
  }
}
