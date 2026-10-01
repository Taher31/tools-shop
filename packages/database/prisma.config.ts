import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// One .env at the repository root serves every app in development.
loadEnv({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
