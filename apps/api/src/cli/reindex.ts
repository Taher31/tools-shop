import '../bootstrap-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchIndexService } from '../modules/search/search-index.service';

/** `pnpm search:reindex` – rebuilds the product index from the database (zero downtime). */
async function main(): Promise<void> {
  process.env['QUEUE_WORKERS_ENABLED'] = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const count = await app.get(SearchIndexService).reindexAll();
    console.log(`Indexed ${count} products.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
