import type { CategoryTreeNode, PublicSettings } from '@toolshop/shared';
import { cache } from 'react';
import { siteConfig } from '@/config/site';
import { serverApi } from './api/server';

const FALLBACK_SETTINGS: PublicSettings = {
  store: {
    storeName: siteConfig.fallbackName,
    tagline: null,
    logoUrl: null,
    supportPhone: null,
    supportEmail: null,
    address: null,
    workingHours: null,
    socials: { instagram: null, telegram: null, eitaa: null, bale: null, aparat: null, linkedin: null },
  },
  legal: { companyName: null, registrationNumber: null, nationalId: null, economicCode: null, licenses: null, trustBadges: [] },
  commerce: { displayCurrency: 'IRT', pricesIncludeTax: true, taxRatePercent: 10 },
};

/** Store identity from Admin → Settings (cached; falls back gracefully if the API is down). */
export const getSettings = cache(async (): Promise<PublicSettings> => {
  try {
    return await serverApi<PublicSettings>('/settings/public', { revalidate: 300, tags: ['settings'] });
  } catch {
    return FALLBACK_SETTINGS;
  }
});

export const getCategoryTree = cache(async (): Promise<CategoryTreeNode[]> => {
  try {
    return await serverApi<CategoryTreeNode[]>('/categories', { revalidate: 300, tags: ['categories'] });
  } catch {
    return [];
  }
});
