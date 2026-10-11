import { CacheService } from '../services/cache.service';

// ponytail: service-locator shortcut. Method decorators run before DI exists, so
// @Cacheable cannot inject CacheService. CacheModule.onModuleInit sets this ref.
let cacheRef: CacheService | undefined;
export function setCacheRef(svc: CacheService): void {
  cacheRef = svc;
}

export interface CacheableOptions {
  /** TTL in milliseconds. Omitted → CACHE_DEFAULT_TTL. */
  ttl?: number;
  /** Override the auto key. Receives the method args array. */
  key?: (args: unknown[]) => string;
}

/**
 * Cache a method's result.
 *
 *   @Cacheable()                                              // default TTL
 *   @Cacheable({ ttl: 300_000 })                              // key: Class.method(args)
 *   @Cacheable({ ttl: 300_000, key: a => `user:${a[0]}` })   // explicit key
 *
 * Works on any method. Fail-open: if the cache is unavailable the method runs
 * normally (see CacheService).
 */
export function Cacheable(options: CacheableOptions = {}): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    const label = `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = function (...args: unknown[]) {
      if (!cacheRef) return original.apply(this, args);
      const key = options.key ? options.key(args) : `${label}(${JSON.stringify(args)})`;
      return cacheRef.getOrSet(key, options.ttl, () => original.apply(this, args));
    };

    return descriptor;
  };
}
