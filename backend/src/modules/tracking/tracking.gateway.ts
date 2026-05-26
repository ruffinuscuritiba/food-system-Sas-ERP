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
import { PrismaService } from '@/database/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`[Tracking] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Tracking] Client disconnected: ${client.id}`);
  }

  // Customer joins room to track an order
  @SubscribeMessage('track:order')
  handleTrackOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
    client.join(`order:${orderId}`);
    client.emit('track:joined', { orderId });
  }

  // Driver registers presence (joins their own room)
  @SubscribeMessage('driver:register')
  handleDriverRegister(@MessageBody() driverId: string, @ConnectedSocket() client: Socket) {
    client.join(`driver:${driverId}`);
    client.emit('driver:registered', { driverId });
  }

  // Driver sends GPS location — broadcasts to all customers tracking their active order
  @SubscribeMessage('driver:location')
  async handleLocation(
    @MessageBody() payload: { driverId: string; orderId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { driverId, orderId, lat, lng } = payload;

    // Persist to DB
    try {
      await this.prisma.driverProfile.update({
        where: { id: driverId },
        data: { currentLat: lat, currentLng: lng },
      });
    } catch {}

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
    try {
      await this.prisma.order.update({
        where: { id: payload.orderId },
        data: { pickedUpAt: new Date() },
      });
    } catch {}
    this.server.to(`order:${payload.orderId}`).emit('order:picked_up', { orderId: payload.orderId });
  }

  // Driver marks order as delivered
  @SubscribeMessage('driver:delivered')
  async handleDelivered(@MessageBody() payload: { orderId: string }) {
    try {
      await this.prisma.order.update({
        where: { id: payload.orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    } catch {}
    this.server.to(`order:${payload.orderId}`).emit('order:delivered', { orderId: payload.orderId });
  }
}
