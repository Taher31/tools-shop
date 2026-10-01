import type { RedisOptions } from 'ioredis';

export const REDIS = Symbol('REDIS');

/** ioredis options from a redis:// or rediss:// URL (BullMQ needs an options object). */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const db = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
