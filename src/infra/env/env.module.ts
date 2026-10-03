import { DatabaseType } from "@config/env.config";
import { configEnv, NodeEnv } from "@config/env.config";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { IsEnum, IsInt, IsString, Max, Min, validateSync } from "class-validator";



export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsEnum(DatabaseType)
  DB_TYPE: DatabaseType = DatabaseType.POSTGRES;

  @IsString()
  DB_HOST: string;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;
}
    
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env', '.env.development', '.env.test', '.env.production'],
      cache: true,
      load: [configEnv],
      validate: (config: Record<string, unknown>) => {
            const validatedConfig = plainToInstance(EnvironmentVariables, config, {
                enableImplicitConversion: true,
            });

            const errors = validateSync(validatedConfig, {
                skipMissingProperties: false,
            });

            if (errors?.length > 0) {
                console.info('\n🔐 ---------------Validating .env.* file--------------- 🔐');
                console.error(errors.map(e => e.constraints));
                process.exit(1);
            }

            return validatedConfig;
        },
    }),
  ],
})
export class EnvironmentConfigModule {}