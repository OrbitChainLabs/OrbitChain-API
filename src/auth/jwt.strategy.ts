import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfigService } from './auth-config.service';

/**
 * Passport JWT strategy for OrbitChain.
 * Validates tokens and extracts user info from the JWT payload.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(authConfig: AuthConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
    });
  }

  validate(payload: { sub: string; walletAddress: string }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    return { userId: payload.sub, walletAddress: payload.walletAddress };
  }
}
