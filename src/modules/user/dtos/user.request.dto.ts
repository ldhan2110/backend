import { PaginationDto } from '@common/dtos/pagination.dto';
import { SortDto } from '@common/dtos/sort.dto';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

/** Create/update DTOs do NOT extend BaseDto — clients never send audit fields. */
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  status?: string = 'ACTIVE';
}

/** Filters + nested sort + nested pagination for list endpoints. */
export class UserQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  keyword?: string;

  @ValidateNested()
  @Type(() => SortDto)
  @IsOptional()
  sort: SortDto = new SortDto();

  @ValidateNested()
  @Type(() => PaginationDto)
  @IsOptional()
  pagination: PaginationDto = new PaginationDto();
}
