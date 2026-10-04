import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserRepository } from './repository/user.repository';
import { UserService } from './services/user.service';


@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class UserModule {}
