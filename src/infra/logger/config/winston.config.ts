import * as winston from 'winston';

const isProd = (): boolean => process.env.NODE_ENV?.toLowerCase() === 'production';

export function buildFormat(): winston.Logform.Format {
  if (isProd()) {
    return winston.format.combine(winston.format.timestamp(), winston.format.json());
  }
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
      const { timestamp, level, context, message } = info as {
        timestamp: string;
        level: string;
        context?: string;
        message: string;
      };
      return `[${timestamp}][${level.toUpperCase()}][${context ?? 'App'}]: ${message}`;
    }),
  );
}

export function buildWinstonOptions(level: string): winston.LoggerOptions {
  return {
    level,
    transports: [new winston.transports.Console({ format: buildFormat() })],
  };
}
