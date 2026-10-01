import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  type ContentPageView,
  type FaqItemView,
  longTextSchema,
  optionalTextSchema,
  SLUG_PATTERN,
  textSchema,
} from '@toolshop/shared';
import { z } from 'zod';
import { UuidParam, ZBody } from '../../common/decorators/validated.decorator';
import { AppException } from '../../common/errors/app-exception';
import { AdminController, Public, RequirePermissions } from '../auth/decorators';
import { ContentService } from './content.service';

const pageSchema = z.object({
  title: textSchema({ max: 160 }),
  body: longTextSchema(100_000),
  seoTitle: optionalTextSchema(160),
  seoDescription: optionalTextSchema(320),
  isPublished: z.boolean().default(true),
});

const faqSchema = z.object({
  question: textSchema({ max: 300 }),
  answer: longTextSchema(5000),
  category: optionalTextSchema(80),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

@Public()
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('pages/:slug')
  page(@Param('slug') slug: string): Promise<ContentPageView> {
    return this.content.page(slug);
  }

  @Get('faq')
  faq(): Promise<FaqItemView[]> {
    return this.content.faq();
  }
}

@AdminController('content')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get('pages')
  @RequirePermissions('content.manage')
  pages() {
    return this.content.adminPages();
  }

  @Put('pages/:slug')
  @RequirePermissions('content.manage')
  upsertPage(
    @Param('slug') slug: string,
    @ZBody(pageSchema) input: z.infer<typeof pageSchema>,
  ): Promise<ContentPageView> {
    if (!SLUG_PATTERN.test(slug)) throw AppException.notFound();
    return this.content.upsertPage(slug, input);
  }

  @Get('faq')
  @RequirePermissions('content.manage')
  faq() {
    return this.content.adminFaq();
  }

  @Post('faq')
  @RequirePermissions('content.manage')
  createFaq(@ZBody(faqSchema) input: z.infer<typeof faqSchema>): Promise<FaqItemView> {
    return this.content.createFaq(input);
  }

  @Put('faq/:id')
  @RequirePermissions('content.manage')
  updateFaq(
    @UuidParam() id: string,
    @ZBody(faqSchema) input: z.infer<typeof faqSchema>,
  ): Promise<FaqItemView> {
    return this.content.updateFaq(id, input);
  }

  @Delete('faq/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('content.manage')
  removeFaq(@UuidParam() id: string): Promise<void> {
    return this.content.removeFaq(id);
  }
}
