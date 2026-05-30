import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: unknown }>();

    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: { select: { id: true, walletAddress: true, role: true } },
      },
    });

    if (!record || !record.isActive) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    request.user = {
      id: record.user.id,
      walletAddress: record.user.walletAddress,
      role: record.user.role,
      apiKeyId: record.id,
      scope: record.scope,
    };

    return true;
  }
}
