import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { redisOptionsFromUrl } from '../redis/redis.constants';
import { DeadLetterService } from './dead-letter.service';
import { DEFAULT_JOB_OPTIONS, QUEUES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { ...redisOptionsFromUrl(config.redisUrl), maxRetriesPerRequest: null },
        prefix: 'toolshop',
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue({ name: QUEUES.DEAD_LETTER }),
  ],
  providers: [DeadLetterService],
  exports: [BullModule, DeadLetterService],
})
export class QueueModule {}
