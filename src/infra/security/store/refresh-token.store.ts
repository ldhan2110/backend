export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');

/**
 * Stores rotating refresh tokens keyed by `refresh:{userId}:{jti}`.
 * Value is a hash of the token (never the token itself).
 */
export interface RefreshTokenStore {
  save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void>;
  get(userId: string, jti: string): Promise<string | null>;
  del(userId: string, jti: string): Promise<void>;
  delAll(userId: string): Promise<void>;
}

export function refreshKey(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`;
}
