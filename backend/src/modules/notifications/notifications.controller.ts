import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async send(
    @Body() body: { to: string; type: string; data?: Record<string, any> },
  ) {
    await this.service.send({
      to: body.to,
      type: body.type as any,
      data: body.data,
    });
    return { success: true, message: `Notification sent to ${body.to}` };
  }
}
