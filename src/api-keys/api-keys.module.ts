import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyGuard } from './api-key.guard';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';

/** Provides API key generation, revocation, and authentication middleware */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeyGuard, JwtAuthGuard],
  exports: [ApiKeyGuard],
})
export class ApiKeysModule {}
