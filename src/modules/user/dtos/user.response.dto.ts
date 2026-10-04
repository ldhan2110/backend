import { BaseDto } from '@common/dtos/base.dto';

export class UserResponseDto extends BaseDto {
  userId: string;
  activeFlag: string;
}

export class ActiveCountResponseDto {
  activeFlag: string;
  total: number;
}
