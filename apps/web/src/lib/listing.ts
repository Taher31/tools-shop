import { ATTRIBUTE_FILTER_PREFIX, PRODUCT_SORTS, type ProductSort } from '@toolshop/shared';

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ListingState {
  q?: string;
  brand: string[];
  attributes: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  onSale: boolean;
  sort: ProductSort;
  page: number;
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);
const list = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
const positiveInt = (value: string | undefined): number | undefined => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
};

/** URL search params → listing state (unknown values are ignored, never trusted). */
export function parseListingParams(params: RawSearchParams): ListingState {
  const attributes: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(ATTRIBUTE_FILTER_PREFIX)) {
      const values = list(value);
      if (values.length > 0) attributes[key.slice(ATTRIBUTE_FILTER_PREFIX.length)] = values;
    }
  }
  const sort = first(params.sort);
  return {
    q: first(params.q)?.trim() || undefined,
    brand: list(params.brand),
    attributes,
    minPrice: positiveInt(first(params.minPrice)),
    maxPrice: positiveInt(first(params.maxPrice)),
    inStock: first(params.inStock) === 'true',
    onSale: first(params.onSale) === 'true',
    sort: PRODUCT_SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : 'relevance',
    page: Math.min(500, Math.max(1, positiveInt(first(params.page)) ?? 1)),
  };
}

/** Listing state → URLSearchParams (shared by the API call and the page links). */
export function listingSearchParams(state: Partial<ListingState>): URLSearchParams {
  const search = new URLSearchParams();
  if (state.q) search.set('q', state.q);
  if (state.brand?.length) search.set('brand', state.brand.join(','));
  for (const [code, values] of Object.entries(state.attributes ?? {})) {
    if (values.length > 0) search.set(`${ATTRIBUTE_FILTER_PREFIX}${code}`, values.join(','));
  }
  if (state.minPrice !== undefined) search.set('minPrice', String(state.minPrice));
  if (state.maxPrice !== undefined) search.set('maxPrice', String(state.maxPrice));
  if (state.inStock) search.set('inStock', 'true');
  if (state.onSale) search.set('onSale', 'true');
  if (state.sort && state.sort !== 'relevance') search.set('sort', state.sort);
  if (state.page && state.page > 1) search.set('page', String(state.page));
  return search;
}

export function hasActiveFilters(state: ListingState): boolean {
  return (
    state.brand.length > 0 ||
    Object.keys(state.attributes).length > 0 ||
    state.minPrice !== undefined ||
    state.maxPrice !== undefined ||
    state.inStock ||
    state.onSale ||
    state.sort !== 'relevance' ||
    state.page > 1
  );
}
