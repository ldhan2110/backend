import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './services/token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { REFRESH_TOKEN_STORE } from './store/refresh-token.store';
import { CacheRefreshTokenStore } from './store/cache-refresh-token.store';


@Global()
@Module({
  imports: [JwtModule.register({})], // secrets passed per-sign in TokenService
  providers: [
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // backend (Redis vs in-memory) is chosen by CacheModule, not here
    { provide: REFRESH_TOKEN_STORE, useClass: CacheRefreshTokenStore },
  ],
  exports: [TokenService, REFRESH_TOKEN_STORE],
})
export class SecurityModule {}
