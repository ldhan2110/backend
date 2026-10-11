import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService } from '../services/auth.service';
import type { IssuedTokens } from '../services/auth.service';
import { Public, CurrentUser } from '@infra/security';
import type { AccessPayload } from '@infra/security';
import { LoginRequestDto, RegisterRequestDto } from '../dtos/auth.request.dto';
import { LoginResponseDto, UserInfoResponseDto } from '../dtos/auth.response.dto';

export const REFRESH_COOKIE = 'refresh_token';

function cookieOptions(maxAgeMs: number): CookieOptions {
  return { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth/refresh', maxAge: maxAgeMs };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterRequestDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    return this.respond(await this.service.register(dto), res);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginRequestDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    return this.respond(await this.service.login(dto), res);
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('Missing refresh token');
    return this.respond(await this.service.refresh(raw), res);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AccessPayload, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.service.logout(user.sub, user.jti);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' });
  }

  @Get('me')
  me(@CurrentUser() user: AccessPayload): Promise<UserInfoResponseDto> {
    return this.service.me(user.sub);
  }

  private respond(issued: IssuedTokens, res: Response): LoginResponseDto {
    res.cookie(REFRESH_COOKIE, issued.refresh.token, cookieOptions(issued.refresh.ttlSec * 1000));
    return {
      accessToken: issued.access.token,
      accessTokenExpiresAt: issued.access.expiresAt,
    };
  }
}
