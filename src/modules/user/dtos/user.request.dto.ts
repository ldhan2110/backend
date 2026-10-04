import { PaginationDto } from '@common/dtos/pagination.dto';
import { SortDto } from '@common/dtos/sort.dto';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

/** Filters + nested sort + nested pagination for the user list endpoint. */
export class UserQueryRequestDto {
  @IsString()
  @IsOptional()
  activeFlag?: string;

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
