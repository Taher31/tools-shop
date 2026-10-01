import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    APP_PUBLIC_URL: z.url(),
    CORS_ORIGINS: csv,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),

    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.string().min(1),

    MEILI_HOST: z.url(),
    MEILI_MASTER_KEY: z.string().min(16).optional(),
    MEILI_INDEX_PREFIX: z.string().default('toolshop_'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_SECURE: booleanString,
    COOKIE_DOMAIN: z.string().optional().transform((value) => value || undefined),
    APP_ENCRYPTION_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 bytes, base64 encoded'),

    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('uploads'),
    STORAGE_PUBLIC_BASE_URL: z.string().min(1),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(8),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanString,

    PAYMENT_DEFAULT_PROVIDER: z.string().default('mock'),
    /** The mock gateway is refused in production unless explicitly allowed (staging). */
    PAYMENT_ALLOW_MOCK_IN_PRODUCTION: booleanString,
    STOCK_RESERVATION_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(20),

    /** Run BullMQ workers in this process (disable to run the API as a pure web node). */
    QUEUE_WORKERS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when STORAGE_DRIVER=s3' });
      }
    }
    if (env.NODE_ENV === 'production') {
      const weak = (value: string | undefined) => !value || /change_me|dev_/i.test(value);
      if (weak(env.JWT_ACCESS_SECRET)) {
        ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'must be a strong secret in production' });
      }
      if (weak(env.MEILI_MASTER_KEY)) {
        ctx.addIssue({ code: 'custom', path: ['MEILI_MASTER_KEY'], message: 'must be a strong key in production' });
      }
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'must be true in production' });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Loads the repository root `.env` (development) without overriding real env vars. */
export function loadEnvFiles(): void {
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')];
  for (const file of candidates) {
    if (fs.existsSync(file)) loadDotenv({ path: file, quiet: true });
  }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}
