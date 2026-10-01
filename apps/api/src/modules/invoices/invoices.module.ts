import { Module } from '@nestjs/common';
import { AccountInvoicesController, AdminInvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [AccountInvoicesController, AdminInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
