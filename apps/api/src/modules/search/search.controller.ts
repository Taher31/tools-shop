import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ATTRIBUTE_FILTER_PREFIX,
  type ProductSearchResult,
  productSearchQuerySchema,
  type SearchSuggestion,
} from '@toolshop/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminController, Public, RequirePermissions } from '../auth/decorators';
import { SearchIndexService } from './search-index.service';
import { SearchService } from './search.service';

/** Collects `attr.<code>=a,b` query parameters into `attributes`. */
export function parseSearchParams(raw: Record<string, unknown>) {
  const attributes: Record<string, string[]> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(ATTRIBUTE_FILTER_PREFIX)) {
      const code = key.slice(ATTRIBUTE_FILTER_PREFIX.length);
      const values = (Array.isArray(value) ? value : [value])
        .flatMap((v) => String(v).split(','))
        .map((v) => v.trim())
        .filter(Boolean);
      if (/^[a-z][a-z0-9_]{1,62}$/.test(code) && values.length > 0) attributes[code] = values.slice(0, 20);
    } else {
      rest[key] = value;
    }
  }
  return new ZodValidationPipe(productSearchQuerySchema).transform({ ...rest, attributes });
}

@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Product listing and full-text search (category pages use `?category=slug`). */
  @Public()
  @Get('products')
  list(@Query() raw: Record<string, unknown>): Promise<ProductSearchResult> {
    return this.search.search(parseSearchParams(raw));
  }

  @Public()
  @Get('search/suggest')
  suggest(@Query('q') q: string | undefined): Promise<SearchSuggestion> {
    return this.search.suggest(typeof q === 'string' ? q.slice(0, 100) : '');
  }
}

@AdminController('search')
export class AdminSearchController {
  constructor(private readonly index: SearchIndexService) {}

  @Post('reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('search.reindex')
  async reindex(): Promise<{ queued: true }> {
    await this.index.enqueueFullReindex();
    return { queued: true };
  }

  @Get('health')
  @RequirePermissions('search.reindex')
  async health(): Promise<{ healthy: boolean; index: string }> {
    return { healthy: await this.index.isHealthy(), index: this.index.indexUid };
  }
}
