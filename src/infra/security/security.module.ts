import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TokenService } from './services/token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { REFRESH_TOKEN_STORE } from './store/refresh-token.store';
import { CacheRefreshTokenStore } from './store/cache-refresh-token.store';


@Global()
@Module({
  imports: [
    JwtModule.register({}), // secrets passed per-sign in TokenService
    // In-memory counter storage (default). For horizontal scaling, add
    // @nest-lab/throttler-storage-redis and pass `storage:` here.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60000),
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),
  ],
  providers: [
    TokenService,
    // Order matters: throttle runs before auth so unauthenticated abuse is
    // rate-limited too. Override per-route with @Throttle / @SkipThrottle.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: REFRESH_TOKEN_STORE, useClass: CacheRefreshTokenStore },
  ],
  exports: [TokenService, REFRESH_TOKEN_STORE],
})
export class SecurityModule {}
