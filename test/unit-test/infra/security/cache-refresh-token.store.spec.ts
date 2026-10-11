import { ConfigService } from '@nestjs/config';
import { KeyvCacheableMemory } from 'cacheable';
import { createCache } from 'cache-manager';
import { Keyv } from 'keyv';
import { CacheService } from '@infra/cache/services/cache.service';
import { CacheRefreshTokenStore } from '@infra/security/store/cache-refresh-token.store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge dual-package Keyv type identities (test only)
const memCache = () => createCache({ stores: [new Keyv({ store: new KeyvCacheableMemory({ lruSize: 100 }) }) as any] });
const cfg = { get: () => 60_000 } as unknown as ConfigService;

describe('CacheRefreshTokenStore', () => {
  let store: CacheRefreshTokenStore;

  beforeEach(() => {
    store = new CacheRefreshTokenStore(new CacheService(memCache(), cfg));
  });

  it('save → get roundtrips the hash', async () => {
    await store.save('u1', 'j1', 'hash1', 60);
    expect(await store.get('u1', 'j1')).toBe('hash1');
  });

  it('get returns null on miss', async () => {
    expect(await store.get('u1', 'nope')).toBeNull();
  });

  it('del revokes one token, leaves the others', async () => {
    await store.save('u1', 'j1', 'h1', 60);
    await store.save('u1', 'j2', 'h2', 60);
    await store.del('u1', 'j1');
    expect(await store.get('u1', 'j1')).toBeNull();
    expect(await store.get('u1', 'j2')).toBe('h2');
  });

  it('delAll revokes every token for the user only', async () => {
    await store.save('u1', 'j1', 'h1', 60);
    await store.save('u1', 'j2', 'h2', 60);
    await store.save('u2', 'j3', 'h3', 60);
    await store.delAll('u1');
    expect(await store.get('u1', 'j1')).toBeNull();
    expect(await store.get('u1', 'j2')).toBeNull();
    expect(await store.get('u2', 'j3')).toBe('h3'); // other user untouched
  });
});
