import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { buildFormat, buildWinstonOptions } from './config/winston.config';

export const DB_LOGGER = 'DB_LOGGER';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildWinstonOptions(config.get<string>('logging.level', 'info')),
    }),
  ],
  providers: [
    {
      provide: DB_LOGGER,
      useFactory: () =>
        winston.createLogger({
          level: 'debug',
          transports: [new winston.transports.Console({ format: buildFormat() })],
        }),
    },
  ],
  exports: [WinstonModule, DB_LOGGER],
})
export class LoggerModule {}
