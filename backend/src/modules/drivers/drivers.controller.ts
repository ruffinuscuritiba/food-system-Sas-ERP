import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles }      from '@/common/decorators/roles.decorator';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Get('me')
  myProfile(@Req() req: any) {
    return this.service.myProfile(req.user.userId);
  }

  @Get('me/orders')
  myOrders(@Req() req: any) {
    return this.service.myOrders(req.user.userId);
  }

  @Get('me/earnings')
  myEarnings(@Req() req: any) {
    return this.service.myEarnings(req.user.userId);
  }

  @Get('me/payments')
  myPayments(@Req() req: any) {
    return this.service.myPayments(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.companyId, body);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() body: { lat: number; lng: number }) {
    return this.service.updateLocation(id, body.lat, body.lng);
  }

  @Post('assign')
  assignOrder(@Body() body: { orderId: string; driverId: string }, @Req() req: any) {
    return this.service.assignOrder(body.orderId, body.driverId, req.user.companyId, req.user.userId);
  }

  // ── Earnings & Payments (admin) ──────────────────────────────────────────

  @Get(':id/earnings')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  listEarnings(@Param('id') id: string, @Req() req: any) {
    return this.service.listEarnings(id, req.user.companyId);
  }

  @Get(':id/payments')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  listPayments(@Param('id') id: string, @Req() req: any) {
    return this.service.listPayments(id, req.user.companyId);
  }

  @Post(':id/payments')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  createPayment(@Param('id') id: string, @Req() req: any) {
    return this.service.createPayment(id, req.user.companyId);
  }

  @Patch('payments/:paymentId/pay')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  payPayment(@Param('paymentId') paymentId: string, @Req() req: any) {
    return this.service.payPayment(paymentId, req.user.companyId);
  }
}
