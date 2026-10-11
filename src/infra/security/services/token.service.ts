import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { AccessPayload, CustomClaims, IssuedAccess, IssuedRefresh, RefreshPayload } from '../types/jwt.type';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.get<string>('jwt.accessSecret')!;
    this.refreshSecret = config.get<string>('jwt.refreshSecret')!;
    this.accessTtl = config.get<string>('jwt.accessTtl')!;
    this.refreshTtl = config.get<string>('jwt.refreshTtl')!;
    if (this.accessSecret === this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  issueAccess(userId: string, jti: string, claims: CustomClaims = {}): IssuedAccess {
    const token = this.jwt.sign({ sub: userId, jti, ...claims } as AccessPayload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'], // TTL comes from env as a string
    });
    const { exp } = this.jwt.decode(token) as { exp: number };
    return { token, expiresAt: exp * 1000 };
  }

  issueRefresh(userId: string, claims: CustomClaims = {}): IssuedRefresh {
    const jti = randomUUID();
    const token = this.jwt.sign({ sub: userId, jti, ...claims } as RefreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl as JwtSignOptions['expiresIn'],
    });
    const { exp } = this.jwt.decode(token) as { exp: number };
    const ttlSec = Math.max(1, exp - Math.floor(Date.now() / 1000));
    return { token, jti, ttlSec, expiresAt: exp * 1000 };
  }

  verifyAccess(token: string): AccessPayload {
    return this.jwt.verify<AccessPayload>(token, { secret: this.accessSecret });
  }

  verifyRefresh(token: string): RefreshPayload {
    return this.jwt.verify<RefreshPayload>(token, { secret: this.refreshSecret });
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
