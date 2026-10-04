import { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RefreshTokenStore, refreshKey } from './refresh-token.store';

export class RedisRefreshTokenStore implements RefreshTokenStore, OnModuleDestroy {
  constructor(private readonly client: Redis) {}

  async save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void> {
    await this.client.set(refreshKey(userId, jti), tokenHash, 'EX', ttlSec);
  }

  async get(userId: string, jti: string): Promise<string | null> {
    return this.client.get(refreshKey(userId, jti));
  }

  async del(userId: string, jti: string): Promise<void> {
    await this.client.del(refreshKey(userId, jti));
  }

  async delAll(userId: string): Promise<void> {
    const pattern = `${refreshKey(userId, '')}*`;
    const keys: string[] = [];
    for await (const batch of this.client.scanStream({ match: pattern, count: 100 })) {
      keys.push(...(batch as string[]));
    }
    if (keys.length) await this.client.del(...keys);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
