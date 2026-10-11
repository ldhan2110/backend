import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

/**
 * Standard cache. Inject anywhere (CacheModule is @Global).
 *
 *   const user = await cache.getOrSet(`user:${id}`, 300_000, () => repo.findById(id));
 *
 * Thin typed wrapper over cache-manager's CACHE_MANAGER: adds generics, a stable
 * getOrSet name, and fail-open behaviour (any backend error = cache miss, logged
 * at warn; this layer never throws).
 *
 * TTL is in MILLISECONDS (cache-manager's unit). Values must be JSON-serializable
 * (the default store serializes via Keyv — Date comes back as string, class
 * instances as plain objects).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    config: ConfigService,
  ) {
    this.defaultTtl = config.get<number>('cache.defaultTtl') ?? 60_000;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cache.get<T>(key)) ?? undefined;
    } catch (err) {
      this.logger.warn(`cache get failed for "${key}": ${err}`);
      return undefined;
    }
  }

  async set<T>(key: string, val: T, ttlMs?: number): Promise<void> {
    try {
      await this.cache.set(key, val, ttlMs ?? this.defaultTtl);
    } catch (err) {
      this.logger.warn(`cache set failed for "${key}": ${err}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (err) {
      this.logger.warn(`cache del failed for "${key}": ${err}`);
    }
  }

  async getOrSet<T>(key: string, ttlMs: number | undefined, factory: () => Promise<T>): Promise<T> {
    // ponytail: get-then-set, not cache-manager's wrap() — wrap() doesn't dedupe
    // reliably across stores in v7. Not atomic: concurrent misses both run the
    // factory (cache stampede). Fine for a cache; add a lock only if a hot key
    // measurably hammers the origin. get/set are fail-open, so this is too.
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const val = await factory();
    await this.set(key, val, ttlMs);
    return val;
  }
}
