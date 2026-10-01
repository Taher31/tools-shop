import type { AttributeType } from '@toolshop/shared';
import { toPersianDigits } from '@toolshop/shared';

export interface TaxonomyCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface TaxonomyAttributeOption {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface TaxonomyAttribute {
  id: string;
  code: string;
  name: string;
  type: AttributeType;
  unit: string | null;
  groupName: string | null;
  description: string | null;
  isFilterable: boolean;
  isSearchable: boolean;
  isComparable: boolean;
  sortOrder: number;
  options: TaxonomyAttributeOption[];
}

export interface TaxonomyCategoryAttribute {
  categoryId: string;
  attributeId: string;
  isRequired: boolean;
  isFilterable: boolean;
  sortOrder: number;
}

export interface TaxonomyBrand {
  id: string;
  name: string;
  englishName: string | null;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
}

export interface TaxonomySnapshot {
  categories: TaxonomyCategory[];
  attributes: TaxonomyAttribute[];
  categoryAttributes: TaxonomyCategoryAttribute[];
  brands: TaxonomyBrand[];
}

export interface EffectiveAttribute {
  attribute: TaxonomyAttribute;
  isRequired: boolean;
  isFilterable: boolean;
  sortOrder: number;
  inheritedFrom: string;
}

/** Raw attribute value as stored in ProductAttributeValue. */
export interface StoredAttributeValue {
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  optionValues: string[];
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return toPersianDigits(String(rounded)).replace('.', '٫');
}

/**
 * In-memory view of the category tree, attributes and brands. Built from a cached
 * snapshot so tree walks and attribute inheritance never hit the database.
 */
export class Taxonomy {
  readonly categoriesById: Map<string, TaxonomyCategory>;
  readonly categoriesBySlug: Map<string, TaxonomyCategory>;
  readonly attributesById: Map<string, TaxonomyAttribute>;
  readonly attributesByCode: Map<string, TaxonomyAttribute>;
  readonly brandsById: Map<string, TaxonomyBrand>;
  readonly brandsBySlug: Map<string, TaxonomyBrand>;
  private readonly childrenByParent = new Map<string | null, TaxonomyCategory[]>();
  private readonly assignmentsByCategory = new Map<string, TaxonomyCategoryAttribute[]>();

  constructor(readonly snapshot: TaxonomySnapshot) {
    this.categoriesById = new Map(snapshot.categories.map((c) => [c.id, c]));
    this.categoriesBySlug = new Map(snapshot.categories.map((c) => [c.slug, c]));
    this.attributesById = new Map(snapshot.attributes.map((a) => [a.id, a]));
    this.attributesByCode = new Map(snapshot.attributes.map((a) => [a.code, a]));
    this.brandsById = new Map(snapshot.brands.map((b) => [b.id, b]));
    this.brandsBySlug = new Map(snapshot.brands.map((b) => [b.slug, b]));
    for (const category of [...snapshot.categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const siblings = this.childrenByParent.get(category.parentId) ?? [];
      siblings.push(category);
      this.childrenByParent.set(category.parentId, siblings);
    }
    for (const assignment of snapshot.categoryAttributes) {
      const list = this.assignmentsByCategory.get(assignment.categoryId) ?? [];
      list.push(assignment);
      this.assignmentsByCategory.set(assignment.categoryId, list);
    }
  }

  children(parentId: string | null, activeOnly = false): TaxonomyCategory[] {
    const children = this.childrenByParent.get(parentId) ?? [];
    return activeOnly ? children.filter((c) => c.isActive) : children;
  }

  /** Root → ... → category. */
  ancestors(categoryId: string): TaxonomyCategory[] {
    const chain: TaxonomyCategory[] = [];
    const seen = new Set<string>();
    let current = this.categoriesById.get(categoryId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      current = current.parentId ? this.categoriesById.get(current.parentId) : undefined;
    }
    return chain;
  }

  /** The category and all of its descendants. */
  descendantIds(categoryId: string): string[] {
    const result: string[] = [];
    const stack = [categoryId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (result.includes(id)) continue;
      result.push(id);
      stack.push(...this.children(id).map((child) => child.id));
    }
    return result;
  }

  /** True when the whole ancestor chain is active (a hidden parent hides its subtree). */
  isCategoryVisible(categoryId: string): boolean {
    const chain = this.ancestors(categoryId);
    return chain.length > 0 && chain.every((c) => c.isActive);
  }

  /** Attributes assigned to the category or any ancestor (closest assignment wins). */
  effectiveAttributes(categoryId: string): EffectiveAttribute[] {
    const result = new Map<string, EffectiveAttribute>();
    this.ancestors(categoryId).forEach((category, depth) => {
      for (const assignment of this.assignmentsByCategory.get(category.id) ?? []) {
        const attribute = this.attributesById.get(assignment.attributeId);
        if (!attribute) continue;
        result.set(attribute.id, {
          attribute,
          isRequired: assignment.isRequired,
          isFilterable: assignment.isFilterable && attribute.isFilterable,
          sortOrder: depth * 1000 + assignment.sortOrder,
          inheritedFrom: category.id,
        });
      }
    });
    return [...result.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  optionLabel(attribute: TaxonomyAttribute, value: string): string {
    return attribute.options.find((option) => option.value === value)?.label ?? value;
  }

  /** Human readable Persian value, e.g. "۱۸ ولت", "بله", "بتن، فلز". */
  formatValue(attribute: TaxonomyAttribute, value: StoredAttributeValue): string | null {
    switch (attribute.type) {
      case 'number':
        return value.numberValue === null
          ? null
          : `${formatNumber(value.numberValue)}${attribute.unit ? ` ${attribute.unit}` : ''}`;
      case 'boolean':
        return value.booleanValue === null ? null : value.booleanValue ? 'دارد' : 'ندارد';
      case 'select':
      case 'multiselect': {
        if (value.optionValues.length === 0) return null;
        const labels = value.optionValues.map((v) => this.optionLabel(attribute, v)).join('، ');
        return attribute.unit ? `${labels} ${attribute.unit}` : labels;
      }
      default:
        return value.textValue;
    }
  }

  /** Facet tokens used by the search index: "voltage_v:18", "power_source:cordless". */
  facetTokens(attribute: TaxonomyAttribute, value: StoredAttributeValue): string[] {
    switch (attribute.type) {
      case 'number':
        return value.numberValue === null
          ? []
          : [`${attribute.code}:${Math.round(value.numberValue * 1000) / 1000}`];
      case 'boolean':
        return value.booleanValue === null
          ? []
          : [`${attribute.code}:${value.booleanValue ? 'yes' : 'no'}`];
      case 'select':
      case 'multiselect':
        return value.optionValues.map((v) => `${attribute.code}:${v}`);
      default:
        return [];
    }
  }

  /** Label of a facet value for display in filters. */
  facetValueLabel(attribute: TaxonomyAttribute, raw: string): string {
    switch (attribute.type) {
      case 'number':
        return `${formatNumber(Number(raw))}${attribute.unit ? ` ${attribute.unit}` : ''}`;
      case 'boolean':
        return raw === 'yes' ? 'دارد' : 'ندارد';
      default:
        return this.optionLabel(attribute, raw);
    }
  }
}
