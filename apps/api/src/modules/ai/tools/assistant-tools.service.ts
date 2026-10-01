import { Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import {
  type AssistantProduct,
  ORDER_STATUS_LABELS,
  productSearchQuerySchema,
  type ProductCard,
} from '@toolshop/shared';
import { z } from 'zod';
import { toRial } from '../../../common/utils/money';
import { stripHtml } from '../../../common/utils/html';
import { AppException } from '../../../common/errors/app-exception';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { VISIBLE_PRODUCT_WHERE } from '../../catalog/product-card';
import { ProductQueryService } from '../../catalog/products/product-query.service';
import { ContentService } from '../../content/content.service';
import { SearchService } from '../../search/search.service';
import { SettingsService } from '../../settings/settings.service';
import { ShippingService } from '../../shipping/shipping.service';

/** Who is asking. Tools never see more than this caller is allowed to see. */
export interface ToolContext {
  userId: string | null;
  channel: 'web' | 'telegram' | 'bale' | 'eitaa';
}

export interface ToolOutput {
  /** JSON string handed back to the model as the tool_result. */
  content: string;
  isError?: boolean;
  /** Products to render as cards in the UI (show_products only). */
  products?: AssistantProduct[];
}

interface AgentTool<I> {
  definition: Anthropic.Beta.BetaTool;
  schema: z.ZodType<I>;
  /** Shown to the customer while the tool runs. */
  label: string;
  run(input: I, context: ToolContext): Promise<ToolOutput>;
}

const toman = (rial: number | null) => (rial === null ? null : Math.round(rial / 10));
const json = (value: unknown): ToolOutput => ({ content: JSON.stringify(value) });

function cardToAssistant(card: ProductCard): AssistantProduct {
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    imageUrl: card.imageUrl,
    price: card.price,
    compareAtPrice: card.compareAtPrice,
    inStock: card.inStock,
    brand: card.brand,
    defaultVariantId: card.defaultVariantId,
  };
}

const STORE_TOPICS = [
  'shipping',
  'returns',
  'warranty',
  'payment',
  'contact',
  'faq',
  'about',
] as const;

/**
 * The only way the AI can reach store data: typed, read-only tools that call existing
 * domain services with the caller's identity. There is no SQL, no write tool and no
 * access to other customers' data; prices and stock always come from live data.
 */
@Injectable()
export class AssistantToolsService {
  private readonly tools = new Map<string, AgentTool<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly products: ProductQueryService,
    private readonly content: ContentService,
    private readonly settings: SettingsService,
    private readonly shipping: ShippingService,
  ) {
    this.register({
      label: 'جست‌وجوی محصولات',
      definition: {
        name: 'search_products',
        description:
          'Search the store catalog (Persian or English, model numbers and SKUs work). Returns live prices in Toman and stock. Use it before recommending or quoting any product.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What the customer is looking for, e.g. "دریل شارژی ۱۸ ولت".',
            },
            max_price_toman: { type: 'integer', description: 'Optional budget ceiling in Toman.' },
            in_stock_only: { type: 'boolean', description: 'Only return items that are in stock.' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 6,
              description: 'Number of results (default 5).',
            },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      schema: z.object({
        query: z.string().trim().min(1).max(200),
        max_price_toman: z.number().int().positive().optional(),
        in_stock_only: z.boolean().optional(),
        limit: z.number().int().min(1).max(6).optional(),
      }),
      run: async (input) => {
        const result = await this.search.search(
          productSearchQuerySchema.parse({
            q: input.query,
            maxPrice: input.max_price_toman ? input.max_price_toman * 10 : undefined,
            inStock: input.in_stock_only ? 'true' : undefined,
            pageSize: input.limit ?? 5,
          }),
        );
        return json({
          total: result.total,
          products: result.items.map((p) => ({
            slug: p.slug,
            title: p.title,
            brand: p.brand?.name ?? null,
            category: p.category?.name ?? null,
            price_toman: toman(p.price),
            compare_at_price_toman: toman(p.compareAtPrice),
            in_stock: p.inStock,
            rating: p.ratingAverage,
            key_specs: p.keySpecs.map((s) => `${s.label}: ${s.value}`),
          })),
        });
      },
    });

    this.register({
      label: 'بررسی مشخصات محصول',
      definition: {
        name: 'get_product_details',
        description:
          'Full technical specifications, variants with live price/stock, warranty and description of one product, by slug from search results.',
        input_schema: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          required: ['slug'],
          additionalProperties: false,
        },
      },
      schema: z.object({ slug: z.string().trim().min(1).max(200) }),
      run: async ({ slug }) => {
        try {
          const product = await this.products.getDetail(slug);
          return json({
            slug: product.slug,
            title: product.title,
            brand: product.brand?.name ?? null,
            model: product.model,
            warranty: product.warranty,
            country_of_origin: product.countryOfOrigin,
            usage_type: product.usageType,
            short_description: product.shortDescription,
            description: product.description ? stripHtml(product.description).slice(0, 1500) : null,
            specs: product.specs.map((s) => ({ name: s.name, value: s.value })),
            variants: product.variants.map((v) => ({
              title: v.title,
              sku: v.sku,
              price_toman: toman(v.price),
              availability: v.availability,
            })),
            rating: product.rating,
          });
        } catch (error) {
          if (error instanceof AppException)
            return { content: JSON.stringify({ error: 'not_found' }), isError: true };
          throw error;
        }
      },
    });

    this.register({
      label: 'مقایسه محصولات',
      definition: {
        name: 'compare_products',
        description:
          'Side-by-side comparison of 2 to 4 products (comparable specs, price, stock), by slug.',
        input_schema: {
          type: 'object',
          properties: {
            slugs: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
          },
          required: ['slugs'],
          additionalProperties: false,
        },
      },
      schema: z.object({ slugs: z.array(z.string().trim().min(1).max(200)).min(2).max(4) }),
      run: async ({ slugs }) => {
        const ids = await this.idsForSlugs(slugs);
        const result = await this.products.compare(ids);
        return json({
          attributes: result.attributes.map((a) => a.name),
          products: result.products.map((p) => ({
            slug: p.slug,
            title: p.title,
            brand: p.brand,
            price_toman: toman(p.price),
            in_stock: p.inStock,
            specs: Object.fromEntries(
              result.attributes.map((a) => [a.name, p.specs[a.code] ?? '—']),
            ),
          })),
        });
      },
    });

    this.register({
      label: 'پیگیری سفارش',
      definition: {
        name: 'get_order_status',
        description:
          "Status of one of the signed-in customer's own orders by order number. Returns login_required when the customer is not signed in.",
        input_schema: {
          type: 'object',
          properties: { order_number: { type: 'integer' } },
          required: ['order_number'],
          additionalProperties: false,
        },
      },
      schema: z.object({ order_number: z.number().int().positive() }),
      run: async ({ order_number }, context) => {
        if (!context.userId) {
          return json({
            status: 'login_required',
            message:
              'برای پیگیری سفارش ابتدا وارد حساب کاربری خود در سایت شوید یا به صفحه «سفارش‌های من» بروید.',
          });
        }
        // Scoped to the caller: another customer's order is indistinguishable from a missing one.
        const order = await this.prisma.order.findFirst({
          where: { orderNumber: order_number, userId: context.userId },
          include: { items: { select: { title: true, quantity: true } } },
        });
        if (!order)
          return json({
            status: 'not_found',
            message: 'سفارشی با این شماره در حساب شما پیدا نشد.',
          });
        return json({
          order_number: order.orderNumber,
          status: order.status,
          status_label: ORDER_STATUS_LABELS[order.status],
          created_at: order.createdAt.toISOString(),
          paid_at: order.paidAt?.toISOString() ?? null,
          shipped_at: order.shippedAt?.toISOString() ?? null,
          shipping_method: order.shippingMethodName,
          tracking_code: order.trackingCode,
          total_toman: toman(toRial(order.total)),
          items: order.items.map((i) => ({ title: i.title, quantity: i.quantity })),
        });
      },
    });

    this.register({
      label: 'بررسی قوانین فروشگاه',
      definition: {
        name: 'get_store_info',
        description:
          'Official store policies and information: shipping methods and costs, returns, warranty, payment, contact details, FAQ, about the store. Use it instead of guessing any policy.',
        input_schema: {
          type: 'object',
          properties: { topic: { type: 'string', enum: [...STORE_TOPICS] } },
          required: ['topic'],
          additionalProperties: false,
        },
      },
      schema: z.object({ topic: z.enum(STORE_TOPICS) }),
      run: async ({ topic }) => this.storeInfo(topic),
    });

    this.register({
      label: 'نمایش محصولات',
      definition: {
        name: 'show_products',
        description:
          'Display product cards (image, live price, add-to-cart) to the customer for 1-4 products you recommend, by slug. Call it once with your final recommendations.',
        input_schema: {
          type: 'object',
          properties: {
            slugs: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
          },
          required: ['slugs'],
          additionalProperties: false,
        },
      },
      schema: z.object({ slugs: z.array(z.string().trim().min(1).max(200)).min(1).max(4) }),
      run: async ({ slugs }) => {
        const cards = await this.products.cardsByIds(await this.idsForSlugs(slugs));
        const products = cards.map(cardToAssistant);
        return {
          content: JSON.stringify({
            shown: products.length,
            products: products.map((p) => ({ slug: p.slug, title: p.title })),
          }),
          products,
        };
      },
    });
  }

  definitions(names?: readonly string[]): Anthropic.Beta.BetaTool[] {
    return [...this.tools.values()]
      .filter((tool) => !names || names.includes(tool.definition.name))
      .map((tool) => tool.definition);
  }

  label(name: string): string {
    return this.tools.get(name)?.label ?? 'در حال بررسی';
  }

  /** Validates the model's input against the tool schema before running anything. */
  async execute(name: string, input: unknown, context: ToolContext): Promise<ToolOutput> {
    const tool = this.tools.get(name);
    if (!tool) return { content: JSON.stringify({ error: `unknown tool ${name}` }), isError: true };
    const parsed = tool.schema.safeParse(input);
    if (!parsed.success) {
      return {
        content: JSON.stringify({
          error: 'invalid_input',
          issues: parsed.error.issues.map((i) => i.message),
        }),
        isError: true,
      };
    }
    return tool.run(parsed.data, context);
  }

  private register<I>(tool: AgentTool<I>): void {
    this.tools.set(tool.definition.name, tool as AgentTool<unknown>);
  }

  private async idsForSlugs(slugs: string[]): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { slug: { in: slugs }, ...VISIBLE_PRODUCT_WHERE },
      select: { id: true, slug: true },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
    return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  }

  private async storeInfo(topic: (typeof STORE_TOPICS)[number]): Promise<ToolOutput> {
    const { store } = await this.settings.getAll();
    switch (topic) {
      case 'shipping': {
        const methods = await this.shipping.activeMethods();
        const page = await this.page('shipping');
        return json({
          methods: methods.map((m) => ({
            name: m.name,
            description: m.description,
            cost_toman: toman(toRial(m.baseCost)),
            free_from_toman: toman(
              m.freeShippingThreshold === null ? null : toRial(m.freeShippingThreshold),
            ),
            delivery_days: `${m.estimatedDaysMin}-${m.estimatedDaysMax}`,
            provinces: m.provinces.length > 0 ? m.provinces : 'all',
          })),
          policy: page,
        });
      }
      case 'contact':
        return json({
          phone: store.supportPhone,
          email: store.supportEmail,
          working_hours: store.workingHours,
          address: store.address,
          support_tickets: '/account/tickets/new',
        });
      case 'faq':
        return json({
          faq: (await this.content.faq())
            .slice(0, 20)
            .map((f) => ({ q: f.question, a: stripHtml(f.answer) })),
        });
      case 'payment':
        return json({
          methods:
            'پرداخت آنلاین با کارت‌های عضو شتاب از طریق درگاه بانکی. پس از تأیید پرداخت، فاکتور فروش صادر می‌شود.',
          unpaid_orders:
            'کالاهای سفارش پرداخت‌نشده تا مدت محدودی رزرو می‌شوند و سپس سفارش خودکار لغو می‌شود.',
        });
      default:
        return json({ policy: await this.page(topic) });
    }
  }

  private async page(slug: string): Promise<string | null> {
    try {
      return stripHtml((await this.content.page(slug)).body).slice(0, 3000);
    } catch {
      return null;
    }
  }
}
