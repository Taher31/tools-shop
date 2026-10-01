import './bootstrap-env';
import 'reflect-metadata';
import path from 'node:path';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfig } from './config/app-config';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxyHops);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '256kb', extended: false });
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.storage.driver === 'local') {
    app.useStaticAssets(path.resolve(process.cwd(), config.storage.localDir), {
      prefix: '/uploads',
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
    });
  }
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(AppConfig);
  await app.listen(config.port);
  app.get(Logger).log(`API listening on http://localhost:${config.port}/api/v1`);
}

if (require.main === module) {
  void bootstrap();
}
