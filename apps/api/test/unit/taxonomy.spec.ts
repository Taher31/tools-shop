import { describe, expect, it } from 'vitest';
import { resolveAttributeValues } from '../../src/modules/catalog/attribute-values';
import {
  Taxonomy,
  type TaxonomyAttribute,
  type TaxonomyCategory,
} from '../../src/modules/catalog/taxonomy';

function category(
  id: string,
  parentId: string | null,
  isActive = true,
  sortOrder = 0,
): TaxonomyCategory {
  return {
    id,
    parentId,
    name: `دسته ${id}`,
    slug: `cat-${id}`,
    description: null,
    imageUrl: null,
    isActive,
    sortOrder,
    seoTitle: null,
    seoDescription: null,
  };
}

function attribute(id: string, overrides: Partial<TaxonomyAttribute>): TaxonomyAttribute {
  return {
    id,
    code: id,
    name: `ویژگی ${id}`,
    type: 'text',
    unit: null,
    groupName: null,
    description: null,
    isFilterable: true,
    isSearchable: true,
    isComparable: true,
    sortOrder: 0,
    options: [],
    ...overrides,
  };
}

const voltage = attribute('voltage', { name: 'ولتاژ', type: 'number', unit: 'ولت' });
const power = attribute('power', {
  name: 'منبع تغذیه',
  type: 'select',
  options: [
    { id: 'o1', value: 'cordless', label: 'شارژی', sortOrder: 0 },
    { id: 'o2', value: 'corded', label: 'برقی', sortOrder: 1 },
  ],
});
const materials = attribute('materials', {
  name: 'مناسب برای',
  type: 'multiselect',
  options: [
    { id: 'm1', value: 'wood', label: 'چوب', sortOrder: 0 },
    { id: 'm2', value: 'metal', label: 'فلز', sortOrder: 1 },
  ],
});
const brushless = attribute('brushless', {
  name: 'موتور براشلس',
  type: 'boolean',
  isFilterable: false,
});

const taxonomy = new Taxonomy({
  categories: [
    category('root', null),
    category('drills', 'root', true, 2),
    category('cordless', 'drills'),
    category('hidden', 'root', false, 1),
    category('under-hidden', 'hidden'),
  ],
  attributes: [voltage, power, materials, brushless],
  categoryAttributes: [
    {
      categoryId: 'root',
      attributeId: 'power',
      isRequired: false,
      isFilterable: true,
      sortOrder: 1,
    },
    {
      categoryId: 'drills',
      attributeId: 'voltage',
      isRequired: false,
      isFilterable: true,
      sortOrder: 1,
    },
    {
      categoryId: 'drills',
      attributeId: 'brushless',
      isRequired: false,
      isFilterable: true,
      sortOrder: 2,
    },
    // The child overrides the inherited assignment and makes it required.
    {
      categoryId: 'cordless',
      attributeId: 'voltage',
      isRequired: true,
      isFilterable: true,
      sortOrder: 0,
    },
    {
      categoryId: 'cordless',
      attributeId: 'materials',
      isRequired: false,
      isFilterable: true,
      sortOrder: 1,
    },
  ],
  brands: [],
});

const empty = { textValue: null, numberValue: null, booleanValue: null, optionValues: [] };

describe('Taxonomy', () => {
  it('walks ancestors, children and descendants', () => {
    expect(taxonomy.ancestors('cordless').map((c) => c.id)).toEqual(['root', 'drills', 'cordless']);
    expect(taxonomy.children('root').map((c) => c.id)).toEqual(['hidden', 'drills']);
    expect(taxonomy.children('root', true).map((c) => c.id)).toEqual(['drills']);
    expect(taxonomy.descendantIds('root').sort()).toEqual([
      'cordless',
      'drills',
      'hidden',
      'root',
      'under-hidden',
    ]);
  });

  it('hides a whole subtree when an ancestor is inactive', () => {
    expect(taxonomy.isCategoryVisible('cordless')).toBe(true);
    expect(taxonomy.isCategoryVisible('under-hidden')).toBe(false);
    expect(taxonomy.isCategoryVisible('missing')).toBe(false);
  });

  it('inherits attributes from ancestors with the closest assignment winning', () => {
    const effective = taxonomy.effectiveAttributes('cordless');
    expect(effective.map((e) => e.attribute.id)).toEqual([
      'power',
      'brushless',
      'voltage',
      'materials',
    ]);
    const voltageEntry = effective.find((e) => e.attribute.id === 'voltage');
    expect(voltageEntry?.isRequired).toBe(true);
    expect(voltageEntry?.inheritedFrom).toBe('cordless');
    // Filterable only when both the assignment and the attribute allow it.
    expect(effective.find((e) => e.attribute.id === 'brushless')?.isFilterable).toBe(false);
  });

  it('formats values in Persian with units and option labels', () => {
    expect(taxonomy.formatValue(voltage, { ...empty, numberValue: 18 })).toBe('۱۸ ولت');
    expect(taxonomy.formatValue(voltage, { ...empty, numberValue: 1.5 })).toBe('۱٫۵ ولت');
    expect(taxonomy.formatValue(brushless, { ...empty, booleanValue: true })).toBe('دارد');
    expect(taxonomy.formatValue(materials, { ...empty, optionValues: ['wood', 'metal'] })).toBe(
      'چوب، فلز',
    );
    expect(taxonomy.formatValue(voltage, empty)).toBeNull();
  });

  it('produces stable facet tokens for the search index', () => {
    expect(taxonomy.facetTokens(voltage, { ...empty, numberValue: 18 })).toEqual(['voltage:18']);
    expect(taxonomy.facetTokens(brushless, { ...empty, booleanValue: false })).toEqual([
      'brushless:no',
    ]);
    expect(taxonomy.facetTokens(materials, { ...empty, optionValues: ['wood', 'metal'] })).toEqual([
      'materials:wood',
      'materials:metal',
    ]);
    expect(taxonomy.facetValueLabel(power, 'cordless')).toBe('شارژی');
  });
});

describe('resolveAttributeValues', () => {
  const allowed = taxonomy.effectiveAttributes('cordless');

  it('converts Persian digits and decimal separators to typed columns', () => {
    const { values, errors } = resolveAttributeValues(
      [
        { attributeId: 'voltage', value: '۱۸٫۵' },
        { attributeId: 'power', value: 'cordless' },
        { attributeId: 'materials', value: ['wood', 'wood', 'metal'] },
        { attributeId: 'brushless', value: 'true' },
      ],
      allowed,
      { enforceRequired: true },
    );
    expect(errors).toEqual([]);
    expect(values).toEqual([
      { attributeId: 'voltage', ...empty, numberValue: 18.5 },
      { attributeId: 'power', ...empty, optionValues: ['cordless'] },
      { attributeId: 'materials', ...empty, optionValues: ['wood', 'metal'] },
      { attributeId: 'brushless', ...empty, booleanValue: true },
    ]);
  });

  it('rejects invalid values, unknown options and attributes not assigned to the category', () => {
    const { errors } = resolveAttributeValues(
      [
        { attributeId: 'voltage', value: 'هجده' },
        { attributeId: 'power', value: 'solar' },
        { attributeId: 'not-assigned', value: 'x' },
      ],
      allowed,
      { enforceRequired: false },
    );
    expect(errors.map((e) => e.path)).toEqual(['attributes.0', 'attributes.1', 'attributes.2']);
  });

  it('drops empty values and reports missing required attributes', () => {
    const { values, errors } = resolveAttributeValues(
      [{ attributeId: 'voltage', value: '' }],
      allowed,
      {
        enforceRequired: true,
      },
    );
    expect(values).toEqual([]);
    expect(errors).toEqual([{ path: 'attributes', message: 'مقدار «ولتاژ» الزامی است.' }]);
  });
});
