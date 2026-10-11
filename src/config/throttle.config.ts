/**
 * Throttle (rate-limit) configuration (env-driven).
 * - ttl: sliding window length in MILLISECONDS.
 * - limit: max requests allowed per window, per client (keyed by IP).
 * Applied globally via ThrottlerGuard. Override per-route/controller with
 * @Throttle({ default: { limit, ttl } }) or exempt with @SkipThrottle().
 */
export const configThrottle = () => ({
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
  },
});
