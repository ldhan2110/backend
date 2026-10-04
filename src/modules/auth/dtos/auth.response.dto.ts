import { BaseDto } from '@common/dtos/base.dto';

/** Access-token envelope (refresh token stays in the httpOnly cookie). expiresAt is epoch ms. */
export class LoginResponseDto {
  accessToken: string;
  accessTokenExpiresAt: number;
}

export class UserInfoResponseDto extends BaseDto {
  userId: string;
  activeFlag: string;
}

export class CredentialDto {
  userId: string;
  passwordHash: string;
  activeFlag: string;
}

