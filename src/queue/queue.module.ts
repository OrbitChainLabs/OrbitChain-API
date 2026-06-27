import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_EMAIL,
  QUEUE_CONTRACT_EVENTS,
  QUEUE_ANALYTICS,
  QUEUE_EXPORT,
} from './queue.constants';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueMaintenanceService } from './queue-maintenance.service';
import { ContractEventsProcessor } from './contract-events.processor';

const DEAD_LETTER_SETTINGS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  // Keep a bounded number of failure records per queue so Redis doesn't grow forever.
  // Retain the most recent 1000 failed jobs for inspection.
  removeOnFail: 1000,
};

/** Registers Bull queues with dead-letter settings: email, contract-events, analytics, export */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_EMAIL, defaultJobOptions: DEAD_LETTER_SETTINGS },
      { name: QUEUE_CONTRACT_EVENTS, defaultJobOptions: DEAD_LETTER_SETTINGS },
      { name: QUEUE_ANALYTICS, defaultJobOptions: DEAD_LETTER_SETTINGS },
      { name: QUEUE_EXPORT, defaultJobOptions: DEAD_LETTER_SETTINGS },
    ),
    // ScheduleModule used for daily maintenance cron
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [QueueMaintenanceService, ContractEventsProcessor],
  exports: [BullModule],
})
export class QueueModule {}
