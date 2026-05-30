import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

interface VerifyDto {
  walletAddress: string;
  signedChallenge: string;
  challenge: string;
}

interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer' | 'bearer';
}

/**
 * POST /auth/verify
 *
 * Verifies the Ed25519 signature, upserts the user on first login (#225),
 * applies the admin-wallet allowlist (#222), and returns a signed JWT.
 */
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthVerifyController {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post('verify')
  async verify(@Body() dto: VerifyDto): Promise<AuthResponse> {
    const { walletAddress, signedChallenge, challenge } = dto;

    if (!walletAddress || !StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new BadRequestException('Invalid wallet address');
    }
    if (!signedChallenge || !challenge) {
      throw new BadRequestException('Missing signedChallenge or challenge');
    }

    const keypair = Keypair.fromPublicKey(walletAddress);
    const messageBytes = Buffer.from(challenge, 'utf8');
    const signatureBytes = Buffer.from(signedChallenge, 'base64');

    const valid = keypair.verify(messageBytes, signatureBytes);
    if (!valid) {
      throw new UnauthorizedException('Signature verification failed');
    }

    // Issue #222: resolve role from admin allowlist
    const adminWallets = this.config
      .get<string>('ADMIN_WALLETS', '')
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);

    const isAdmin = adminWallets.includes(walletAddress);
    const roleFromAllowlist: UserRole | undefined = isAdmin
      ? UserRole.ADMIN
      : undefined;

    // Issue #225: upsert user — create with defaults on first login
    const displayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      create: {
        walletAddress,
        displayName,
        role: roleFromAllowlist ?? UserRole.USER,
      },
      update: roleFromAllowlist ? { role: roleFromAllowlist } : {},
    });

    const role = roleFromAllowlist ?? user.role;

    const accessToken = this.jwt.sign({
      sub: user.id,
      walletAddress,
      role,
    });

    return { accessToken, tokenType: 'Bearer' };
  }
}
