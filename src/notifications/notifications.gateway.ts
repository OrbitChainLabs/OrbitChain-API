import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';

/**
 * WebSocket gateway providing real-time notification events.
 *
 * Authentication:
 * Clients must provide a JWT token via the `token` query parameter or
 * `auth.token` handshake option, e.g.:
 *   io('ws://localhost:3001', { auth: { token: '<JWT>' } })
 *
 * Upon connection the client is automatically subscribed to a private room
 * keyed by their userId, so events can be emitted to specific users.
 *
 * Emitted events:
 *   - `notification`    – a new in-app notification for the user
 *   - `donation_received` – a real-time donation alert for campaign creators
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized (namespace: /notifications)');
  }

  /**
   * Verify the JWT token on connection. Throws UnauthorizedException to
   * disconnect the client if the token is missing or invalid.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        throw new UnauthorizedException('Missing authentication token');
      }

      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'stellaraid-default-secret',
      );

      const payload = this.jwtService.verify(token, { secret });

      const userId = (payload as Record<string, unknown>).sub as string;
      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Subscribe the socket to a private room keyed by userId
      client.join(`user:${userId}`);
      // Store userId on the socket for disconnect handling
      (client as any).userId = userId;

      this.logger.log(`WebSocket client connected: user=${userId} socket=${client.id}`);
    } catch (error) {
      this.logger.warn(`WebSocket connection rejected: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client as any).userId ?? 'unknown';
    this.logger.log(`WebSocket client disconnected: user=${userId} socket=${client.id}`);
  }

  /**
   * Emit a generic notification event to a specific user's room.
   */
  emitNotification(userId: string, notification: Record<string, unknown>): void {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  /**
   * Emit a donation_received event to the campaign creator's room.
   */
  emitDonationReceived(
    userId: string,
    data: {
      donationId: string;
      amount: string;
      assetCode: string;
      donorName?: string;
      campaignId: string;
      campaignTitle: string;
    },
  ): void {
    this.server.to(`user:${userId}`).emit('donation_received', data);
  }
}
