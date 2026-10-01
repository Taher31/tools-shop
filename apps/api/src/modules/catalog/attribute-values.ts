import { type AttributeValueInput, type FieldError, toEnglishDigits } from '@toolshop/shared';
import type { EffectiveAttribute, StoredAttributeValue, TaxonomyAttribute } from './taxonomy';

export interface AttributeValueColumns {
  attributeId: string;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  optionValues: string[];
}

const EMPTY = {
  textValue: null,
  numberValue: null,
  booleanValue: null,
  optionValues: [] as string[],
};

function convert(
  attribute: TaxonomyAttribute,
  raw: AttributeValueInput['value'],
): Omit<AttributeValueColumns, 'attributeId'> | string | null {
  switch (attribute.type) {
    case 'number': {
      if (raw === '') return null;
      const value =
        typeof raw === 'number' ? raw : Number(toEnglishDigits(String(raw)).replace(/[٫,]/g, '.'));
      return Number.isFinite(value) ? { ...EMPTY, numberValue: value } : 'مقدار باید عدد باشد.';
    }
    case 'boolean': {
      if (raw === '') return null;
      if (typeof raw === 'boolean') return { ...EMPTY, booleanValue: raw };
      if (raw === 'true' || raw === 'false') return { ...EMPTY, booleanValue: raw === 'true' };
      return 'مقدار باید بله یا خیر باشد.';
    }
    case 'select': {
      const value = Array.isArray(raw) ? raw[0] : String(raw);
      if (!value) return null;
      return attribute.options.some((o) => o.value === value)
        ? { ...EMPTY, optionValues: [value] }
        : 'گزینه انتخاب‌شده معتبر نیست.';
    }
    case 'multiselect': {
      const values = (Array.isArray(raw) ? raw : String(raw).split(','))
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return null;
      const invalid = values.filter((v) => !attribute.options.some((o) => o.value === v));
      return invalid.length > 0
        ? 'گزینه انتخاب‌شده معتبر نیست.'
        : { ...EMPTY, optionValues: [...new Set(values)] };
    }
    default: {
      const text = String(raw).trim();
      return text ? { ...EMPTY, textValue: text.slice(0, 500) } : null;
    }
  }
}

/**
 * Validates submitted spec values against the category's (inherited) attributes and
 * converts them to typed columns. Empty values are dropped.
 */
export function resolveAttributeValues(
  inputs: AttributeValueInput[],
  allowed: EffectiveAttribute[],
  options: { enforceRequired: boolean },
): { values: AttributeValueColumns[]; errors: FieldError[] } {
  const allowedById = new Map(allowed.map((entry) => [entry.attribute.id, entry]));
  const values: AttributeValueColumns[] = [];
  const errors: FieldError[] = [];

  inputs.forEach((input, index) => {
    const entry = allowedById.get(input.attributeId);
    if (!entry) {
      errors.push({
        path: `attributes.${index}`,
        message: 'این ویژگی برای دسته‌بندی انتخاب‌شده تعریف نشده است.',
      });
      return;
    }
    const converted = convert(entry.attribute, input.value);
    if (typeof converted === 'string') {
      errors.push({
        path: `attributes.${index}`,
        message: `${entry.attribute.name}: ${converted}`,
      });
    } else if (converted) {
      values.push({ attributeId: input.attributeId, ...converted });
    }
  });

  if (options.enforceRequired) {
    const provided = new Set(values.map((v) => v.attributeId));
    for (const entry of allowed) {
      if (entry.isRequired && !provided.has(entry.attribute.id)) {
        errors.push({ path: 'attributes', message: `مقدار «${entry.attribute.name}» الزامی است.` });
      }
    }
  }
  return { values, errors };
}

/** Stored value back to the shape the admin form edits. */
export function toEditableValue(
  attribute: TaxonomyAttribute,
  value: StoredAttributeValue,
): string | number | boolean | string[] {
  switch (attribute.type) {
    case 'number':
      return value.numberValue ?? '';
    case 'boolean':
      return value.booleanValue ?? false;
    case 'select':
      return value.optionValues[0] ?? '';
    case 'multiselect':
      return value.optionValues;
    default:
      return value.textValue ?? '';
  }
}
