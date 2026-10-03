import { DatabaseType } from "@config/env.config";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: config.getOrThrow<DatabaseType>("database.type"),
                host: config.getOrThrow<string>("database.host"),
                port: Number(config.getOrThrow("database.port")),
                username: config.getOrThrow<string>("database.username"),
                password: config.getOrThrow<string>("database.password"),
                database: config.getOrThrow<string>("database.name"),
                entities: [__dirname + "/entities/**/*{.entity,.model}.{ts,js}"],
                migrations: [__dirname + "/migrations/*{.ts,.js}"],
                synchronize: false,
                migrationsRun: false,
            }),
        }),
    ],
})
export class DatabaseModule {}
