import { Injectable } from '@nestjs/common';
import type { ContentPage, FaqItem } from '@toolshop/database';
import type { ContentPageView, FaqItemView } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { sanitizeRichText } from '../../common/utils/html';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface PageInput {
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
}

export interface FaqInput {
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
}

const toPage = (page: ContentPage): ContentPageView => ({
  slug: page.slug,
  title: page.title,
  body: page.body,
  seoTitle: page.seoTitle,
  seoDescription: page.seoDescription,
  updatedAt: page.updatedAt.toISOString(),
});

const toFaq = (item: FaqItem): FaqItemView => ({
  id: item.id,
  question: item.question,
  answer: item.answer,
  category: item.category,
});

const FAQ_KEY = 'content:faq';

/** Static pages (about, terms, returns...) and FAQ – also a knowledge source for the AI assistant later. */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async page(slug: string): Promise<ContentPageView> {
    const page = await this.prisma.contentPage.findFirst({ where: { slug, isPublished: true } });
    if (!page) throw AppException.notFound('صفحه یافت نشد.');
    return toPage(page);
  }

  faq(): Promise<FaqItemView[]> {
    return this.cache.wrap(FAQ_KEY, 300, async () => {
      const items = await this.prisma.faqItem.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
      });
      return items.map(toFaq);
    });
  }

  async adminPages(): Promise<(ContentPageView & { isPublished: boolean })[]> {
    const pages = await this.prisma.contentPage.findMany({ orderBy: { slug: 'asc' } });
    return pages.map((page) => ({ ...toPage(page), isPublished: page.isPublished }));
  }

  async upsertPage(slug: string, input: PageInput): Promise<ContentPageView> {
    const body = sanitizeRichText(input.body) ?? '';
    const page = await this.prisma.contentPage.upsert({
      where: { slug },
      update: { ...input, body },
      create: { ...input, body, slug },
    });
    await this.audit.record({
      action: 'content.page',
      entityType: 'page',
      entityId: slug,
      summary: `ویرایش صفحه ${input.title}`,
    });
    return toPage(page);
  }

  async adminFaq(): Promise<(FaqItemView & { sortOrder: number; isPublished: boolean })[]> {
    const items = await this.prisma.faqItem.findMany({ orderBy: { sortOrder: 'asc' } });
    return items.map((item) => ({
      ...toFaq(item),
      sortOrder: item.sortOrder,
      isPublished: item.isPublished,
    }));
  }

  async createFaq(input: FaqInput): Promise<FaqItemView> {
    const item = await this.prisma.faqItem.create({ data: input });
    await this.cache.del(FAQ_KEY);
    return toFaq(item);
  }

  async updateFaq(id: string, input: FaqInput): Promise<FaqItemView> {
    if (!(await this.prisma.faqItem.findUnique({ where: { id } }))) throw AppException.notFound();
    const item = await this.prisma.faqItem.update({ where: { id }, data: input });
    await this.cache.del(FAQ_KEY);
    return toFaq(item);
  }

  async removeFaq(id: string): Promise<void> {
    await this.prisma.faqItem.deleteMany({ where: { id } });
    await this.cache.del(FAQ_KEY);
  }
}
