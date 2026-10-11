import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AuthRepository } from '../repository/auth.repository';
import { TokenService, REFRESH_TOKEN_STORE } from '@infra/security';
import type { IssuedAccess, IssuedRefresh, RefreshTokenStore } from '@infra/security';
import { LoginRequestDto, RegisterRequestDto } from '../dtos/auth.request.dto';
import { UserInfoResponseDto } from '../dtos/auth.response.dto';
import {
  InvalidCredentialsException,
  UserAlreadyExistsException,
} from '../exceptions/auth.exception';

export interface IssuedTokens {
  access: IssuedAccess; // token + expiresAt
  refresh: IssuedRefresh; // token + expiresAt + jti + ttlSec
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly tokens: TokenService,
    @Inject(REFRESH_TOKEN_STORE) private readonly store: RefreshTokenStore,
  ) {}

  @Transactional()
  async register(dto: RegisterRequestDto): Promise<IssuedTokens> {
    if (await this.repo.existsUser(dto.userId)) {
      throw new UserAlreadyExistsException(dto.userId);
    }
    const hash = await this.tokens.hashPassword(dto.password);
    await this.repo.insertUser(dto.userId, hash, dto.userId); // self-created
    return this.issue(dto.userId);
  }

  async login(dto: LoginRequestDto): Promise<IssuedTokens> {
    const cred = await this.repo.findCredential(dto.userId);
    if (!cred) {
      throw new InvalidCredentialsException();
    }
    const ok = await this.tokens.verifyPassword(dto.password, cred.passwordHash);
    if (!ok || cred.activeFlag !== 'Y') throw new InvalidCredentialsException();
    return this.issue(cred.userId);
  }

  async refresh(rawRefreshToken: string): Promise<IssuedTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = this.tokens.verifyRefresh(rawRefreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const stored = await this.store.get(payload.sub, payload.jti);
    if (!stored || stored !== this.tokens.sha256(rawRefreshToken)) {
      throw new UnauthorizedException('Refresh token revoked');
    }
    await this.store.del(payload.sub, payload.jti); // rotate: old token is now dead
    return this.issue(payload.sub);
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.store.del(userId, jti);
  }

  async me(userId: string): Promise<UserInfoResponseDto> {
    const profile = await this.repo.findProfile(userId);
    if (!profile) throw new UnauthorizedException();
    return profile;
  }

  private async issue(userId: string): Promise<IssuedTokens> {
    const refresh = this.tokens.issueRefresh(userId);
    const access = this.tokens.issueAccess(userId, refresh.jti); // access carries the refresh jti
    await this.store.save(userId, refresh.jti, this.tokens.sha256(refresh.token), refresh.ttlSec);
    return { access, refresh };
  }
}
