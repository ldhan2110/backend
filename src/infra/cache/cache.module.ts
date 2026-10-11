import { createKeyv } from '@keyv/redis';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyvCacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { setCacheRef } from './decorators/cache.decorator';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        const lruSize = config.get<number>('cache.memoryMax') ?? 1000;
        return {
          stores: url
            ? [createKeyv(url)]
            : [new Keyv({ store: new KeyvCacheableMemory({ lruSize }) })],
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule implements OnModuleInit {
  constructor(private readonly cache: CacheService) {}

  onModuleInit(): void {
    setCacheRef(this.cache);
  }
}
