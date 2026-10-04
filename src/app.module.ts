import { InfraModule } from '@infra/infra.module';
import { Module } from '@nestjs/common';
import { UserModule } from '@modules/user/user.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [InfraModule, AuthModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
