import { BaseDto } from '@common/dtos/base.dto';

/** Access-token envelope (refresh token stays in the httpOnly cookie). expiresAt is epoch ms. */
export class LoginResponseDto {
  accessToken: string;
  accessTokenExpiresAt: number;
}

export class UserInfoDto extends BaseDto {
  userId: string;
  activeFlag: string;
}
