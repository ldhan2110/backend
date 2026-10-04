import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRepository } from './repository/auth.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
