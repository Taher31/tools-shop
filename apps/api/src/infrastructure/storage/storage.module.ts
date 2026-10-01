import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { LocalStorageDriver } from './local-storage.driver';
import { S3StorageDriver } from './s3-storage.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [AppConfig],
      useFactory: (config: AppConfig): StorageDriver => {
        const { storage } = config;
        if (storage.driver === 's3') {
          return new S3StorageDriver({
            endpoint: storage.s3.endpoint,
            region: storage.s3.region,
            bucket: storage.s3.bucket ?? '',
            accessKeyId: storage.s3.accessKeyId ?? '',
            secretAccessKey: storage.s3.secretAccessKey ?? '',
            forcePathStyle: storage.s3.forcePathStyle,
            publicBaseUrl: storage.publicBaseUrl,
          });
        }
        return new LocalStorageDriver(storage.localDir, storage.publicBaseUrl);
      },
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
