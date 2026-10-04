import * as winston from 'winston';

const isProd = (): boolean => process.env.NODE_ENV?.toLowerCase() === 'production';

// ANSI colors by log level. green=info, yellow=warn, red=error, gray=debug/verbose.
const LEVEL_COLORS: Record<string, string> = {
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
  verbose: '\x1b[90m',
};
const RESET = '\x1b[0m';
const colorize = (level: string, text: string): string =>
  `${LEVEL_COLORS[level] ?? ''}${text}${RESET}`;

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
      const line = `[${timestamp}][${level.toUpperCase()}][${context ?? 'App'}]: ${message}`;
      return colorize(level, line);
    }),
  );
}

export function buildWinstonOptions(level: string): winston.LoggerOptions {
  return {
    level,
    transports: [new winston.transports.Console({ format: buildFormat() })],
  };
}
