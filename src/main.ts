import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RuntimeExceptionFilter } from './common/filters/runtime-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new RuntimeExceptionFilter(), new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
