import { Injectable } from '@nestjs/common';
import { Paginated, SqlMapper, when } from '@infra/database/mapper';
import { UserQueryRequestDto } from '../dtos/user.request.dto';
import { ActiveCountResponseDto, UserResponseDto } from '../dtos/user.response.dto';

/** Columns a client is allowed to sort by (camelCase → mapped to snake_case, injection-safe). */
const SORTABLE = ['createdAt', 'userId', 'activeFlag'];

@Injectable()
export class UserRepository {
  constructor(private readonly mapper: SqlMapper) {}

  findById(userId: string): Promise<UserResponseDto | null> {
    return this.mapper.selectOne(UserResponseDto, this.mapper.named('user.findById'), { userId });
  }

  search(query: UserQueryRequestDto): Promise<Paginated<UserResponseDto>> {
    const sql = this.mapper
      .named('user.base')
      .where([
        when(query.activeFlag, 'active_flag = #{activeFlag}', { activeFlag: query.activeFlag }),
        when(query.keyword, 'user_id ILIKE #{kw}', { kw: `%${query.keyword}%` }),
      ])
      .orderBy(query.sort, SORTABLE);
    return this.mapper.selectPage(UserResponseDto, sql, query.pagination);
  }

  countByActive(): Promise<ActiveCountResponseDto[]> {
    return this.mapper.execute(ActiveCountResponseDto, this.mapper.named('user.countByActive'));
  }

  remove(userId: string): Promise<number> {
    return this.mapper.delete(this.mapper.named('user.remove'), { userId });
  }
}
