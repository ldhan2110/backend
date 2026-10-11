/** Name of the httpOnly cookie carrying the refresh token. */
export const REFRESH_COOKIE = 'refresh_token';

/**
 * Path the refresh cookie is scoped to — MUST equal the mounted refresh route
 * so the browser sends it back. URI versioning (main.ts) prefixes `/v1`, and the
 * controller is version '1', so the route is `/v1/auth/refresh`.
 */
export const REFRESH_COOKIE_PATH = '/v1/auth/refresh';
