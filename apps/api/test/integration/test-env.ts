import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

export const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Environment for integration tests: a dedicated database (name must end in `_test`),
 * a separate Redis database, its own search index prefix and no background workers,
 * so tests are deterministic and never touch development data.
 */
export interface IntegrationEnv {
  DATABASE_URL: string;
  REDIS_URL: string;
  [key: string]: string;
}

export function integrationEnv(): IntegrationEnv {
  const file = path.join(REPO_ROOT, '.env');
  const fromFile = fs.existsSync(file) ? parse(fs.readFileSync(file)) : {};
  const read = (key: string): string | undefined => process.env[key] ?? fromFile[key];

  const databaseUrl = read('TEST_DATABASE_URL');
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL must be set to run integration tests.');
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}" (name must end with _test).`,
    );
  }
  const redisUrl = new URL(read('TEST_REDIS_URL') ?? read('REDIS_URL') ?? 'redis://localhost:6379');
  if (!read('TEST_REDIS_URL')) redisUrl.pathname = '/15';

  // Defaults let the suite run in CI without a .env file; real values win when present.
  const withDefault = (key: string, fallback: string): string => read(key) ?? fallback;

  return {
    APP_PUBLIC_URL: withDefault('APP_PUBLIC_URL', 'http://localhost:3000'),
    MEILI_HOST: withDefault('MEILI_HOST', 'http://localhost:7700'),
    JWT_ACCESS_SECRET: withDefault(
      'JWT_ACCESS_SECRET',
      'integration-tests-only-secret-0123456789abcdef',
    ),
    APP_ENCRYPTION_KEY: withDefault('APP_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64')),
    STORAGE_PUBLIC_BASE_URL: withDefault('STORAGE_PUBLIC_BASE_URL', '/uploads'),
    SEED_ADMIN_EMAIL: withDefault('SEED_ADMIN_EMAIL', 'admin@example.com'),
    SEED_ADMIN_PASSWORD: withDefault('SEED_ADMIN_PASSWORD', 'Admin@12345'),
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: databaseUrl,
    DATABASE_POOL_SIZE: '20',
    REDIS_URL: redisUrl.toString(),
    MEILI_INDEX_PREFIX: 'toolshop_test_',
    QUEUE_WORKERS_ENABLED: 'false',
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
  };
}
