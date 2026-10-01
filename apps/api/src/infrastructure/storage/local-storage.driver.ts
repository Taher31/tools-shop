import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageDriver, StoredObject } from './storage.driver';

export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;

  constructor(
    directory: string,
    private readonly publicBaseUrl: string,
  ) {
    this.root = path.resolve(process.cwd(), directory);
  }

  get rootDirectory(): string {
    return this.root;
  }

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return target;
  }
}
