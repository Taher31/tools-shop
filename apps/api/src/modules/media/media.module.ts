import { Module } from '@nestjs/common';
import { AdminMediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [AdminMediaController],
  providers: [MediaService],
})
export class MediaModule {}
