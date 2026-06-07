import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { DriversService } from './drivers.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly service: DriversService) {}

  // ── Admin endpoints ──────────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  // ── Me endpoints (driver self-service) — must be BEFORE /:id ────────────

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

  @Get('me/available')
  availableOrders(@Req() req: any) {
    return this.service.availableOrders(req.user.userId);
  }

  @Patch('me/location')
  updateMyLocation(@Body() body: UpdateLocationDto, @Req() req: any) {
    return this.service.updateMyLocation(req.user.userId, body.lat, body.lng);
  }

  @Post('me/accept/:orderId')
  @HttpCode(200)
  acceptOrder(@Param('orderId') orderId: string, @Req() req: any) {
    return this.service.acceptOrder(req.user.userId, orderId);
  }

  // ── Admin: single driver / CRUD ──────────────────────────────────────────

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.companyId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.companyId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.companyId, body);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateLocation(@Param('id') id: string, @Body() body: UpdateLocationDto) {
    return this.service.updateLocation(id, body.lat, body.lng);
  }

  @Post('assign')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  assignOrder(@Body() body: { orderId: string; driverId: string }, @Req() req: any) {
    return this.service.assignOrder(body.orderId, body.driverId, req.user.companyId, req.user.userId);
  }

  // ── Admin: earnings & payments ───────────────────────────────────────────

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
