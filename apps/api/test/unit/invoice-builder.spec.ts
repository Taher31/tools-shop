import { describe, expect, it } from 'vitest';
import { buyerParty, creditNoteContent } from '../../src/modules/invoices/invoice-builder';

const sale = {
  lines: [
    { title: 'دریل', sku: 'D-1', quantity: 2, unitPrice: 1_000_000, total: 2_000_000 },
    { title: 'مته', sku: 'B-1', quantity: 1, unitPrice: 200_000, total: 200_000 },
  ],
  subtotal: 2_200_000,
  discountTotal: 200_000,
  shippingCost: 300_000,
  taxTotal: 209_090,
  total: 2_300_000,
};

describe('creditNoteContent', () => {
  it('reverses the whole invoice on a full refund', () => {
    const note = creditNoteContent(sale, 2_300_000, 1001);
    expect(note.full).toBe(true);
    expect(note.lines).toEqual(sale.lines);
    expect(note.amounts).toEqual({
      subtotal: 2_200_000,
      discountTotal: 200_000,
      shippingCost: 300_000,
      taxTotal: 209_090,
      total: 2_300_000,
    });
  });

  it('uses one adjustment line with a proportional VAT share on a partial refund', () => {
    const note = creditNoteContent(sale, 1_000_000, 1001);
    expect(note.full).toBe(false);
    expect(note.lines).toEqual([
      {
        title: 'بازپرداخت بخشی از مبلغ فاکتور 1001',
        sku: null,
        quantity: 1,
        unitPrice: 1_000_000,
        total: 1_000_000,
      },
    ]);
    expect(note.amounts.taxTotal).toBe(Math.floor((1_000_000 * 209_090) / 2_300_000));
    expect(note.amounts.total).toBe(1_000_000);
  });
});

describe('buyerParty', () => {
  it('formats the delivery address on one line', () => {
    const party = buyerParty(
      { firstName: 'علی', lastName: 'رضایی', mobile: '09120000000', nationalCode: null },
      {
        province: 'تهران',
        city: 'تهران',
        addressLine: 'خیابان آزادی',
        plaque: '12',
        unit: null,
        postalCode: '1311111111',
      },
    );
    expect(party).toMatchObject({
      name: 'علی رضایی',
      address: 'تهران، تهران، خیابان آزادی، پلاک 12',
      postalCode: '1311111111',
      phone: '09120000000',
    });
  });
});
