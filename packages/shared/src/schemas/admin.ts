import { z } from 'zod';
import { emailSchema, idSchema, listQuerySchema, mobileSchema, textSchema, optionalTextSchema } from './common';
import { passwordSchema } from './auth';
import { REVIEW_STATUSES, QUESTION_STATUSES } from '../commerce/enums';

export const staffUserCreateSchema = z.object({
  firstName: textSchema({ max: 80 }),
  lastName: textSchema({ max: 80 }),
  email: emailSchema,
  mobile: mobileSchema.optional(),
  password: passwordSchema,
  roleIds: z.array(idSchema).min(1, 'حداقل یک نقش انتخاب کنید.'),
  isActive: z.boolean().default(true),
});
export type StaffUserCreateInput = z.infer<typeof staffUserCreateSchema>;

export const staffUserUpdateSchema = z.object({
  firstName: textSchema({ max: 80 }),
  lastName: textSchema({ max: 80 }),
  roleIds: z.array(idSchema).min(1, 'حداقل یک نقش انتخاب کنید.'),
  isActive: z.boolean(),
  password: passwordSchema.optional().or(z.literal('').transform(() => undefined)),
});
export type StaffUserUpdateInput = z.infer<typeof staffUserUpdateSchema>;

export const roleUpsertSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,40}$/, 'کلید نقش باید انگلیسی با حروف کوچک باشد.'),
  name: textSchema({ max: 80 }),
  description: optionalTextSchema(300),
  permissions: z.array(z.string().max(80)).max(500),
});
export type RoleUpsertInput = z.infer<typeof roleUpsertSchema>;

export const customerListQuerySchema = listQuerySchema;

export const auditLogQuerySchema = listQuerySchema.extend({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(80).optional(),
  actorId: idSchema.optional(),
  action: z.string().max(80).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const reviewCreateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalTextSchema(120),
  body: textSchema({ min: 5, max: 3000 }),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const questionCreateSchema = z.object({
  body: textSchema({ min: 5, max: 1000 }),
});
export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;

export const reviewModerationSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
});

export const questionAnswerSchema = z.object({
  answer: textSchema({ min: 2, max: 3000 }),
  status: z.enum(QUESTION_STATUSES).default('answered'),
});
export type QuestionAnswerInput = z.infer<typeof questionAnswerSchema>;
