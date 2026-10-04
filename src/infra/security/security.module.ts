import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import Redis from 'ioredis';
import { TokenService } from './services/token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { REFRESH_TOKEN_STORE } from './store/refresh-token.store';
import { MemoryRefreshTokenStore } from './store/memory-refresh-token.store';
import { RedisRefreshTokenStore } from './store/redis-refresh-token.store';


@Global()
@Module({
  imports: [JwtModule.register({})], // secrets passed per-sign in TokenService
  providers: [
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: REFRESH_TOKEN_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        return url ? new RedisRefreshTokenStore(new Redis(url)) : new MemoryRefreshTokenStore();
      },
    },
  ],
  exports: [TokenService, REFRESH_TOKEN_STORE],
})
export class SecurityModule {}
