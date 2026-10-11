/**
 * Cache configuration (env-driven).
 * - memoryMax: in-memory LRU size (max entries) before least-recently-used
 *   eviction. Only used when REDIS_URL is unset. Redis handles its own eviction.
 * - defaultTtl: fallback TTL in MILLISECONDS used when a cache write (set /
 *   getOrSet / @Cacheable) does not specify one.
 */
export const configCache = () => ({
  cache: {
    memoryMax: parseInt(process.env.CACHE_MEMORY_MAX || '1000'),
    defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '60000'),
  },
});
