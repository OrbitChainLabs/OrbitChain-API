import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_EMAIL,
  QUEUE_CONTRACT_EVENTS,
  QUEUE_ANALYTICS,
} from './queue.constants';

const DEAD_LETTER_SETTINGS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false,
};

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
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
