import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export enum DatabaseType {
  POSTGRES="postgres",
  ORACLE="oracle",
  MSSQL="mssql",
}

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: process.env.DB_TYPE as DatabaseType,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/entities/**/*{.entity,.model}.{ts,js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: false,
});