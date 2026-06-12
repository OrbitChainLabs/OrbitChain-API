import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Passport JWT strategy for OrbitChain.
 * Validates tokens and extracts user info from the JWT payload.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  validate(payload: { sub: string; walletAddress: string }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    return { userId: payload.sub, walletAddress: payload.walletAddress };
  }
}