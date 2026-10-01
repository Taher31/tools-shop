import type { Prisma } from '@toolshop/database';
import type { AdminTicketSummary, TicketMessageView, TicketSummary } from '@toolshop/shared';

export const TICKET_LIST_INCLUDE = {
  order: { select: { orderNumber: true } },
  user: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.TicketInclude;

export type TicketListRecord = Prisma.TicketGetPayload<{ include: typeof TICKET_LIST_INCLUDE }>;

const MESSAGE_INCLUDE = {
  author: { select: { firstName: true, lastName: true } },
} satisfies Prisma.TicketMessageInclude;

export const TICKET_MESSAGES_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' }, include: MESSAGE_INCLUDE },
} satisfies Prisma.TicketInclude;

type MessageRecord = Prisma.TicketMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName}`.trim();

/** Customers see staff by first name only; staff see full names. */
export function toMessageView(
  message: MessageRecord,
  audience: 'customer' | 'staff',
): TicketMessageView {
  let authorName = 'سیستم';
  if (message.authorType === 'staff') {
    authorName = message.author
      ? audience === 'staff'
        ? fullName(message.author)
        : `پشتیبانی (${message.author.firstName})`
      : 'پشتیبانی';
  } else if (message.authorType === 'customer') {
    authorName = message.author ? fullName(message.author) : 'مشتری';
  }
  return {
    id: message.id,
    authorType: message.authorType,
    authorName,
    body: message.body,
    isInternal: message.isInternal,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toTicketSummary(ticket: TicketListRecord): TicketSummary {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    orderNumber: ticket.order?.orderNumber ?? null,
    unread: ticket.customerUnread,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
  };
}

export function toAdminTicketSummary(ticket: TicketListRecord): AdminTicketSummary {
  return {
    ...toTicketSummary(ticket),
    priority: ticket.priority,
    unread: ticket.staffUnread,
    customer: { id: ticket.user.id, fullName: fullName(ticket.user), mobile: ticket.user.mobile },
    assignee: ticket.assignee
      ? { id: ticket.assignee.id, fullName: fullName(ticket.assignee) }
      : null,
    messagesCount: ticket._count.messages,
  };
}
