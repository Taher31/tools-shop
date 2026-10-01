import { Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, RequirePermissions } from '../auth/decorators';
import { MediaService, type UploadedMedia } from './media.service';

/** Hard cap enforced while streaming; the configurable limit is checked by the service. */
const HARD_LIMIT_BYTES = 25 * 1024 * 1024;

@AdminController('media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Post('images')
  @RequirePermissions('media.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HARD_LIMIT_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthContext): Promise<UploadedMedia> {
    return this.media.uploadImage(file, 'products', user.userId);
  }
}
