import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { StellarModule } from './stellar/stellar.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DonationsModule } from './donations/donations.module';
import { AppThrottlerModule } from './throttler/throttler.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { StellarModule } from './stellar/stellar.module';
import { ContractsModule } from './contracts/contracts.module';
import { UsersModule } from './users/users.module';
import { MilestonesModule } from './milestones/milestones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    QueueModule,
    RedisModule,
    HealthModule,
    AuthModule,
    
    AdminModule,
    NotificationsModule,
    AppThrottlerModule,
    ApiKeysModule,
    CampaignsModule,
    DonationsModule,
    StellarModule,
    ContractsModule,
    UsersModule,
    MilestonesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
