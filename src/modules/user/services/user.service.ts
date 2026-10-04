import { Injectable, NotFoundException } from '@nestjs/common';
import { UserQueryRequestDto } from '../dtos/user.request.dto';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  list(query: UserQueryRequestDto) {
    return this.users.search(query);
  }

  async getOne(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  stats() {
    return this.users.countByActive();
  }

  remove(userId: string) {
    return this.users.remove(userId);
  }
}
