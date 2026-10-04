import { Injectable } from '@nestjs/common';
import { Paginated, SqlMapper, when } from '@infra/database/mapper';
import { UserQueryDto } from '../dtos/user.request.dto';
import { ActiveCountDto, UserDto } from '../dtos/user.response.dto';

/** Columns a client is allowed to sort by (camelCase → mapped to snake_case, injection-safe). */
const SORTABLE = ['createdAt', 'userId', 'activeFlag'];

@Injectable()
export class UserRepository {
  constructor(private readonly mapper: SqlMapper) {}

  findById(userId: string): Promise<UserDto | null> {
    return this.mapper.selectOne(UserDto, this.mapper.named('user.findById'), { userId });
  }

  search(query: UserQueryDto): Promise<Paginated<UserDto>> {
    const sql = this.mapper
      .named('user.base')
      .where([
        when(query.activeFlag, 'active_flag = #{activeFlag}', { activeFlag: query.activeFlag }),
        when(query.keyword, 'user_id ILIKE #{kw}', { kw: `%${query.keyword}%` }),
      ])
      .orderBy(query.sort, SORTABLE);
    return this.mapper.selectPage(UserDto, sql, query.pagination);
  }

  countByActive(): Promise<ActiveCountDto[]> {
    return this.mapper.execute(ActiveCountDto, this.mapper.named('user.countByActive'));
  }

  remove(userId: string): Promise<number> {
    return this.mapper.delete(this.mapper.named('user.remove'), { userId });
  }
}
