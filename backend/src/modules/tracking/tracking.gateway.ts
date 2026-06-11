import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private ordersService: OrdersService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ??
        (client.handshake.query?.token as string);
      if (token) {
        const payload = this.jwtService.verify<{
          sub: string;
          companyId: string;
        }>(token);
        client.data = { userId: payload.sub, companyId: payload.companyId };
      }
    } catch {
      // public clients (customers tracking orders) connect without token — allowed
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Customer joins room to track an order
  @SubscribeMessage('track:order')
  handleTrackOrder(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`order:${orderId}`);
    client.emit('track:joined', { orderId });
  }

  // Driver registers presence (joins their own room)
  @SubscribeMessage('driver:register')
  handleDriverRegister(
    @MessageBody() driverId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`driver:${driverId}`);
    client.emit('driver:registered', { driverId });
  }

  // Driver sends GPS location — persists + broadcasts to tracking customers
  @SubscribeMessage('driver:location')
  async handleLocation(
    @MessageBody()
    payload: { driverId: string; orderId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { driverId, orderId, lat, lng } = payload;

    this.logger.log(
      `[GPS] driver=${driverId} order=${orderId} lat=${lat} lng=${lng}`,
    );

    // Persist to DB — failure is non-fatal (don't block broadcast)
    try {
      await this.prisma.driverProfile.update({
        where: { id: driverId },
        data: { currentLat: lat, currentLng: lng },
      });
    } catch (err: any) {
      this.logger.warn(`[GPS] DB persist failed for driver=${driverId}: ${err?.message}`);
    }

    // Broadcast to customers watching this order
    this.server.to(`order:${orderId}`).emit('driver:location', {
      lat,
      lng,
      driverId,
      timestamp: new Date().toISOString(),
    });
  }

  // Driver marks order as picked up
  @SubscribeMessage('driver:picked_up')
  async handlePickedUp(@MessageBody() payload: { orderId: string }) {
    this.logger.log(`[PICKUP] orderId=${payload.orderId}`);
    try {
      await this.prisma.order.update({
        where: { id: payload.orderId },
        data: { pickedUpAt: new Date() },
      });
    } catch (err: any) {
      this.logger.warn(`[PICKUP] DB update failed for order=${payload.orderId}: ${err?.message}`);
    }
    this.server
      .to(`order:${payload.orderId}`)
      .emit('order:picked_up', { orderId: payload.orderId });
  }

  // Driver marks order as delivered — routes through OrdersService (stock, socket, loyalty, audit)
  @SubscribeMessage('driver:delivered')
  async handleDelivered(
    @MessageBody() payload: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, companyId } = (client.data ?? {}) as {
      userId?: string;
      companyId?: string;
    };
    if (!userId || !companyId) {
      this.logger.warn(`[DELIVERED] rejected: no auth on socket client=${client.id}`);
      return;
    }

    this.logger.log(`[DELIVERED] orderId=${payload.orderId} userId=${userId} companyId=${companyId}`);

    try {
      await this.ordersService.updateStatus(
        payload.orderId,
        OrderStatus.DELIVERED,
        userId,
        companyId,
      );
      this.logger.log(`[DELIVERED] status updated OK — orderId=${payload.orderId}`);
    } catch (err: any) {
      this.logger.error(`[DELIVERED] updateStatus failed: ${err?.message}`, err?.stack);
    }
    this.server
      .to(`order:${payload.orderId}`)
      .emit('order:delivered', { orderId: payload.orderId });
  }
}
