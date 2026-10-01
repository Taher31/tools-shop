import { z } from 'zod';
import {
  INVOICE_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../commerce/enums';
import { idSchema, listQuerySchema, textSchema } from './common';

const messageBodySchema = textSchema({ min: 2, max: 5000 });

export const ticketCreateSchema = z.object({
  subject: textSchema({ min: 3, max: 150 }),
  category: z.enum(TICKET_CATEGORIES, { message: 'موضوع تیکت را انتخاب کنید.' }),
  orderId: idSchema
    .nullish()
    .or(z.literal(''))
    .transform((value) => value || null),
  body: messageBodySchema,
});
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;

export const ticketReplySchema = z.object({ body: messageBodySchema });
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;

export const staffTicketReplySchema = ticketReplySchema.extend({
  /** Internal notes are visible to staff only. */
  internal: z.boolean().default(false),
  /** Close the ticket together with this reply. */
  close: z.boolean().default(false),
});
export type StaffTicketReplyInput = z.infer<typeof staffTicketReplySchema>;

export const ticketUpdateSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    assigneeId: idSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'هیچ تغییری ارسال نشده است.',
  });
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;

export const adminTicketListQuerySchema = listQuerySchema.extend({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  /** `me` = assigned to the current staff user, `none` = unassigned. */
  assignee: z.union([z.literal('me'), z.literal('none'), idSchema]).optional(),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});
export type AdminTicketListQuery = z.infer<typeof adminTicketListQuerySchema>;

export const adminInvoiceListQuerySchema = listQuerySchema.extend({
  type: z.enum(INVOICE_TYPES).optional(),
});
export type AdminInvoiceListQuery = z.infer<typeof adminInvoiceListQuerySchema>;

export const integrationUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  /** Only the fields being changed; an empty string clears a value. */
  credentials: z.record(z.string().max(60), z.string().trim().max(2000)).optional(),
});
export type IntegrationUpdateInput = z.infer<typeof integrationUpdateSchema>;
