import { describe, expect, it } from 'vitest';
import {
  InvalidOrderTransitionError,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  assertOrderTransition,
  canTransitionOrder,
} from '../src';

describe('order state machine', () => {
  it('follows the happy path', () => {
    const path = ['pending', 'awaiting_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered'] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransitionOrder(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('rejects skipping payment', () => {
    expect(canTransitionOrder('awaiting_payment', 'shipped')).toBe(false);
    expect(() => assertOrderTransition('pending', 'paid')).toThrow(InvalidOrderTransitionError);
  });

  it('does not allow cancelling a shipped order', () => {
    expect(canTransitionOrder('shipped', 'cancelled')).toBe(false);
  });

  it('treats refunded as terminal', () => {
    expect(ORDER_TRANSITIONS.refunded).toHaveLength(0);
  });

  it('only references known statuses', () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target);
    }
  });
});
