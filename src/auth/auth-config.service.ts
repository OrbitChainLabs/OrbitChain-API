import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Gets the JWT secret from the configuration.
   * Since we have validation at startup, we can safely assume it exists and is valid.
   */
  get jwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in configuration');
    }
    return secret;
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '15m');
  }

  get stellarRpcUrl(): string {
    return this.configService.get<string>('STELLAR_RPC_URL')!;
  }

  get stellarNetworkPassphrase(): string {
    return this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE')!;
  }

  get redisUrl(): string {
    return this.configService.get<string>('REDIS_URL')!;
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL')!;
  }
}
