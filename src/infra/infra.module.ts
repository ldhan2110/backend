import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { EnvironmentConfigModule } from "./env/env.module";

@Module({
  imports: [
    EnvironmentConfigModule,
    DatabaseModule
  ],
})
export class InfraModule {}
