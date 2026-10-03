import { DatabaseType } from "@config/env.config";
import { ClsPluginTransactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
import { Global, Module, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getDataSourceToken, TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";
import { SqlMapper } from "./mapper/sql-mapper";
import { SqlStore } from "./mapper/sql-store";

@Global()
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
        ClsModule.forRoot({
            plugins: [
                new ClsPluginTransactional({
                    imports: [TypeOrmModule],
                    adapter: new TransactionalAdapterTypeOrm({
                        dataSourceToken: getDataSourceToken(),
                    }),
                }),
            ],
        }),
    ],
    providers: [SqlStore, SqlMapper],
    exports: [SqlMapper],
})
export class DatabaseModule implements OnModuleInit {
    constructor(private readonly store: SqlStore) {}

    onModuleInit(): void {
        this.store.load(process.cwd());
    }
}
