import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthChallengeController } from './auth-challenge.controller';
import { AuthVerifyController } from './auth-verify.controller';
import { AuthConfigService } from './auth-config.service';
import { JwtStrategy } from './jwt.strategy';

/** Module providing Stellar wallet challenge-response authentication and JWT issuance */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [AuthConfigService],
      useFactory: (authConfig: AuthConfigService) => ({
        secret: authConfig.jwtSecret,
        signOptions: { expiresIn: authConfig.jwtExpiresIn },
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthChallengeController, AuthVerifyController],
  providers: [AuthConfigService, JwtStrategy],
  exports: [JwtModule, AuthConfigService],
})
export class AuthModule {}
