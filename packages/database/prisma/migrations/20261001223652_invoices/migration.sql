-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('sale', 'credit_note');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "orderId" UUID NOT NULL,
    "saleInvoiceId" UUID,
    "paymentId" UUID,
    "seller" JSONB NOT NULL,
    "buyer" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "discountTotal" BIGINT NOT NULL DEFAULT 0,
    "shippingCost" BIGINT NOT NULL DEFAULT 0,
    "taxTotal" BIGINT NOT NULL DEFAULT 0,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
    "total" BIGINT NOT NULL,
    "note" TEXT,
    "issuedById" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_type_issuedAt_idx" ON "Invoice"("type", "issuedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleInvoiceId_fkey" FOREIGN KEY ("saleInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice numbers start at 1001.
ALTER SEQUENCE "Invoice_invoiceNumber_seq" RESTART WITH 1001;

-- At most one sale invoice per order (credit notes may be many).
CREATE UNIQUE INDEX "Invoice_one_sale_per_order" ON "Invoice"("orderId") WHERE "type" = 'sale';

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_non_negative" CHECK ("total" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_credit_note_has_sale" CHECK ("type" = 'sale' OR "saleInvoiceId" IS NOT NULL);
