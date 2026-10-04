import { Injectable } from '@nestjs/common';
import { RefreshTokenStore, refreshKey } from './refresh-token.store';

// ponytail: in-memory store, single-instance/dev only — set REDIS_URL for prod
@Injectable()
export class MemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly map = new Map<string, { hash: string; expiresAt: number }>();

  async save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void> {
    this.map.set(refreshKey(userId, jti), { hash: tokenHash, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async get(userId: string, jti: string): Promise<string | null> {
    const key = refreshKey(userId, jti);
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.hash;
  }

  async del(userId: string, jti: string): Promise<void> {
    this.map.delete(refreshKey(userId, jti));
  }

  async delAll(userId: string): Promise<void> {
    const prefix = refreshKey(userId, '');
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }
}
