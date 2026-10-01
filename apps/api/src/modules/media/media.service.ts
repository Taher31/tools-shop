import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_DRIVER, type StorageDriver } from '../../infrastructure/storage/storage.driver';
import { detectImageType } from './image-type';

export interface UploadedMedia {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async uploadImage(
    file: Express.Multer.File | undefined,
    folder: string,
    actorId: string,
  ): Promise<UploadedMedia> {
    if (!file) throw AppException.validation([{ path: 'file', message: 'فایلی ارسال نشده است.' }]);
    if (file.size > this.config.storage.maxUploadBytes) {
      throw new AppException(
        'PAYLOAD_TOO_LARGE',
        `حداکثر حجم مجاز ${Math.round(this.config.storage.maxUploadBytes / 1048576)} مگابایت است.`,
      );
    }
    const type = detectImageType(file.buffer);
    if (!type)
      throw new AppException(
        'UNSUPPORTED_MEDIA_TYPE',
        'فقط تصاویر JPG، PNG، WebP، GIF و AVIF پذیرفته می‌شوند.',
      );

    const now = new Date();
    const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${type.extension}`;
    const stored = await this.storage.put(key, file.buffer, type.mime);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        storageKey: stored.key,
        url: stored.url,
        mimeType: type.mime,
        sizeBytes: file.size,
        originalName: file.originalname?.slice(0, 200) ?? null,
        uploadedById: actorId,
      },
    });
    return { id: asset.id, url: asset.url, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
  }
}
