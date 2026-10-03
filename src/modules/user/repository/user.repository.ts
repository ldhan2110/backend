import { Injectable } from '@nestjs/common';
import { Paginated, SqlMapper, when } from '@infra/database/mapper';
import { CreateUserDto, UserQueryDto } from '../dtos/user.request.dto';
import { StatusCountDto, UserDto } from '../dtos/user.response.dto';

/** Columns a client is allowed to sort by (camelCase → mapped to snake_case, injection-safe). */
const SORTABLE = ['createdAt', 'email', 'status'];

@Injectable()
export class UserRepository {
  constructor(private readonly mapper: SqlMapper) {} // one inject


  findById(id: number): Promise<UserDto | null> {
    return this.mapper.selectOne(UserDto, this.mapper.named('user.findById'), { id });
  }

 
  search(query: UserQueryDto): Promise<Paginated<UserDto>> {
    const sql = this.mapper
      .named('user.base')
      .where([
        when(query.status, 'status = #{status}', { status: query.status }),
        when(query.keyword, 'email ILIKE #{kw}', { kw: `%${query.keyword}%` }),
      ])
      .orderBy(query.sort, SORTABLE);
    return this.mapper.selectPage(UserDto, sql, query.pagination);
  }

  
  countByStatus(): Promise<StatusCountDto[]> {
    return this.mapper.execute(StatusCountDto, this.mapper.named('user.countByStatus'));
  }

  
  create(input: CreateUserDto, by: string): Promise<number> {
    return this.mapper.insert(this.mapper.named('user.insert'), { ...input, by });
  }

  updateEmail(id: number, email: string, by: string): Promise<number> {
    return this.mapper.update(this.mapper.named('user.updateEmail'), { id, email, by });
  }

  remove(id: number): Promise<number> {
    return this.mapper.delete(this.mapper.named('user.remove'), { id });
  }
}
