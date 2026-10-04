import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { EnvironmentConfigModule } from "./env/env.module";
import { LoggerModule } from "./logger/logger.module";
import { SecurityModule } from "./security/security.module";

@Module({
  imports: [
    EnvironmentConfigModule,
    LoggerModule,
    DatabaseModule,
    SecurityModule
  ],
})
export class InfraModule {}
