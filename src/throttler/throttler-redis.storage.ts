import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class ThrottlerRedisStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const blockKey = `throttle_block:${throttlerName}:${key}`;
    const hitKey = `throttle_hits:${throttlerName}:${key}`;

    const blocked = await this.redis.get(blockKey);
    if (blocked) {
      const blockTtl = await this.redis.pttl(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.max(0, blockTtl),
      };
    }

    const pipeline = this.redis.pipeline();
    pipeline.incr(hitKey);
    pipeline.pttl(hitKey);
    const results = await pipeline.exec();

    const totalHits = results![0][1] as number;
    let timeToExpire = results![1][1] as number;

    if (totalHits === 1 || timeToExpire < 0) {
      await this.redis.pexpire(hitKey, ttl);
      timeToExpire = ttl;
    }

    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit) {
      isBlocked = true;
      const blockMs = blockDuration > 0 ? blockDuration : ttl;
      await this.redis.set(blockKey, '1', 'PX', blockMs);
      timeToBlockExpire = blockMs;
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}
