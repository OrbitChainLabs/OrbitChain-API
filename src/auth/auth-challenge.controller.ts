import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { Throttle } from '@nestjs/throttler';

interface ChallengeResponse {
  challenge: string;
}

/**
 * GET /auth/challenge?walletAddress=G...
 *
 * Returns a one-time challenge string for the client to sign with their
 * Stellar keypair. Format: `stellaraid:login:<nonce>:<timestamp>`
 */
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthChallengeController {
  @Get('challenge')
  getChallenge(
    @Query('walletAddress') walletAddress: string,
  ): ChallengeResponse {
    if (!walletAddress || !StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    const nonce = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const challenge = `stellaraid:login:${nonce}:${timestamp}`;

    return { challenge };
  }
}
