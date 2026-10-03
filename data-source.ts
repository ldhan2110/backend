import { DataSource } from 'typeorm';

// CLI-only DataSource. Nest uses forRootAsync (database.module.ts); the TypeORM
// CLI can't read Nest's DI, so it needs its own instance.
// ponytail: native env load, no dotenv dep. Node >= 20.12.
try {
  process.loadEnvFile();
} catch {
  // no .env file (e.g. prod with injected env) — ignore
}

export default new DataSource({
  type: (process.env.DB_TYPE as 'postgres') ?? 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // TS globs: the CLI runs through ts-node, resolved from cwd (backend/).
  entities: ['src/infra/**/*.entity.ts'],
  migrations: ['src/infra/database/migrations/*.ts'],
  synchronize: false,
});
