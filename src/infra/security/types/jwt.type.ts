/** Private claims (RFC 7519 §4.3) — any key/value, dev decides. */
export type CustomClaims = Record<string, unknown>;

export interface AccessPayload {
  sub: string;
  jti: string; // the paired refresh-token jti — lets logout revoke this session without the cookie
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export interface IssuedAccess {
  token: string;
  expiresAt: number; // epoch ms
}

export interface IssuedRefresh {
  token: string;
  jti: string;
  ttlSec: number;
  expiresAt: number; // epoch ms
}