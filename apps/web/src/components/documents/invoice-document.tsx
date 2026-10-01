import { INVOICE_TYPE_LABELS, type InvoiceView } from '@toolshop/shared';
import { cn } from '@toolshop/ui';
import { date, faNumber, priceNumber } from '@/lib/format';
import { PartyBox } from './print-shell';

const rial = (amount: number) => priceNumber(amount, 'IRR');

/** Iranian-style sales invoice / credit note (amounts in Rial, as on official documents). */
export function InvoiceDocument({ invoice }: { invoice: InvoiceView }) {
  const credit = invoice.type === 'credit_note';
  const totals: [string, number, boolean?][] = [
    ['جمع کل کالاها', invoice.subtotal],
    ['تخفیف', invoice.discountTotal],
    ['هزینه ارسال', invoice.shippingCost],
    [
      invoice.taxIncluded ? 'مالیات بر ارزش افزوده (شامل در قیمت‌ها)' : 'مالیات بر ارزش افزوده',
      invoice.taxTotal,
    ],
    [credit ? 'مبلغ برگشتی' : 'مبلغ قابل پرداخت', invoice.total, true],
  ];
  return (
    <>
      <header className="mb-4 grid grid-cols-3 items-center">
        <div className="text-xs">
          <p>
            شماره: <b>{faNumber(invoice.invoiceNumber)}</b>
          </p>
          <p>تاریخ: {date(invoice.issuedAt)}</p>
          <p>سفارش: {faNumber(invoice.orderNumber)}</p>
        </div>
        <h1 className="text-center text-lg font-extrabold">{INVOICE_TYPE_LABELS[invoice.type]}</h1>
        <div className="text-start text-xs">
          {credit && invoice.saleInvoiceNumber ? (
            <p>
              مربوط به فاکتور: <b>{faNumber(invoice.saleInvoiceNumber)}</b>
            </p>
          ) : null}
        </div>
      </header>

      <div className="space-y-2">
        <PartyBox
          title="مشخصات فروشنده"
          rows={[
            ['نام', invoice.seller.name],
            ['شناسه ملی', invoice.seller.nationalId],
            ['کد اقتصادی', invoice.seller.economicCode],
            ['شماره ثبت', invoice.seller.registrationNumber],
            ['تلفن', invoice.seller.phone],
            ['نشانی', invoice.seller.address],
          ]}
        />
        <PartyBox
          title="مشخصات خریدار"
          rows={[
            ['نام', invoice.buyer.name],
            ['کد ملی', invoice.buyer.nationalCode],
            ['تلفن', invoice.buyer.phone],
            ['کد پستی', invoice.buyer.postalCode],
            ['نشانی', invoice.buyer.address],
          ]}
        />
      </div>

      <table className="mt-3 w-full border-collapse border border-black/70 text-center">
        <thead className="bg-black/5">
          <tr>
            {[
              'ردیف',
              'شرح کالا یا خدمات',
              'کد کالا',
              'تعداد',
              'مبلغ واحد (ریال)',
              'مبلغ کل (ریال)',
            ].map((h) => (
              <th key={h} className="border border-black/70 px-2 py-1 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={`${line.sku}-${index}`}>
              <td className="border border-black/70 px-2 py-1">{faNumber(index + 1)}</td>
              <td className="border border-black/70 px-2 py-1 text-start">{line.title}</td>
              <td className="ltr border border-black/70 px-2 py-1">{line.sku ?? '—'}</td>
              <td className="border border-black/70 px-2 py-1">{faNumber(line.quantity)}</td>
              <td className="border border-black/70 px-2 py-1">{rial(line.unitPrice)}</td>
              <td className="border border-black/70 px-2 py-1">{rial(line.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {totals
            .filter(([, amount, strong]) => strong || amount > 0)
            .map(([label, amount, strong]) => (
              <tr key={label} className={cn(strong && 'bg-black/5 font-extrabold')}>
                <td colSpan={5} className="border border-black/70 px-2 py-1 text-start">
                  {label}
                </td>
                <td className="border border-black/70 px-2 py-1">{rial(amount)}</td>
              </tr>
            ))}
        </tfoot>
      </table>
      <p className="mt-2 border border-black/70 px-3 py-1.5">
        مبلغ به حروف: <b>{invoice.totalInWords}</b>
      </p>
      {invoice.note ? <p className="mt-2 text-xs">توضیحات: {invoice.note}</p> : null}

      <footer className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="h-24 border border-dashed border-black/50 pt-2">مهر و امضای فروشنده</div>
        <div className="h-24 border border-dashed border-black/50 pt-2">امضای خریدار</div>
      </footer>
    </>
  );
}
