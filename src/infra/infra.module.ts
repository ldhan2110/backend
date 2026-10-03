import { Module } from "@nestjs/common";
import { EnvironmentConfigModule } from "./env/env.module";

@Module({
  imports: [
    EnvironmentConfigModule
  ],
})
export class InfraModule {}
