/**
 * Domain events written to the transactional outbox. Listeners (search indexing now,
 * marketplace sync / notifications / invoices later) subscribe with @OnEvent(type).
 */
export interface DomainEventMap {
  'product.changed': { productIds: string[] };
  'product.deleted': { productIds: string[] };
  'inventory.changed': { productIds: string[]; variantIds: string[] };
  'catalog.taxonomy_changed': {
    categoryIds?: string[];
    brandIds?: string[];
    attributeIds?: string[];
  };
  'order.created': { orderId: string };
  'order.paid': { orderId: string };
  'order.status_changed': { orderId: string; from: string; to: string };
  'payment.orphaned': { paymentId: string; orderId: string };
  'ticket.created': { ticketId: string };
  'question.created': { questionId: string };
  'review.created': { reviewId: string };
  'ticket.replied': { ticketId: string; by: 'customer' | 'staff' };
}

export type DomainEventType = keyof DomainEventMap;

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  type: T;
  aggregateType: string;
  aggregateId: string;
  payload: DomainEventMap[T];
}
