import { BaseDto } from '@common/dtos/base.dto';

export class UserDto extends BaseDto {
  userId: string;
  activeFlag: string;
}

export class ActiveCountDto {
  activeFlag: string;
  total: number;
}
