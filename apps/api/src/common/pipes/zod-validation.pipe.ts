import { type PipeTransform } from '@nestjs/common';
import type { FieldError } from '@toolshop/shared';
import type { z } from 'zod';
import { AppException } from '../errors/app-exception';

export function zodIssuesToFieldErrors(issues: readonly z.core.$ZodIssue[]): FieldError[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '_',
    message: issue.message,
  }));
}

/** Validates and transforms a request part with a zod schema from @toolshop/shared. */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<
  unknown,
  z.output<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppException.validation(zodIssuesToFieldErrors(result.error.issues));
    }
    return result.data;
  }
}
