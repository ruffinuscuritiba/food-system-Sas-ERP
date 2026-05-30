import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'

import { Server, Socket } from 'socket.io'

import { JwtService } from '@nestjs/jwt'

@WebSocketGateway({
  cors: { origin: '*' },
})
export class SocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string)

      if (!token) {
        // Public clients (e.g. customer order-status page) connect without a token.
        // They don't join any room so they never receive tenant-scoped events.
        return
      }

      const payload = this.jwtService.verify<{ companyId: string }>(token)

      if (payload?.companyId) {
        // Each company has its own room — events never cross tenant boundaries
        client.join(`company:${payload.companyId}`)
        client.data.companyId = payload.companyId
      }
    } catch {
      // Invalid token — treat as unauthenticated, don't disconnect
    }
  }

  handleDisconnect(_client: Socket) {
    // Room membership is cleaned up automatically by Socket.IO
  }

  emitOrderCreated(order: { companyId: string }) {
    this.server.to(`company:${order.companyId}`).emit('orderCreated', order)
  }

  emitKitchenUpdate(order: { companyId: string }) {
    this.server.to(`company:${order.companyId}`).emit('kitchenUpdate', order)
  }

  emitDashboardUpdate(companyId: string, data: unknown) {
    this.server.to(`company:${companyId}`).emit('dashboardUpdate', data)
  }

  emitTableUpdate(companyId: string, data: unknown) {
    this.server.to(`company:${companyId}`).emit('tableUpdate', data)
  }

  emitOnlineOrderPaid(companyId: string, data: unknown) {
    this.server.to(`company:${companyId}`).emit('onlineOrderPaid', data)
  }

  /**
   * Cliente público entra na room do próprio pedido para receber atualizações
   * de status em tempo real. Não precisa de token — orderId já é o "segredo".
   * Cliente conecta ao socket → emite 'joinOrder' com orderId → recebe
   * 'orderStatusChanged' quando a cozinha atualizar o pedido.
   */
  @SubscribeMessage('joinOrder')
  handleJoinOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.orderId) {
      client.join(`order:${data.orderId}`)
      return { ok: true, joined: `order:${data.orderId}` }
    }
    return { ok: false }
  }

  /**
   * Emit para a room específica do pedido (cliente público escutando).
   * Usado em updateKitchenStatus e criação de OnlineOrder.
   */
  emitOrderStatusChanged(orderId: string, payload: {
    status: string;
    source?: string;
    updatedAt?: string;
    [k: string]: unknown;
  }) {
    this.server.to(`order:${orderId}`).emit('orderStatusChanged', {
      orderId,
      ...payload,
      updatedAt: payload.updatedAt ?? new Date().toISOString(),
    })
  }
}
