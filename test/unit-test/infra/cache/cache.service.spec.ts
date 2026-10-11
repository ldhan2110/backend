import { ConfigService } from '@nestjs/config';
import { KeyvCacheableMemory } from 'cacheable';
import { createCache, type Cache } from 'cache-manager';
import { Keyv } from 'keyv';
import { Cacheable, setCacheRef } from '@infra/cache/decorators/cache.decorator';
import { CacheService } from '@infra/cache/services/cache.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge dual-package Keyv type identities (test only)
const memCache = (lruSize = 100) =>
  createCache({ stores: [new Keyv({ store: new KeyvCacheableMemory({ lruSize }) }) as any] });
const cfg = { get: () => 60_000 } as unknown as ConfigService;
const makeService = (c: Cache) => new CacheService(c, cfg);

describe('CacheService (in-memory LRU backend)', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = makeService(memCache());
  });

  it('set → get roundtrips a typed object', async () => {
    await cache.set('u:1', { id: 1, name: 'a' }, 60_000);
    expect(await cache.get<{ id: number; name: string }>('u:1')).toEqual({ id: 1, name: 'a' });
  });

  it('returns undefined on miss', async () => {
    expect(await cache.get('nope')).toBeUndefined();
  });

  it('expires after ttl', async () => {
    await cache.set('k', 'v', 20);
    await sleep(40);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('LRU-evicts when over size', async () => {
    const c = makeService(memCache(2));
    await c.set('a', 1, 60_000);
    await c.set('b', 2, 60_000);
    await c.set('c', 3, 60_000); // lruSize=2 → 'a' evicted
    expect(await c.get('a')).toBeUndefined();
    expect(await c.get('c')).toBe(3);
  });

  it('getOrSet runs factory once, then hits cache', async () => {
    let calls = 0;
    const factory = async () => { calls++; return 42; };
    expect(await cache.getOrSet('x', 60_000, factory)).toBe(42);
    expect(await cache.getOrSet('x', 60_000, factory)).toBe(42);
    expect(calls).toBe(1);
  });

  it('fail-open: backend throwing → getOrSet still returns factory value', async () => {
    const broken = {
      get: async () => { throw new Error('down'); },
      set: async () => { throw new Error('down'); },
      del: async () => false,
      wrap: async () => { throw new Error('down'); },
    } as unknown as Cache;
    const c = makeService(broken);
    expect(await c.getOrSet('x', 60_000, async () => 'real')).toBe('real');
  });
});

describe('@Cacheable', () => {
  it('caches a method result', async () => {
    setCacheRef(makeService(memCache()));
    let calls = 0;

    class Svc {
      @Cacheable({ ttl: 60_000 })
      async compute(n: number): Promise<number> {
        calls++;
        return n * 2;
      }
    }

    const svc = new Svc();
    expect(await svc.compute(21)).toBe(42);
    expect(await svc.compute(21)).toBe(42);
    expect(calls).toBe(1);
  });
});
