import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { RuntimeExceptionFilter } from './common/filters/runtime-exception.filter';
import { ValidationPipe } from '@nestjs/common/pipes/index.js';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Security headers. CSP off — API-only (JSON), and default CSP breaks Swagger UI.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Parse cookies (refresh token travels in an httpOnly cookie)
  app.use(cookieParser());

  // URI versioning: routes mounted under /v1, /v2, ... defaultVersion handles
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // CORS — wildcard can't carry credentials (CORS spec)
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  if (corsOrigin === '*') {
    app.enableCors({ origin: true });
  } else {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true });
  }

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
