import type {
  AddressSnapshot,
  InvoiceLine,
  InvoiceParty,
  LegalSettings,
  StoreSettings,
} from '@toolshop/shared';

/** Seller block printed on invoices: legal identity first, store data as fallback. */
export function sellerParty(store: StoreSettings, legal: LegalSettings): InvoiceParty {
  return {
    name: legal.companyName ?? store.storeName,
    nationalId: legal.nationalId ?? null,
    economicCode: legal.economicCode ?? null,
    registrationNumber: legal.registrationNumber ?? null,
    nationalCode: null,
    phone: store.supportPhone ?? null,
    address: store.address ?? null,
    postalCode: null,
  };
}

export function buyerParty(
  user: { firstName: string; lastName: string; mobile: string | null; nationalCode: string | null },
  address: Partial<AddressSnapshot>,
): InvoiceParty {
  const street = [
    address.province,
    address.city,
    address.addressLine,
    address.plaque ? `پلاک ${address.plaque}` : null,
    address.unit ? `واحد ${address.unit}` : null,
  ]
    .filter(Boolean)
    .join('، ');
  return {
    name: `${user.firstName} ${user.lastName}`.trim(),
    nationalId: null,
    economicCode: null,
    registrationNumber: null,
    nationalCode: user.nationalCode,
    phone: user.mobile ?? address.recipientMobile ?? null,
    address: street || null,
    postalCode: address.postalCode ?? null,
  };
}

export interface InvoiceAmounts {
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  taxTotal: number;
  total: number;
}

/**
 * Credit note for a refund. A full refund reverses every line of the sale invoice;
 * a partial refund is a single adjustment line whose VAT share is proportional to
 * the original invoice (rounded down, in the customer's favour like all pricing).
 */
export function creditNoteContent(
  sale: { lines: InvoiceLine[] } & InvoiceAmounts,
  amount: number,
  saleInvoiceNumber: number,
): { lines: InvoiceLine[]; amounts: InvoiceAmounts; full: boolean } {
  if (amount >= sale.total) {
    return {
      lines: sale.lines,
      amounts: {
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        shippingCost: sale.shippingCost,
        taxTotal: sale.taxTotal,
        total: sale.total,
      },
      full: true,
    };
  }
  const taxTotal = sale.total > 0 ? Math.floor((amount * sale.taxTotal) / sale.total) : 0;
  return {
    lines: [
      {
        title: `بازپرداخت بخشی از مبلغ فاکتور ${saleInvoiceNumber}`,
        sku: null,
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
    amounts: { subtotal: amount, discountTotal: 0, shippingCost: 0, taxTotal, total: amount },
    full: false,
  };
}
