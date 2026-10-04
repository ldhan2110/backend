import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RuntimeExceptionFilter } from './common/filters/runtime-exception.filter';
import { ValidationPipe } from '@nestjs/common/pipes/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — "*" allows all, else comma-separated allowlist
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  app.enableCors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim())});

  // Global filters
  app.useGlobalFilters(new RuntimeExceptionFilter(), new DomainExceptionFilter());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // strip unknown props
      transform: true,        // plain → DTO instance (enables nested + defaults)
      transformOptions: { enableImplicitConversion: true }, // "5" → 5 for @Query
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
