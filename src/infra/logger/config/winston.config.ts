import * as winston from 'winston';

const isProd = (): boolean => process.env.NODE_ENV?.toLowerCase() === 'production';

// ANSI colors for the level token. green=info, yellow=warn, red=error, cyan=debug/verbose.
const LEVEL_COLORS: Record<string, string> = {
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[36m',
  verbose: '\x1b[36m',
};
const WHITE = '\x1b[37m'; // timestamp
const INFO = '\x1b[32m'; // caller context + message
const RESET = '\x1b[0m';

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
      const lvl = LEVEL_COLORS[level] ?? '';
      const ts = `${WHITE}[${timestamp}]${RESET}`;
      const tag = `${lvl}[${level.toUpperCase()}]${RESET}`;
      const rest = `${INFO}[${context ?? 'App'}]: ${message}${RESET}`;
      return `${ts}${tag}${rest}`;
    }),
  );
}

export function buildWinstonOptions(level: string): winston.LoggerOptions {
  return {
    level,
    transports: [new winston.transports.Console({ format: buildFormat() })],
  };
}
