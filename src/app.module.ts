import { InfraModule } from '@infra/infra.module';
import { Module } from '@nestjs/common';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [InfraModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
