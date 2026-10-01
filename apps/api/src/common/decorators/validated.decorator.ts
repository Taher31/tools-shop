import { Body, Param, type PipeTransform, Query } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from '../errors/app-exception';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw AppException.notFound();
    return value.toLowerCase();
  }
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** `@ZBody(schema) input: z.output<typeof schema>` */
export const ZBody = (schema: z.ZodType): ParameterDecorator => Body(new ZodValidationPipe(schema));

/** `@ZQuery(schema) query: z.output<typeof schema>` */
export const ZQuery = (schema: z.ZodType): ParameterDecorator =>
  Query(new ZodValidationPipe(schema));

/** UUID route parameter; malformed ids become a 404 instead of a database error. */
export const UuidParam = (name = 'id'): ParameterDecorator => Param(name, new UuidPipe());
