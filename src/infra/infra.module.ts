import { Module } from "@nestjs/common";
import { CacheModule } from "./cache/cache.module";
import { DatabaseModule } from "./database/database.module";
import { EnvironmentConfigModule } from "./env/env.module";
import { LoggerModule } from "./logger/logger.module";
import { SecurityModule } from "./security/security.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    EnvironmentConfigModule,
    LoggerModule,
    DatabaseModule,
    SecurityModule,
    StorageModule,
    CacheModule
  ],
})
export class InfraModule {}
