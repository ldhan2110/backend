export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');

export interface RefreshTokenStore {
  save(userId: string, jti: string, tokenHash: string, ttlSec: number): Promise<void>;
  get(userId: string, jti: string): Promise<string | null>;
  del(userId: string, jti: string): Promise<void>;
  delAll(userId: string): Promise<void>;
}

export function refreshKey(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`;
}

// jti is a UUID, so it never collides with this sibling index key.
export function refreshIndexKey(userId: string): string {
  return `refresh:${userId}:index`;
}
