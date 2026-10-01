import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

export interface DatabaseConnectionOptions {
  url: string;
  /** Maximum connections in the pg pool (per process). */
  poolSize?: number;
  /** Milliseconds before an idle pooled connection is closed. */
  idleTimeoutMs?: number;
}

export function createPgAdapter(options: DatabaseConnectionOptions): PrismaPg {
  return new PrismaPg({
    connectionString: options.url,
    max: options.poolSize ?? 10,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
  });
}

export function createPrismaClient(options: DatabaseConnectionOptions): PrismaClient {
  return new PrismaClient({ adapter: createPgAdapter(options) });
}
