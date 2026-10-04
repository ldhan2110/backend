import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @Length(1, 20)
  userId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // ponytail: bcrypt silently truncates past 72 bytes — reject instead
  password: string;
}

export class RegisterRequestDto extends LoginRequestDto {}
