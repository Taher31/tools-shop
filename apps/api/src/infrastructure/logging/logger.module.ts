import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Structured JSON logging (pretty-printed in development) with secrets redacted. */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (request: IncomingMessage) => {
            const incoming = request.headers['x-request-id'];
            return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
              ? incoming
              : randomUUID();
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.passwordHash',
              '*.token',
              '*.apiKey',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            ignore: (request: IncomingMessage) =>
              request.url === '/api/health' || request.url === '/api/v1/health',
          },
          customLogLevel: (
            _request: IncomingMessage,
            response: { statusCode: number },
            error?: Error,
          ) => {
            if (error || response.statusCode >= 500) return 'error';
            if (response.statusCode >= 400) return 'warn';
            return 'info';
          },
          serializers: {
            req: (request: { id: unknown; method: string; url: string }) => ({
              id: request.id,
              method: request.method,
              url: request.url,
            }),
          },
          transport:
            config.isProduction || config.isTest
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
