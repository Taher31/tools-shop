import { INVOICE_TYPE_LABELS, type InvoiceSummary } from '@toolshop/shared';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { date, faNumber, price } from '@/lib/format';

/** Issued documents of an order, each opening its printable page. */
export function InvoiceLinks({
  invoices,
  admin = false,
}: {
  invoices: InvoiceSummary[];
  admin?: boolean;
}) {
  if (invoices.length === 0) return null;
  return (
    <ul className="space-y-2">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <Link
            href={`/print/invoice/${invoice.id}${admin ? '?scope=admin' : ''}`}
            target="_blank"
            className="hover:bg-muted flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs"
          >
            <FileText className="text-info size-4" />
            <span className="font-semibold">
              {INVOICE_TYPE_LABELS[invoice.type]} {faNumber(invoice.invoiceNumber)}
            </span>
            <span className="text-muted-foreground">{date(invoice.issuedAt)}</span>
            <span className="ms-auto">{price(invoice.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
