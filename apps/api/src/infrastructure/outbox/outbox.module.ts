import { Global, Module } from '@nestjs/common';
import { OutboxRelay } from './outbox.relay';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  providers: [OutboxRelay, OutboxService],
  exports: [OutboxService, OutboxRelay],
})
export class OutboxModule {}
