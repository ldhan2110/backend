export enum NodeEnv {
  DEVELOPMENT = 'DEVELOPMENT',
  TEST = 'TEST',
  PRODUCTION = 'PRODUCTION',
}

export enum DatabaseType {
  POSTGRES="postgres",
  ORACLE="oracle",
  MSSQL="mssql",
}

export const configEnv = () => ({
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV as NodeEnv,
  database: {
    type: process.env.DB_TYPE as DatabaseType,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    db: process.env.DB_LOGGING === 'true',
  },
});
