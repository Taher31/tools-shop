'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AdminBrandView,
  type AdminCategoryView,
  type AdminProductDetail,
  type AdminProductListItem,
  type AttributeView,
  type FieldError,
  type Paginated,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductStatus,
  type ProductUpsertInput,
  USAGE_TYPE_LABELS,
  USAGE_TYPES,
  type UsageType,
} from '@toolshop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  NativeSelect,
  Switch,
  Textarea,
  toast,
} from '@toolshop/ui';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ProductImage } from '@/components/product/product-image';
import { usePermissions } from '@/hooks/use-permissions';
import { api, toQueryString } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { faNumber, price } from '@/lib/format';
import { MoneyInput } from './money-input';
import { useAdminMutation } from './query';

type AttributeValue = string | number | boolean | string[];

interface VariantRow {
  id?: string;
  sku: string;
  title: string;
  optionName: string;
  optionValue: string;
  barcode: string;
  price: number | null;
  compareAtPrice: number | null;
  lowStockThreshold: number;
  weightGrams: string;
  isActive: boolean;
}

interface FormValues {
  title: string;
  englishTitle: string;
  slug: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string;
  model: string;
  manufacturer: string;
  countryOfOrigin: string;
  usageType: UsageType | '';
  warranty: string;
  shortDescription: string;
  description: string;
  videoUrl: string;
  tags: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  images: { url: string; alt: string }[];
  attributes: Record<string, AttributeValue>;
  variants: VariantRow[];
  relatedProductIds: string[];
  accessoryProductIds: string[];
}

interface EffectiveAttribute {
  attribute: AttributeView;
  isRequired: boolean;
  isFilterable: boolean;
}

const emptyVariant = (): VariantRow => ({
  sku: '',
  title: '',
  optionName: '',
  optionValue: '',
  barcode: '',
  price: null,
  compareAtPrice: null,
  lowStockThreshold: 2,
  weightGrams: '',
  isActive: true,
});

function toFormValues(product: AdminProductDetail | null): FormValues {
  return {
    title: product?.title ?? '',
    englishTitle: product?.englishTitle ?? '',
    slug: product?.slug ?? '',
    status: product?.status ?? 'draft',
    categoryId: product?.categoryId ?? '',
    brandId: product?.brandId ?? '',
    model: product?.model ?? '',
    manufacturer: product?.manufacturer ?? '',
    countryOfOrigin: product?.countryOfOrigin ?? '',
    usageType: product?.usageType ?? '',
    warranty: product?.warranty ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    videoUrl: product?.videoUrl ?? '',
    tags: product?.tags.join('، ') ?? '',
    isFeatured: product?.isFeatured ?? false,
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
    canonicalUrl: product?.canonicalUrl ?? '',
    images: product?.images.map((image) => ({ url: image.url, alt: image.alt ?? '' })) ?? [],
    attributes: Object.fromEntries(product?.attributes.map((a) => [a.attributeId, a.value]) ?? []),
    variants: product?.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title ?? '',
      optionName: variant.options[0]?.name ?? '',
      optionValue: variant.options[0]?.value ?? '',
      barcode: variant.barcode ?? '',
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      lowStockThreshold: variant.lowStockThreshold,
      weightGrams: variant.weightGrams ? String(variant.weightGrams) : '',
      isActive: variant.isActive,
    })) ?? [emptyVariant()],
    relatedProductIds: product?.relatedProductIds ?? [],
    accessoryProductIds: product?.accessoryProductIds ?? [],
  };
}

function isEmptyValue(value: AttributeValue | undefined): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function toInput(values: FormValues, attributes: EffectiveAttribute[]): ProductUpsertInput {
  const nullable = (value: string) => (value.trim() ? value.trim() : null);
  return {
    title: values.title,
    englishTitle: nullable(values.englishTitle),
    slug: values.slug.trim() || undefined,
    status: values.status,
    categoryId: values.categoryId,
    brandId: values.brandId || null,
    model: nullable(values.model),
    manufacturer: nullable(values.manufacturer),
    countryOfOrigin: nullable(values.countryOfOrigin),
    usageType: values.usageType || null,
    warranty: nullable(values.warranty),
    shortDescription: nullable(values.shortDescription),
    description: nullable(values.description),
    videoUrl: nullable(values.videoUrl),
    tags: values.tags
      .split(/[،,]/)
      .map((t) => t.trim())
      .filter(Boolean),
    isFeatured: values.isFeatured,
    seoTitle: nullable(values.seoTitle),
    seoDescription: nullable(values.seoDescription),
    canonicalUrl: nullable(values.canonicalUrl),
    images: values.images.map((image) => ({ url: image.url, alt: nullable(image.alt) })),
    attributes: attributes
      .filter((entry) => !isEmptyValue(values.attributes[entry.attribute.id]))
      .map((entry) => ({
        attributeId: entry.attribute.id,
        value: values.attributes[entry.attribute.id] as AttributeValue,
      })),
    variants: values.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: nullable(variant.barcode),
      title: nullable(variant.title),
      options:
        variant.optionName.trim() && variant.optionValue.trim()
          ? [{ name: variant.optionName.trim(), value: variant.optionValue.trim() }]
          : [],
      price: variant.price ?? 0,
      compareAtPrice: variant.compareAtPrice,
      lowStockThreshold: Number(variant.lowStockThreshold) || 0,
      weightGrams: variant.weightGrams ? Number(variant.weightGrams) : null,
      isActive: variant.isActive,
    })),
    relatedProductIds: values.relatedProductIds,
    accessoryProductIds: values.accessoryProductIds,
  } as ProductUpsertInput;
}

function flattenCategories(nodes: AdminCategoryView[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${'— '.repeat(depth)}${node.name}${node.isActive ? '' : ' (غیرفعال)'}` },
    ...flattenCategories(node.children as AdminCategoryView[], depth + 1),
  ]);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function AttributeInput({
  entry,
  value,
  onChange,
}: {
  entry: EffectiveAttribute;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue) => void;
}) {
  const { attribute } = entry;
  const id = `attr-${attribute.code}`;
  const label = (
    <>
      {attribute.name}
      {attribute.unit ? <span className="text-muted-foreground"> ({attribute.unit})</span> : null}
    </>
  );
  switch (attribute.type) {
    case 'number':
      return (
        <Field label={label} htmlFor={id} required={entry.isRequired}>
          <Input
            id={id}
            inputMode="decimal"
            dir="ltr"
            className="text-left"
            value={value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case 'boolean':
      return (
        <Field label={label} htmlFor={id} required={entry.isRequired}>
          <NativeSelect
            id={id}
            value={value === undefined || value === '' ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value === 'true')}
          >
            <option value="">— مشخص نشده —</option>
            <option value="true">دارد / بله</option>
            <option value="false">ندارد / خیر</option>
          </NativeSelect>
        </Field>
      );
    case 'select':
      return (
        <Field label={label} htmlFor={id} required={entry.isRequired}>
          <NativeSelect
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— انتخاب کنید —</option>
            {attribute.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <Field label={label} required={entry.isRequired}>
          <div className="border-input bg-card flex flex-wrap gap-x-4 gap-y-2 rounded-md border px-3 py-2">
            {attribute.options.map((option) => (
              <label key={option.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, option.value]
                        : selected.filter((v) => v !== option.value),
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>
      );
    }
    default:
      return (
        <Field label={label} htmlFor={id} required={entry.isRequired}>
          <Input
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
  }
}

function ProductPicker({
  value,
  onChange,
  excludeId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  excludeId?: string;
}) {
  const [term, setTerm] = useState('');
  const results = useQuery({
    queryKey: ['admin', 'product-picker', term],
    queryFn: () =>
      api.get<Paginated<AdminProductListItem>>(
        `/admin/products${toQueryString({ q: term, pageSize: 8 })}`,
      ),
    enabled: term.trim().length >= 2,
  });
  const selected = useQuery({
    queryKey: ['admin', 'product-picker-selected', value],
    queryFn: async () => {
      const items = await Promise.all(
        value.map((id) => api.get<AdminProductDetail>(`/admin/products/${id}`).catch(() => null)),
      );
      return items.filter((p): p is AdminProductDetail => p !== null);
    },
    enabled: value.length > 0,
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1.5 py-1">
            {selected.data?.find((p) => p.id === id)?.title ?? '…'}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== id))}
              aria-label="حذف"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="جستجوی محصول برای افزودن (نام یا SKU)…"
        />
        {results.data && term.trim().length >= 2 ? (
          <ul className="border-border bg-popover absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border shadow-lg">
            {results.data.items
              .filter((p) => p.id !== excludeId && !value.includes(p.id))
              .map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="hover:bg-muted w-full px-3 py-2 text-start text-sm"
                    onClick={() => {
                      onChange([...value, p.id]);
                      setTerm('');
                    }}
                  >
                    {p.title}
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function ProductForm({ product }: { product: AdminProductDetail | null }) {
  const router = useRouter();
  const { can } = usePermissions();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldError[]>([]);
  const form = useForm<FormValues>({ defaultValues: toFormValues(product) });
  const variants = useFieldArray({ control: form.control, name: 'variants', keyName: 'key' });
  const images = useFieldArray({ control: form.control, name: 'images', keyName: 'key' });
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<AdminCategoryView[]>('/admin/categories'),
  });
  const brands = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<AdminBrandView[]>('/admin/brands'),
  });
  const effective = useQuery({
    queryKey: ['admin', 'effective-attributes', categoryId],
    queryFn: () =>
      api.get<EffectiveAttribute[]>(`/admin/categories/${categoryId}/effective-attributes`),
    enabled: Boolean(categoryId),
  });
  const canEditPrice = !product || can('product.price.update');

  const save = useAdminMutation(
    (input: ProductUpsertInput) =>
      product
        ? api.put<AdminProductDetail>(`/admin/products/${product.id}`, input)
        : api.post<AdminProductDetail>('/admin/products', input),
    {
      success: 'محصول ذخیره شد.',
      onSuccess: (saved) => {
        setServerErrors([]);
        form.reset(toFormValues(saved));
        if (!product) router.replace(`/admin/products/${saved.id}`);
      },
    },
  );
  const remove = useAdminMutation(() => api.delete(`/admin/products/${product?.id}`), {
    success: 'محصول حذف شد.',
    onSuccess: () => router.replace('/admin/products'),
  });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        const uploaded = await api.upload<{ url: string }>('/admin/media/images', body);
        images.append({ url: uploaded.url, alt: form.getValues('title') });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = form.handleSubmit((values) => {
    if (!values.categoryId) {
      form.setError('categoryId', { message: 'دسته‌بندی را انتخاب کنید.' });
      return;
    }
    save.mutate(toInput(values, effective.data ?? []), {
      onError: (error) => {
        if (error instanceof ApiError && error.details.length > 0) {
          setServerErrors(error.details);
          for (const detail of error.details) {
            if (/^(variants\.\d+\.\w+|title|slug|categoryId|brandId)$/.test(detail.path)) {
              form.setError(detail.path as never, { message: detail.message });
            }
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
    });
  });

  const errors = form.formState.errors;
  const attributeEntries = effective.data ?? [];
  const groups = new Map<string, EffectiveAttribute[]>();
  for (const entry of attributeEntries) {
    const key = entry.attribute.groupName ?? 'سایر مشخصات';
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {serverErrors.length > 0 ? (
        <Alert variant="destructive" title="لطفاً موارد زیر را اصلاح کنید">
          <ul className="list-disc ps-5">
            {serverErrors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="اطلاعات اصلی">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="عنوان محصول"
                htmlFor="title"
                required
                error={errors.title?.message}
                className="md:col-span-2"
              >
                <Input id="title" {...form.register('title', { required: 'عنوان الزامی است.' })} />
              </Field>
              <Field label="عنوان انگلیسی" htmlFor="englishTitle">
                <Input
                  id="englishTitle"
                  dir="ltr"
                  className="text-left"
                  {...form.register('englishTitle')}
                />
              </Field>
              <Field
                label="نامک (URL)"
                htmlFor="slug"
                error={errors.slug?.message}
                hint="خالی بگذارید تا خودکار ساخته شود."
              >
                <Input id="slug" dir="ltr" className="text-left" {...form.register('slug')} />
              </Field>
              <Field
                label="دسته‌بندی"
                htmlFor="categoryId"
                required
                error={errors.categoryId?.message}
              >
                <NativeSelect id="categoryId" {...form.register('categoryId')}>
                  <option value="">— انتخاب دسته‌بندی —</option>
                  {flattenCategories(categories.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="برند" htmlFor="brandId">
                <NativeSelect id="brandId" {...form.register('brandId')}>
                  <option value="">— بدون برند —</option>
                  {brands.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="مدل" htmlFor="model">
                <Input id="model" dir="ltr" className="text-left" {...form.register('model')} />
              </Field>
              <Field label="سازنده" htmlFor="manufacturer">
                <Input id="manufacturer" {...form.register('manufacturer')} />
              </Field>
              <Field label="کشور سازنده" htmlFor="countryOfOrigin">
                <Input id="countryOfOrigin" {...form.register('countryOfOrigin')} />
              </Field>
              <Field label="نوع کاربری" htmlFor="usageType">
                <NativeSelect id="usageType" {...form.register('usageType')}>
                  <option value="">—</option>
                  {USAGE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {USAGE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="گارانتی" htmlFor="warranty" className="md:col-span-2">
                <Input id="warranty" {...form.register('warranty')} />
              </Field>
              <Field
                label="برچسب‌ها"
                htmlFor="tags"
                hint="با کاما جدا کنید؛ در جستجو استفاده می‌شوند."
                className="md:col-span-2"
              >
                <Input id="tags" {...form.register('tags')} />
              </Field>
            </div>
          </Section>

          <Section
            title="تنوع‌ها، قیمت و SKU"
            description="قیمت‌ها به تومان وارد می‌شوند. موجودی هر تنوع از بخش «موجودی» مدیریت می‌شود."
          >
            {!canEditPrice ? (
              <Alert variant="info" className="mb-3">
                شما مجوز تغییر قیمت ندارید؛ قیمت‌ها فقط‌خواندنی هستند.
              </Alert>
            ) : null}
            <div className="space-y-3">
              {variants.fields.map((field, index) => {
                const existing = product?.variants.find((v) => v.id === field.id);
                const variantErrors = errors.variants?.[index];
                return (
                  <div key={field.key} className="border-border rounded-md border p-3">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field
                        label="SKU"
                        htmlFor={`v-${index}-sku`}
                        required
                        error={variantErrors?.sku?.message}
                      >
                        <Input
                          id={`v-${index}-sku`}
                          dir="ltr"
                          className="text-left uppercase"
                          {...form.register(`variants.${index}.sku`)}
                        />
                      </Field>
                      <Field label="قیمت فروش" required error={variantErrors?.price?.message}>
                        <Controller
                          control={form.control}
                          name={`variants.${index}.price`}
                          render={({ field: f }) => (
                            <MoneyInput
                              value={f.value}
                              onChange={f.onChange}
                              aria-invalid={Boolean(variantErrors?.price)}
                            />
                          )}
                        />
                      </Field>
                      <Field
                        label="قیمت قبل از تخفیف"
                        error={variantErrors?.compareAtPrice?.message}
                      >
                        <Controller
                          control={form.control}
                          name={`variants.${index}.compareAtPrice`}
                          render={({ field: f }) => (
                            <MoneyInput value={f.value} onChange={f.onChange} />
                          )}
                        />
                      </Field>
                      <Field
                        label="بارکد"
                        htmlFor={`v-${index}-barcode`}
                        error={variantErrors?.barcode?.message}
                      >
                        <Input
                          id={`v-${index}-barcode`}
                          dir="ltr"
                          className="text-left"
                          {...form.register(`variants.${index}.barcode`)}
                        />
                      </Field>
                      <Field label="عنوان تنوع" htmlFor={`v-${index}-title`}>
                        <Input
                          id={`v-${index}-title`}
                          placeholder="مثلاً: قطر ۱۰ میلی‌متر"
                          {...form.register(`variants.${index}.title`)}
                        />
                      </Field>
                      <Field label="نام گزینه" htmlFor={`v-${index}-on`}>
                        <Input
                          id={`v-${index}-on`}
                          placeholder="مثلاً: قطر"
                          {...form.register(`variants.${index}.optionName`)}
                        />
                      </Field>
                      <Field label="مقدار گزینه" htmlFor={`v-${index}-ov`}>
                        <Input
                          id={`v-${index}-ov`}
                          placeholder="مثلاً: ۱۰ میلی‌متر"
                          {...form.register(`variants.${index}.optionValue`)}
                        />
                      </Field>
                      <Field label="حد هشدار موجودی" htmlFor={`v-${index}-low`}>
                        <Input
                          id={`v-${index}-low`}
                          type="number"
                          min={0}
                          dir="ltr"
                          {...form.register(`variants.${index}.lowStockThreshold`)}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <Controller
                        control={form.control}
                        name={`variants.${index}.isActive`}
                        render={({ field: f }) => (
                          <label className="flex items-center gap-2">
                            <Switch checked={f.value} onCheckedChange={f.onChange} /> فعال
                          </label>
                        )}
                      />
                      {existing ? (
                        <span className="text-muted-foreground text-xs">
                          موجودی قابل فروش:{' '}
                          <b className="text-foreground">{faNumber(existing.stock.available)}</b>{' '}
                          (رزرو {faNumber(existing.stock.reserved)}){' · '}
                          <Link
                            href={`/admin/inventory?q=${encodeURIComponent(existing.sku)}`}
                            className="text-info hover:underline"
                          >
                            مدیریت موجودی
                          </Link>
                        </span>
                      ) : null}
                      {variants.fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive ms-auto"
                          onClick={() => variants.remove(index)}
                        >
                          <Trash2 /> حذف تنوع
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => variants.append(emptyVariant())}
              >
                <Plus /> افزودن تنوع
              </Button>
            </div>
          </Section>

          <Section
            title="مشخصات فنی"
            description="فیلدها بر اساس دسته‌بندی (و دسته‌های والد) تعیین می‌شوند و در فیلتر جستجو و مقایسه استفاده می‌شوند."
          >
            {!categoryId ? (
              <p className="text-muted-foreground text-sm">ابتدا دسته‌بندی محصول را انتخاب کنید.</p>
            ) : attributeEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                برای این دسته ویژگی فنی تعریف نشده است.
              </p>
            ) : (
              <div className="space-y-5">
                {[...groups.entries()].map(([group, entries]) => (
                  <div key={group}>
                    <p className="text-primary mb-2 text-sm font-bold">{group}</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {entries.map((entry) => (
                        <Controller
                          key={entry.attribute.id}
                          control={form.control}
                          name={`attributes.${entry.attribute.id}`}
                          render={({ field }) => (
                            <AttributeInput
                              entry={entry}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="توضیحات">
            <div className="space-y-4">
              <Field
                label="توضیح کوتاه"
                htmlFor="shortDescription"
                hint="در کارت محصول، صفحه محصول و توضیحات متا استفاده می‌شود."
              >
                <Textarea id="shortDescription" rows={3} {...form.register('shortDescription')} />
              </Field>
              <Field
                label="توضیحات کامل"
                htmlFor="description"
                hint="متن ساده (پاراگراف‌ها با خط خالی جدا شوند) یا HTML ساده؛ کدهای ناامن حذف می‌شوند."
              >
                <Textarea id="description" rows={10} {...form.register('description')} />
              </Field>
              <Field label="لینک ویدیو" htmlFor="videoUrl">
                <Input
                  id="videoUrl"
                  dir="ltr"
                  className="text-left"
                  {...form.register('videoUrl')}
                />
              </Field>
            </div>
          </Section>

          <Section title="محصولات مرتبط و لوازم جانبی">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="محصولات مرتبط">
                <Controller
                  control={form.control}
                  name="relatedProductIds"
                  render={({ field }) => (
                    <ProductPicker
                      value={field.value}
                      onChange={field.onChange}
                      excludeId={product?.id}
                    />
                  )}
                />
              </Field>
              <Field label="لوازم جانبی سازگار">
                <Controller
                  control={form.control}
                  name="accessoryProductIds"
                  render={({ field }) => (
                    <ProductPicker
                      value={field.value}
                      onChange={field.onChange}
                      excludeId={product?.id}
                    />
                  )}
                />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-5 xl:sticky xl:top-20">
          <Section title="انتشار">
            <div className="space-y-4">
              <Field label="وضعیت" htmlFor="status">
                <NativeSelect id="status" {...form.register('status')}>
                  {PRODUCT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PRODUCT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Controller
                control={form.control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex items-center justify-between text-sm">
                    نمایش در محصولات منتخب
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" loading={save.isPending}>
                  {product ? 'ذخیره تغییرات' : 'ایجاد محصول'}
                </Button>
                {product ? (
                  <Button asChild variant="outline">
                    <Link href={`/product/${product.slug}`} target="_blank">
                      مشاهده
                    </Link>
                  </Button>
                ) : null}
              </div>
              {product && can('product.delete') ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive w-full"
                  loading={remove.isPending}
                  onClick={() =>
                    window.confirm('محصول از فروشگاه حذف شود؟ سوابق سفارش‌ها حفظ می‌شود.') &&
                    remove.mutate(undefined)
                  }
                >
                  <Trash2 /> حذف محصول
                </Button>
              ) : null}
            </div>
          </Section>

          <Section title="تصاویر">
            <div className="space-y-3">
              {images.fields.map((image, index) => (
                <div key={image.key} className="flex items-center gap-2">
                  <div className="bg-muted relative size-14 shrink-0 rounded-md">
                    <ProductImage src={image.url} alt="" sizes="56px" className="p-1" />
                  </div>
                  <Input
                    className="h-9 text-xs"
                    placeholder="متن جایگزین"
                    {...form.register(`images.${index}.alt`)}
                  />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => images.move(index, index - 1)}
                      className="disabled:opacity-30"
                      aria-label="بالا"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === images.fields.length - 1}
                      onClick={() => images.move(index, index + 1)}
                      className="disabled:opacity-30"
                      aria-label="پایین"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => images.remove(index)}
                    aria-label="حذف تصویر"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                multiple
                hidden
                onChange={(e) => void upload(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                loading={uploading}
                onClick={() => fileInput.current?.click()}
                disabled={!can('media.upload')}
              >
                <ImagePlus /> بارگذاری تصویر
              </Button>
              <p className="text-muted-foreground text-[11px]">
                اولین تصویر، تصویر اصلی محصول است. فرمت‌های JPG، PNG، WebP و AVIF.
              </p>
            </div>
          </Section>

          <Section title="سئو">
            <div className="space-y-3">
              <Field label="عنوان سئو" htmlFor="seoTitle">
                <Input id="seoTitle" {...form.register('seoTitle')} />
              </Field>
              <Field label="توضیحات متا" htmlFor="seoDescription">
                <Textarea id="seoDescription" rows={3} {...form.register('seoDescription')} />
              </Field>
              <Field label="Canonical URL" htmlFor="canonicalUrl">
                <Input
                  id="canonicalUrl"
                  dir="ltr"
                  className="text-left"
                  {...form.register('canonicalUrl')}
                />
              </Field>
            </div>
          </Section>

          {product && product.marketplaceSync.length > 0 ? (
            <Section title="همگام‌سازی بازارها">
              <ul className="space-y-1 text-sm">
                {product.marketplaceSync.map((s) => (
                  <li key={s.channel} className="flex justify-between">
                    {s.channel}
                    <Badge>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {product ? (
            <p className="text-muted-foreground px-1 text-xs">
              بازه قیمت: {price(Math.min(...product.variants.map((v) => v.price)))} تا{' '}
              {price(Math.max(...product.variants.map((v) => v.price)))}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
