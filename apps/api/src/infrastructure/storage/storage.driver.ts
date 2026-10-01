export interface StoredObject {
  key: string;
  url: string;
}

/** Object storage abstraction: local disk in development, S3-compatible in production. */
export interface StorageDriver {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
