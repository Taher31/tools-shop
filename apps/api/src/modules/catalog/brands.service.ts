import { Injectable } from '@nestjs/common';
import type { Brand } from '@toolshop/database';
import type { AdminBrandView, BrandSummary, BrandUpsertInput } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { uniqueSlug } from './slug';
import { TaxonomyService } from './taxonomy.service';

function toSummary(brand: Brand): BrandSummary {
  return {
    id: brand.id,
    name: brand.name,
    englishName: brand.englishName,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
  };
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async publicList(): Promise<BrandSummary[]> {
    const brands = await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return brands.map(toSummary);
  }

  async publicBySlug(
    slug: string,
  ): Promise<BrandSummary & { description: string | null; country: string | null }> {
    const brand = await this.prisma.brand.findFirst({ where: { slug, isActive: true } });
    if (!brand) throw AppException.notFound('برند یافت نشد.');
    return { ...toSummary(brand), description: brand.description, country: brand.country };
  }

  async adminList(): Promise<AdminBrandView[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return brands.map((brand) => ({
      ...toSummary(brand),
      description: brand.description,
      country: brand.country,
      website: brand.website,
      isActive: brand.isActive,
      seoTitle: brand.seoTitle,
      seoDescription: brand.seoDescription,
      productCount: brand._count.products,
    }));
  }

  async create(input: BrandUpsertInput): Promise<AdminBrandView> {
    if (input.slug && (await this.slugTaken(input.slug))) throw this.slugConflict();
    const slug =
      input.slug ?? (await uniqueSlug(input.englishName ?? input.name, (s) => this.slugTaken(s)));
    const brand = await this.prisma.$transaction(async (tx) => {
      const created = await tx.brand.create({ data: { ...input, slug } });
      await this.audit.record(
        {
          action: 'brand.create',
          entityType: 'brand',
          entityId: created.id,
          summary: `ایجاد برند ${created.name}`,
        },
        tx,
      );
      return created;
    });
    await this.taxonomy.invalidate();
    return this.adminOne(brand.id);
  }

  async update(id: string, input: BrandUpsertInput): Promise<AdminBrandView> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('برند یافت نشد.');
    const slug = input.slug ?? existing.slug;
    if (slug !== existing.slug && (await this.slugTaken(slug))) throw this.slugConflict();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.brand.update({ where: { id }, data: { ...input, slug } });
      await this.audit.record(
        {
          action: 'brand.update',
          entityType: 'brand',
          entityId: id,
          summary: `ویرایش برند ${updated.name}`,
          before: { name: existing.name, slug: existing.slug, isActive: existing.isActive },
          after: { name: updated.name, slug: updated.slug, isActive: updated.isActive },
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'catalog.taxonomy_changed',
          aggregateType: 'brand',
          aggregateId: id,
          payload: { brandIds: [id] },
        },
      ]);
    });
    await this.taxonomy.invalidate();
    this.outbox.flush();
    return this.adminOne(id);
  }

  async remove(id: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw AppException.notFound('برند یافت نشد.');
    if (brand._count.products > 0) throw AppException.conflict('محصولاتی با این برند ثبت شده است.');
    await this.prisma.$transaction(async (tx) => {
      await tx.brand.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'brand.delete',
          entityType: 'brand',
          entityId: id,
          summary: `حذف برند ${brand.name}`,
        },
        tx,
      );
    });
    await this.taxonomy.invalidate();
  }

  private async adminOne(id: string): Promise<AdminBrandView> {
    const brand = (await this.adminList()).find((b) => b.id === id);
    if (!brand) throw AppException.notFound();
    return brand;
  }

  private async slugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.brand.count({ where: { slug } })) > 0;
  }

  private slugConflict(): AppException {
    return AppException.conflict('این نامک قبلاً استفاده شده است.', [
      { path: 'slug', message: 'تکراری' },
    ]);
  }
}
