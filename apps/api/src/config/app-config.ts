import type { Env } from './env';

/** Typed, grouped view of the environment. Injected everywhere instead of process.env. */
export class AppConfig {
  readonly env: Env['NODE_ENV'];
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly logLevel: Env['LOG_LEVEL'];
  readonly port: number;
  readonly publicUrl: string;
  readonly corsOrigins: string[];
  readonly trustProxyHops: number;

  readonly database: { url: string; poolSize: number };
  readonly redisUrl: string;
  readonly search: { host: string; apiKey: string | undefined; indexPrefix: string };
  readonly auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    cookieSecure: boolean;
    cookieDomain: string | undefined;
  };
  readonly encryptionKey: Buffer;
  readonly rateLimit: { ttlSeconds: number; max: number; authMax: number };
  readonly storage: {
    driver: 'local' | 's3';
    localDir: string;
    publicBaseUrl: string;
    maxUploadBytes: number;
    s3: {
      endpoint: string | undefined;
      region: string;
      bucket: string | undefined;
      accessKeyId: string | undefined;
      secretAccessKey: string | undefined;
      forcePathStyle: boolean;
    };
  };
  readonly payments: { defaultProvider: string; allowMockInProduction: boolean };
  readonly checkout: { reservationTtlMinutes: number };
  readonly queues: { workersEnabled: boolean };

  constructor(env: Env) {
    this.env = env.NODE_ENV;
    this.isProduction = env.NODE_ENV === 'production';
    this.isTest = env.NODE_ENV === 'test';
    this.logLevel = env.LOG_LEVEL;
    this.port = env.API_PORT;
    this.publicUrl = env.APP_PUBLIC_URL.replace(/\/$/, '');
    this.corsOrigins = Array.from(new Set([this.publicUrl, ...env.CORS_ORIGINS]));
    this.trustProxyHops = env.TRUST_PROXY_HOPS;
    this.database = { url: env.DATABASE_URL, poolSize: env.DATABASE_POOL_SIZE };
    this.redisUrl = env.REDIS_URL;
    this.search = {
      host: env.MEILI_HOST,
      apiKey: env.MEILI_MASTER_KEY,
      indexPrefix: env.MEILI_INDEX_PREFIX,
    };
    this.auth = {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      cookieSecure: env.COOKIE_SECURE,
      cookieDomain: env.COOKIE_DOMAIN,
    };
    this.encryptionKey = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
    this.rateLimit = {
      ttlSeconds: env.RATE_LIMIT_TTL_SECONDS,
      max: env.RATE_LIMIT_MAX,
      authMax: env.AUTH_RATE_LIMIT_MAX,
    };
    this.storage = {
      driver: env.STORAGE_DRIVER,
      localDir: env.STORAGE_LOCAL_DIR,
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, ''),
      maxUploadBytes: Math.round(env.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
      s3: {
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    };
    this.payments = {
      defaultProvider: env.PAYMENT_DEFAULT_PROVIDER,
      allowMockInProduction: env.PAYMENT_ALLOW_MOCK_IN_PRODUCTION,
    };
    this.checkout = { reservationTtlMinutes: env.STOCK_RESERVATION_TTL_MINUTES };
    this.queues = { workersEnabled: env.QUEUE_WORKERS_ENABLED };
  }
}
