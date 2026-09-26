import 'dotenv/config';

const integer = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: integer(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
  sessionTtlHours: integer(process.env.SESSION_TTL_HOURS, 12),
  trustProxy: integer(process.env.TRUST_PROXY, 0),
  logLevel: process.env.LOG_LEVEL || 'info',
  autoInitDb: process.env.AUTO_INIT_DB !== 'false',
});

export const isProduction = config.env === 'production';
