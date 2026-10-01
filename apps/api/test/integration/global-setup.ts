import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createPrismaClient } from '@toolshop/database';
import { Redis } from 'ioredis';
import { integrationEnv, REPO_ROOT } from './test-env';

/** Recreates the test database from migrations + seed and empties the test Redis database. */
export default async function setup(): Promise<void> {
  const env = integrationEnv();
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseName = databaseUrl.pathname.slice(1);

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  maintenanceUrl.search = '';
  const admin = createPrismaClient({ url: maintenanceUrl.toString(), poolSize: 1 });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.$disconnect();
  }

  const cwd = path.join(REPO_ROOT, 'packages/database');
  const childEnv = { ...process.env, ...env };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd,
    env: childEnv,
    stdio: 'pipe',
  });
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], { cwd, env: childEnv, stdio: 'pipe' });

  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}
