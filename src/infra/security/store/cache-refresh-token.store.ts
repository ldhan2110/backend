import { Injectable } from '@nestjs/common';
import { CacheService } from '@infra/cache/services/cache.service';
import { RefreshTokenStore, refreshKey, refreshIndexKey } from './refresh-token.store';

interface IndexEntry {
  jti: string;
  exp: number; // epoch ms
}

@Injectable()
export class CacheRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly cache: CacheService) {}

  async save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void> {
    const ttlMs = ttlSec * 1000;
    await this.cache.set(refreshKey(userId, jti), tokenHash, ttlMs);
    await this.writeIndex(userId, (live) => [...live, { jti, exp: Date.now() + ttlMs }]);
  }

  async get(userId: string, jti: string): Promise<string | null> {
    return (await this.cache.get<string>(refreshKey(userId, jti))) ?? null;
  }

  async del(userId: string, jti: string): Promise<void> {
    await this.cache.del(refreshKey(userId, jti));
    await this.writeIndex(userId, (live) => live.filter((e) => e.jti !== jti));
  }

  async delAll(userId: string): Promise<void> {
    const key = refreshIndexKey(userId);
    const live = (await this.cache.get<IndexEntry[]>(key)) ?? [];
    await Promise.all(live.map((e) => this.cache.del(refreshKey(userId, e.jti))));
    await this.cache.del(key);
  }

  private async writeIndex(
    userId: string,
    update: (live: IndexEntry[]) => IndexEntry[],
  ): Promise<void> {
    const key = refreshIndexKey(userId);
    const now = Date.now();
    const current = ((await this.cache.get<IndexEntry[]>(key)) ?? []).filter((e) => e.exp > now);
    const next = update(current).filter((e) => e.exp > now);
    if (next.length === 0) {
      await this.cache.del(key);
      return;
    }
    const maxExp = Math.max(...next.map((e) => e.exp));
    await this.cache.set(key, next, maxExp - now);
  }
}
