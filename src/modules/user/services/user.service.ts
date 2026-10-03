import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, UserQueryDto } from '../dtos/user.request.dto';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  list(query: UserQueryDto) {
    return this.users.search(query);
  }

  async getOne(id: number) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  stats() {
    return this.users.countByStatus();
  }

  create(input: CreateUserDto, by: string) {
    return this.users.create(input, by);
  }

  changeEmail(id: number, email: string, by: string) {
    return this.users.updateEmail(id, email, by);
  }

  remove(id: number) {
    return this.users.remove(id);
  }
}
