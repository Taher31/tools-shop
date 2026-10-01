import { z } from 'zod';
import { assetUrlSchema, emailSchema, optionalTextSchema, textSchema, urlSchema } from './common';

const optionalUrl = urlSchema.nullish().or(z.literal('').transform(() => null));

/** Public store identity. Placeholders are seeded until the brand is finalized. */
export const storeSettingsSchema = z.object({
  storeName: textSchema({ max: 80 }),
  tagline: optionalTextSchema(160),
  logoUrl: assetUrlSchema.nullish().or(z.literal('').transform(() => null)),
  supportPhone: optionalTextSchema(40),
  supportEmail: emailSchema.nullish().or(z.literal('').transform(() => null)),
  address: optionalTextSchema(400),
  workingHours: optionalTextSchema(160),
  socials: z
    .object({
      instagram: optionalUrl,
      telegram: optionalUrl,
      eitaa: optionalUrl,
      bale: optionalUrl,
      aparat: optionalUrl,
      linkedin: optionalUrl,
    })
    .default({ instagram: null, telegram: null, eitaa: null, bale: null, aparat: null, linkedin: null }),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const trustBadgeSchema = z.object({
  title: textSchema({ max: 80 }),
  imageUrl: assetUrlSchema,
  linkUrl: optionalUrl,
});
export type TrustBadge = z.infer<typeof trustBadgeSchema>;

/** Legal identity shown in the footer and on invoices (eNamad, licenses, company data). */
export const legalSettingsSchema = z.object({
  companyName: optionalTextSchema(160),
  registrationNumber: optionalTextSchema(40),
  nationalId: optionalTextSchema(20),
  economicCode: optionalTextSchema(20),
  licenses: optionalTextSchema(1000),
  trustBadges: z.array(trustBadgeSchema).max(6).default([]),
});
export type LegalSettings = z.infer<typeof legalSettingsSchema>;

export const commerceSettingsSchema = z.object({
  displayCurrency: z.enum(['IRT', 'IRR']).default('IRT'),
  /** VAT percent (Iran: 10%). */
  taxRatePercent: z.coerce.number().min(0).max(100).default(10),
  /** When true catalog prices already include VAT and tax is only reported, not added. */
  pricesIncludeTax: z.boolean().default(true),
  /** Default low-stock threshold for new variants. */
  defaultLowStockThreshold: z.coerce.number().int().min(0).default(2),
  /** Allow customers to see exact stock count when it is below this number. */
  showStockCountBelow: z.coerce.number().int().min(0).default(5),
});
export type CommerceSettings = z.infer<typeof commerceSettingsSchema>;

export const SETTINGS_GROUPS = {
  store: storeSettingsSchema,
  legal: legalSettingsSchema,
  commerce: commerceSettingsSchema,
} as const;
export type SettingsGroup = keyof typeof SETTINGS_GROUPS;

export interface PublicSettings {
  store: StoreSettings;
  legal: LegalSettings;
  commerce: Pick<CommerceSettings, 'displayCurrency' | 'pricesIncludeTax' | 'taxRatePercent'>;
}
