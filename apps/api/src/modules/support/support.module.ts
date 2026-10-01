import { Module } from '@nestjs/common';
import { AccountTicketsController, AdminTicketsController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [AccountTicketsController, AdminTicketsController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
