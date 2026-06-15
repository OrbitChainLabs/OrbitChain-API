import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

interface ChallengeResponse {
  challenge: string;
}

/**
 * Issues Stellar wallet challenge strings for authentication.
 * Clients sign the challenge with their private key to prove wallet ownership.
 */
@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthChallengeController {
  @Get('challenge')
  @ApiOperation({ summary: 'Get authentication challenge for wallet address' })
  @ApiQuery({
    name: 'walletAddress',
    required: true,
    example: 'G...wallet-address',
  })
  @ApiResponse({ status: 200, description: 'Returns challenge string' })
  @ApiResponse({ status: 400, description: 'Invalid Stellar wallet address' })
  getChallenge(
    @Query('walletAddress') walletAddress: string,
  ): ChallengeResponse {
    if (!walletAddress || !StrKey.isValidEd25519PublicKey(walletAddress)) {
      throw new BadRequestException('Invalid Stellar wallet address');
    }

    const nonce = randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const challenge = `orbitchain:login:${nonce}:${timestamp}`;

    return { challenge };
  }
}
