import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/printers' })
export class PrintersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PrintersGateway.name);
  private readonly companyAgents = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      if (!token) return;
      const payload = this.jwtService.verify<{ companyId: string }>(token);
      if (payload?.companyId) {
        client.join(`company:${payload.companyId}`);
        client.data.companyId = payload.companyId;
        if (!this.companyAgents.has(payload.companyId)) {
          this.companyAgents.set(payload.companyId, new Set());
        }
        this.companyAgents.get(payload.companyId)!.add(client.id);
        this.logger.log(`Printer agent connected: company=${payload.companyId}`);
      }
    } catch {
      // Invalid token — ignore
    }
  }

  handleDisconnect(client: Socket) {
    const cid = (client.data as any)?.companyId;
    if (cid && this.companyAgents.has(cid)) {
      this.companyAgents.get(cid)!.delete(client.id);
      if (this.companyAgents.get(cid)!.size === 0) {
        this.companyAgents.delete(cid);
      }
    }
  }

  /** Notifica todos os agentes conectados de uma empresa sobre novos jobs. */
  notifyNewJobs(companyId: string) {
    this.server.to(`company:${companyId}`).emit('print:newJobs', { companyId });
  }
}