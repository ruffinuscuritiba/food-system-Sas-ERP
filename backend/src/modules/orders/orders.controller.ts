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

// Importe os Guards e Decorators usando caminhos relativos
// Se as linhas vermelhas continuarem aqui, me avise onde fica a pasta 'common'
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("orders")
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

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
  createPublic(@Body() body: any) {
    return this.service.create({
      companyId: body.companyId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      deliveryAddress: body.deliveryAddress,
      orderType: body.orderType || 'DELIVERY',
      paymentMethod: body.paymentMethod || 'PIX',
      items: body.items,
      total: body.total,
    });
  }
}
