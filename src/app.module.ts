import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppThrottlerModule } from './throttler/throttler.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ContractsModule } from './contracts/contracts.module';
import { DonationsModule } from './donations/donations.module';
import { HealthModule } from './health/health.module';
import { MilestonesModule } from './milestones/milestones.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { StellarModule } from './stellar/stellar.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AdminModule,
    ApiKeysModule,
    AppThrottlerModule,
    AuthModule,
    CampaignsModule,
    ContractsModule,
    DonationsModule,
    HealthModule,
    MilestonesModule,
    NotificationsModule,
    PlatformModule,
    PrismaModule,
    QueueModule,
    RedisModule,
    StellarModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
