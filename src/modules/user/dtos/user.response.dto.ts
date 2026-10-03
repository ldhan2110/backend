import { BaseDto } from '@common/dtos/base.dto';


export class UserDto extends BaseDto {
  id: number;
  email: string;
  status: string;
}


export class StatusCountDto {
  status: string;
  total: number;
}
