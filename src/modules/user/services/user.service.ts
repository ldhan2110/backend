import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UserQueryRequestDto } from '../dtos/user.request.dto';
import { UserNotFoundException } from '../exceptions/user.exception';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  list(query: UserQueryRequestDto) {
    return this.users.search(query);
  }

  async getOne(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundException(userId);
    return user;
  }

  stats() {
    return this.users.countByActive();
  }

  @Transactional()
  remove(userId: string) {
    return this.users.remove(userId);
  }
}
