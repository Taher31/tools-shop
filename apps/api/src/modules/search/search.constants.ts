import { normalizeForSearch, SEARCH_SYNONYM_GROUPS } from '@toolshop/shared';
import type { Settings } from 'meilisearch';

export const PRODUCT_INDEX = 'products';

/** Persian function words that carry no meaning for product search. */
const STOP_WORDS = [
  'و',
  'با',
  'در',
  'برای',
  'از',
  'به',
  'را',
  'که',
  'یا',
  'این',
  'آن',
  'مدل',
  'خرید',
  'قیمت',
];

export function buildSynonyms(): Record<string, string[]> {
  const synonyms: Record<string, string[]> = {};
  for (const group of SEARCH_SYNONYM_GROUPS) {
    const terms = [...new Set(group.map((term) => normalizeForSearch(term)).filter(Boolean))];
    for (const term of terms) {
      synonyms[term] = [
        ...new Set([...(synonyms[term] ?? []), ...terms.filter((other) => other !== term)]),
      ];
    }
  }
  return synonyms;
}

export const PRODUCT_INDEX_SETTINGS: Settings = {
  searchableAttributes: [
    'titleSearch',
    'title',
    'englishTitle',
    'skus',
    'model',
    'modelSearch',
    'brandSearch',
    'categorySearch',
    'tagsSearch',
    'variantSearch',
    'specsSearch',
    'barcodes',
  ],
  filterableAttributes: [
    'categoryIds',
    'brandSlug',
    'facets',
    'price',
    'inStock',
    'onSale',
    'isFeatured',
  ],
  sortableAttributes: ['price', 'publishedAt', 'soldCount', 'ratingAverage'],
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
    'inStockRank:desc',
    'soldCount:desc',
  ],
  stopWords: STOP_WORDS.map((word) => normalizeForSearch(word)),
  synonyms: buildSynonyms(),
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    disableOnAttributes: ['skus', 'barcodes', 'model'],
    // "18 ولت" must never match a 12-volt tool.
    disableOnNumbers: true,
  },
  pagination: { maxTotalHits: 10_000 },
  faceting: { maxValuesPerFacet: 300 },
};
