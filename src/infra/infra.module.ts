import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { EnvironmentConfigModule } from "./env/env.module";
import { LoggerModule } from "./logger/logger.module";

@Module({
  imports: [
    EnvironmentConfigModule,
    LoggerModule,
    DatabaseModule
  ],
})
export class InfraModule {}
