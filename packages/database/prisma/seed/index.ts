import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import argon2 from 'argon2';
import { PERMISSION_DEFINITIONS, SUPER_ADMIN_ROLE, SYSTEM_ROLES, slugify } from '@toolshop/shared';
import { createPrismaClient, type Prisma, type PrismaClient } from '../../src';
import {
  ATTRIBUTES,
  BRANDS,
  CATEGORIES,
  PRODUCTS,
  type SeedCategory,
  type SeedSpecValue,
} from './data/catalog';
import {
  COMMERCE_SETTINGS,
  CONTENT_PAGES,
  COUPONS,
  FAQ_ITEMS,
  LEGAL_SETTINGS,
  SHIPPING_METHODS,
  STORE_SETTINGS,
  WAREHOUSES,
} from './data/content';

loadEnv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

const isProduction = process.env['NODE_ENV'] === 'production';
const DEMO_STAFF_PASSWORD = 'Staff@12345';
const DEMO_CUSTOMER = {
  firstName: 'مشتری',
  lastName: 'نمونه',
  mobile: '09120000001',
  email: 'customer@example.com',
  password: 'Customer@123',
};

/** Same parameters as the API's PasswordService (OWASP recommended argon2id). */
function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function seedAccessControl(prisma: PrismaClient): Promise<void> {
  const known = new Set(
    (await prisma.permission.findMany({ select: { key: true } })).map((p) => p.key),
  );
  // Permissions introduced by a new release: roles that already exist receive them
  // according to their system definition, without undoing admin customizations of
  // permissions that existed before.
  const introduced = new Set(
    PERMISSION_DEFINITIONS.map((p) => p.key).filter((key) => !known.has(key)),
  );
  for (const permission of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { group: permission.group, label: permission.label },
      create: { key: permission.key, group: permission.group, label: permission.label },
    });
  }
  await prisma.permission.deleteMany({
    where: { key: { notIn: PERMISSION_DEFINITIONS.map((p) => p.key) } },
  });

  for (const definition of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({ where: { key: definition.key } });
    const role =
      existing ??
      (await prisma.role.create({
        data: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          isSystem: true,
        },
      }));
    // super_admin always holds every permission; other roles keep admin customizations.
    if (!existing || definition.key === SUPER_ADMIN_ROLE) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({
        data: definition.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })),
        skipDuplicates: true,
      });
    } else if (known.size > 0) {
      const granted = definition.permissions.filter((key) => introduced.has(key));
      if (granted.length > 0) {
        await prisma.rolePermission.createMany({
          data: granted.map((permissionKey) => ({ roleId: role.id, permissionKey })),
          skipDuplicates: true,
        });
      }
    }
  }
  console.log(`✔ ${PERMISSION_DEFINITIONS.length} permissions, ${SYSTEM_ROLES.length} roles`);
}

async function ensureStaffUser(
  prisma: PrismaClient,
  input: { email: string; firstName: string; lastName: string; password: string; roleKey: string },
): Promise<void> {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return;
  await prisma.user.create({
    data: {
      type: 'staff',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      roles: { create: { roleId: role.id } },
    },
  });
}

async function seedUsers(prisma: PrismaClient): Promise<string> {
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'];
  if (!adminPassword) throw new Error('SEED_ADMIN_PASSWORD is required');

  await ensureStaffUser(prisma, {
    email: adminEmail,
    firstName: 'مدیر',
    lastName: 'سیستم',
    password: adminPassword,
    roleKey: SUPER_ADMIN_ROLE,
  });

  if (!isProduction) {
    const demoStaff = [
      { email: 'sales@example.com', firstName: 'کارشناس', lastName: 'فروش', roleKey: 'sales' },
      {
        email: 'warehouse@example.com',
        firstName: 'مسئول',
        lastName: 'انبار',
        roleKey: 'warehouse',
      },
      {
        email: 'support@example.com',
        firstName: 'کارشناس',
        lastName: 'پشتیبانی',
        roleKey: 'support',
      },
      {
        email: 'content@example.com',
        firstName: 'مدیر',
        lastName: 'محتوا',
        roleKey: 'content_manager',
      },
    ];
    for (const staff of demoStaff) {
      await ensureStaffUser(prisma, { ...staff, password: DEMO_STAFF_PASSWORD });
    }
  }

  const customer =
    (await prisma.user.findUnique({ where: { mobile: DEMO_CUSTOMER.mobile } })) ??
    (await prisma.user.create({
      data: {
        type: 'customer',
        firstName: DEMO_CUSTOMER.firstName,
        lastName: DEMO_CUSTOMER.lastName,
        mobile: DEMO_CUSTOMER.mobile,
        email: DEMO_CUSTOMER.email,
        passwordHash: await hashPassword(DEMO_CUSTOMER.password),
        addresses: {
          create: {
            title: 'کارگاه',
            recipientName: 'مشتری نمونه',
            recipientMobile: DEMO_CUSTOMER.mobile,
            province: 'تهران',
            city: 'تهران',
            addressLine: 'خیابان نمونه، کوچه آزمایشی، پلاک ۱۲',
            plaque: '12',
            unit: '3',
            postalCode: '1193653471',
            isDefault: true,
          },
        },
      },
    }));
  console.log(`✔ users (admin: ${adminEmail})`);
  return customer.id;
}

async function seedSettings(prisma: PrismaClient): Promise<void> {
  const settings: Record<string, unknown> = {
    store: STORE_SETTINGS,
    legal: LEGAL_SETTINGS,
    commerce: COMMERCE_SETTINGS,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
  console.log('✔ settings');
}

async function seedWarehouses(prisma: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const warehouse of WAREHOUSES) {
    const record = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: {},
      create: warehouse,
    });
    ids.set(record.code, record.id);
  }
  console.log(`✔ ${ids.size} warehouses`);
  return ids;
}

async function seedAttributes(
  prisma: PrismaClient,
): Promise<Map<string, { id: string; type: string }>> {
  const attributes = new Map<string, { id: string; type: string }>();
  for (const [index, attribute] of ATTRIBUTES.entries()) {
    const record = await prisma.attribute.upsert({
      where: { code: attribute.code },
      update: {},
      create: {
        code: attribute.code,
        name: attribute.name,
        type: attribute.type,
        unit: attribute.unit ?? null,
        groupName: attribute.groupName,
        isFilterable: attribute.isFilterable ?? false,
        sortOrder: index,
      },
    });
    for (const [optionIndex, option] of (attribute.options ?? []).entries()) {
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: record.id, value: option.value } },
        update: {},
        create: {
          attributeId: record.id,
          value: option.value,
          label: option.label,
          sortOrder: optionIndex,
        },
      });
    }
    attributes.set(record.code, { id: record.id, type: record.type });
  }
  console.log(`✔ ${attributes.size} attributes`);
  return attributes;
}

async function seedBrands(prisma: PrismaClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const brand of BRANDS) {
    const record = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
    ids.set(brand.slug, record.id);
  }
  console.log(`✔ ${ids.size} brands`);
  return ids;
}

async function seedCategories(
  prisma: PrismaClient,
  attributes: Map<string, { id: string }>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  const visit = async (nodes: SeedCategory[], parentId: string | null): Promise<void> => {
    for (const [index, node] of nodes.entries()) {
      const record = await prisma.category.upsert({
        where: { slug: node.slug },
        update: {},
        create: {
          slug: node.slug,
          name: node.name,
          description: node.description ?? null,
          imageUrl: node.imageUrl ?? null,
          parentId,
          sortOrder: index,
        },
      });
      ids.set(node.slug, record.id);
      const assignments = (node.attributes ?? []).map((entry, sortOrder) => {
        const config = typeof entry === 'string' ? { code: entry } : entry;
        const attribute = attributes.get(config.code);
        if (!attribute)
          throw new Error(`Unknown attribute ${config.code} on category ${node.slug}`);
        return {
          categoryId: record.id,
          attributeId: attribute.id,
          isRequired: config.isRequired ?? false,
          isFilterable: config.isFilterable ?? true,
          sortOrder,
        };
      });
      if (assignments.length > 0) {
        await prisma.categoryAttribute.createMany({ data: assignments, skipDuplicates: true });
      }
      await visit(node.children ?? [], record.id);
    }
  };

  await visit(CATEGORIES, null);
  console.log(`✔ ${ids.size} categories`);
  return ids;
}

function attributeValueData(type: string, value: SeedSpecValue) {
  switch (type) {
    case 'number':
      return { numberValue: Number(value) };
    case 'boolean':
      return { booleanValue: Boolean(value) };
    case 'select':
      return { optionValues: [String(value)] };
    case 'multiselect':
      return { optionValues: Array.isArray(value) ? value : [String(value)] };
    default:
      return { textValue: String(value) };
  }
}

async function seedProducts(
  prisma: PrismaClient,
  refs: {
    categories: Map<string, string>;
    brands: Map<string, string>;
    attributes: Map<string, { id: string; type: string }>;
    warehouses: Map<string, string>;
    adminId: string | null;
  },
): Promise<void> {
  let created = 0;
  const productIds = new Map<string, string>();

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: product.slug } });
    if (existing) {
      productIds.set(product.slug, existing.id);
      continue;
    }
    const categoryId = refs.categories.get(product.category);
    const brandId = refs.brands.get(product.brand);
    if (!categoryId || !brandId) throw new Error(`Bad references for ${product.slug}`);
    const status = product.status ?? 'active';
    const prices = product.variants.map((variant) => variant.price);

    const record = await prisma.product.create({
      data: {
        slug: product.slug || slugify(product.title),
        title: product.title,
        englishTitle: product.englishTitle ?? null,
        status,
        categoryId,
        brandId,
        model: product.model ?? null,
        manufacturer: product.manufacturer ?? null,
        countryOfOrigin: product.countryOfOrigin ?? null,
        usageType: product.usageType ?? null,
        warranty: product.warranty ?? null,
        shortDescription: product.shortDescription,
        description: product.description,
        tags: product.tags,
        isFeatured: product.isFeatured ?? false,
        minPrice: BigInt(Math.min(...prices)),
        maxPrice: BigInt(Math.max(...prices)),
        publishedAt: status === 'active' ? new Date() : null,
        images: { create: [{ url: product.image, alt: product.title, sortOrder: 0 }] },
        attributeValues: {
          create: Object.entries(product.specs).map(([code, value]) => {
            const attribute = refs.attributes.get(code);
            if (!attribute) throw new Error(`Unknown attribute ${code} on ${product.slug}`);
            return { attributeId: attribute.id, ...attributeValueData(attribute.type, value) };
          }),
        },
      },
    });
    productIds.set(product.slug, record.id);

    for (const [index, variant] of product.variants.entries()) {
      const variantRecord = await prisma.productVariant.create({
        data: {
          productId: record.id,
          sku: variant.sku,
          barcode: variant.barcode ?? null,
          title: variant.title ?? null,
          options: variant.options ?? [],
          price: BigInt(variant.price),
          compareAtPrice: variant.compareAtPrice ? BigInt(variant.compareAtPrice) : null,
          lowStockThreshold: variant.lowStockThreshold ?? 2,
          weightGrams: variant.weightGrams ?? null,
          sortOrder: index,
        },
      });
      for (const [warehouseCode, quantity] of Object.entries(variant.stock)) {
        const warehouseId = refs.warehouses.get(warehouseCode);
        if (!warehouseId) throw new Error(`Unknown warehouse ${warehouseCode}`);
        await prisma.inventoryLevel.create({
          data: { variantId: variantRecord.id, warehouseId, onHand: quantity },
        });
        if (quantity > 0) {
          await prisma.stockMovement.create({
            data: {
              variantId: variantRecord.id,
              warehouseId,
              type: 'purchase',
              quantity,
              onHandAfter: quantity,
              reference: 'SEED-OPENING',
              note: 'موجودی اولیه',
              actorId: refs.adminId,
            },
          });
        }
      }
    }
    created += 1;
  }

  for (const product of PRODUCTS) {
    const productId = productIds.get(product.slug);
    if (!productId) continue;
    const relations = [
      ...(product.related ?? []).map((slug, index) => ({
        slug,
        type: 'related' as const,
        sortOrder: index,
      })),
      ...(product.accessories ?? []).map((slug, index) => ({
        slug,
        type: 'accessory' as const,
        sortOrder: index,
      })),
    ];
    const data = relations.flatMap((relation) => {
      const relatedProductId = productIds.get(relation.slug);
      return relatedProductId
        ? [{ productId, relatedProductId, type: relation.type, sortOrder: relation.sortOrder }]
        : [];
    });
    if (data.length > 0) await prisma.productRelation.createMany({ data, skipDuplicates: true });
  }

  console.log(`✔ products (${created} created, ${PRODUCTS.length - created} existing)`);
}

async function seedCommerce(prisma: PrismaClient): Promise<void> {
  for (const method of SHIPPING_METHODS) {
    await prisma.shippingMethod.upsert({
      where: { code: method.code },
      update: {},
      create: {
        ...method,
        baseCost: BigInt(method.baseCost),
        freeShippingThreshold: method.freeShippingThreshold
          ? BigInt(method.freeShippingThreshold)
          : null,
      },
    });
  }
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: {
        ...coupon,
        value: BigInt(coupon.value),
        maxDiscount: coupon.maxDiscount ? BigInt(coupon.maxDiscount) : null,
        minSubtotal: coupon.minSubtotal ? BigInt(coupon.minSubtotal) : null,
      },
    });
  }
  console.log(`✔ ${SHIPPING_METHODS.length} shipping methods, ${COUPONS.length} coupons`);
}

async function seedContent(prisma: PrismaClient): Promise<void> {
  for (const page of CONTENT_PAGES) {
    await prisma.contentPage.upsert({ where: { slug: page.slug }, update: {}, create: page });
  }
  if ((await prisma.faqItem.count()) === 0) {
    await prisma.faqItem.createMany({
      data: FAQ_ITEMS.map((item, index) => ({ ...item, sortOrder: index })),
    });
  }
  console.log(`✔ ${CONTENT_PAGES.length} pages, FAQ`);
}

/**
 * A few historical orders so the admin dashboard has data. Stock is deducted through
 * `sale` movements exactly like a real paid order.
 */
async function seedDemoOrders(prisma: PrismaClient, customerId: string): Promise<void> {
  if ((await prisma.order.count({ where: { userId: customerId } })) > 0) return;

  const address = await prisma.address.findFirstOrThrow({ where: { userId: customerId } });
  const shipping = await prisma.shippingMethod.findUniqueOrThrow({
    where: { code: 'post_pishtaz' },
  });
  const main = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'MAIN' } });
  const plans: {
    daysAgo: number;
    status: 'delivered' | 'shipped' | 'processing' | 'paid';
    skus: [string, number][];
  }[] = [
    {
      daysAgo: 12,
      status: 'delivered',
      skus: [
        ['VLT-VCD18-K2', 1],
        ['STM-SB-08', 3],
      ],
    },
    {
      daysAgo: 9,
      status: 'delivered',
      skus: [
        ['KVT-KAG750', 2],
        ['VLT-CD-115', 2],
      ],
    },
    { daysAgo: 6, status: 'delivered', skus: [['STM-SRH26', 1]] },
    {
      daysAgo: 4,
      status: 'shipped',
      skus: [
        ['TLN-TWS12', 1],
        ['TLN-TCP8', 2],
      ],
    },
    {
      daysAgo: 1,
      status: 'processing',
      skus: [
        ['VLT-VAG1200', 1],
        ['VLT-CD-115', 1],
      ],
    },
    {
      daysAgo: 0,
      status: 'paid',
      skus: [
        ['VLT-VCD18-K2', 1],
        ['VLT-VB1840', 1],
      ],
    },
  ];
  const lifecycle = [
    'pending',
    'awaiting_payment',
    'paid',
    'processing',
    'packed',
    'shipped',
    'delivered',
  ] as const;

  for (const plan of plans) {
    const createdAt = new Date(Date.now() - plan.daysAgo * 86_400_000 - 3_600_000);
    const lines = await Promise.all(
      plan.skus.map(async ([sku, quantity]) => {
        const variant = await prisma.productVariant.findUniqueOrThrow({
          where: { sku },
          include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } },
        });
        return { variant, quantity, total: variant.price * BigInt(quantity) };
      }),
    );
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0n);
    const shippingCost =
      shipping.freeShippingThreshold && subtotal >= shipping.freeShippingThreshold
        ? 0n
        : shipping.baseCost;
    const total = subtotal + shippingCost;
    const taxTotal = (subtotal * 10n) / 110n;
    const statusIndex = lifecycle.indexOf(plan.status);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: customerId,
          status: plan.status,
          subtotal,
          shippingCost,
          taxTotal,
          taxIncluded: true,
          total,
          shippingMethodId: shipping.id,
          shippingMethodName: shipping.name,
          shippingAddress: {
            recipientName: address.recipientName,
            recipientMobile: address.recipientMobile,
            province: address.province,
            city: address.city,
            addressLine: address.addressLine,
            plaque: address.plaque,
            unit: address.unit,
            postalCode: address.postalCode,
          },
          paidAt: new Date(createdAt.getTime() + 120_000),
          shippedAt:
            statusIndex >= lifecycle.indexOf('shipped')
              ? new Date(createdAt.getTime() + 86_400_000)
              : null,
          deliveredAt:
            plan.status === 'delivered' ? new Date(createdAt.getTime() + 2 * 86_400_000) : null,
          trackingCode:
            statusIndex >= lifecycle.indexOf('shipped')
              ? `PST${createdAt.getTime().toString().slice(-8)}`
              : null,
          createdAt,
          items: {
            create: lines.map((line) => ({
              productId: line.variant.productId,
              variantId: line.variant.id,
              title: line.variant.product.title,
              variantTitle: line.variant.title,
              sku: line.variant.sku,
              imageUrl: line.variant.product.images[0]?.url ?? null,
              unitPrice: line.variant.price,
              compareAtPrice: line.variant.compareAtPrice,
              quantity: line.quantity,
              total: line.total,
            })),
          },
          payments: {
            create: {
              provider: 'mock',
              amount: total,
              status: 'succeeded',
              authority: `SEED-${createdAt.getTime()}`,
              referenceId: String(createdAt.getTime()).slice(-10),
              cardMask: '603799******1234',
              verifiedAt: new Date(createdAt.getTime() + 120_000),
              createdAt,
            },
          },
          history: {
            create: lifecycle.slice(0, statusIndex + 1).map((status, index) => ({
              fromStatus: index === 0 ? null : lifecycle[index - 1],
              toStatus: status,
              actorType: index <= 2 ? 'system' : 'staff',
              createdAt: new Date(createdAt.getTime() + index * 60_000),
            })),
          },
        },
      });

      for (const line of lines) {
        const level = await tx.inventoryLevel.update({
          where: { variantId_warehouseId: { variantId: line.variant.id, warehouseId: main.id } },
          data: { onHand: { decrement: line.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            variantId: line.variant.id,
            warehouseId: main.id,
            type: 'sale',
            quantity: -line.quantity,
            onHandAfter: level.onHand,
            orderId: order.id,
            reference: `ORDER-${order.orderNumber}`,
            createdAt,
          },
        });
        await tx.product.update({
          where: { id: line.variant.productId },
          data: { soldCount: { increment: line.quantity } },
        });
      }
    });
  }

  const reviewTargets: [string, number, string, string][] = [
    [
      'volter-vcd-18-cordless-drill',
      5,
      'عالی برای کارهای نصب',
      'قدرت خوبی دارد و باتری‌ها برای یک روز کاری کافی هستند. کلاچ دقیقی دارد.',
    ],
    [
      'kaveh-kag-750-angle-grinder',
      4,
      'سبک و خوش‌دست',
      'برای کارهای سبک فلزکاری خیلی خوب است، فقط کمی صدای زیادی دارد.',
    ],
    [
      'steelmax-srh-26-rotary-hammer',
      5,
      'بتن‌کن مطمئن',
      'روی بتن مسلح هم بدون مشکل کار کرد. ضربه قوی و لرزش کم.',
    ],
  ];
  for (const [slug, rating, title, body] of reviewTargets) {
    const product = await prisma.product.findUniqueOrThrow({ where: { slug } });
    await prisma.review.create({
      data: {
        productId: product.id,
        userId: customerId,
        rating,
        title,
        body,
        status: 'approved',
        isVerifiedBuyer: true,
      },
    });
    const aggregate = await prisma.review.aggregate({
      where: { productId: product.id, status: 'approved' },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { ratingAverage: aggregate._avg.rating ?? null, ratingCount: aggregate._count },
    });
  }

  const drill = await prisma.product.findUniqueOrThrow({
    where: { slug: 'volter-vcd-18-cordless-drill' },
  });
  await prisma.productQuestion.create({
    data: {
      productId: drill.id,
      userId: customerId,
      body: 'آیا باتری‌های این دریل با فرز شارژی همین برند سازگار است؟',
      status: 'answered',
      answer: 'بله، تمام ابزارهای ۱۸ ولت ولتر از باتری‌های یکسان استفاده می‌کنند.',
      answeredAt: new Date(),
    },
  });
  await prisma.productQuestion.create({
    data: {
      productId: drill.id,
      userId: customerId,
      body: 'برای سوراخکاری دیوار آجری مناسب است؟',
      status: 'pending',
    },
  });
  console.log(`✔ ${plans.length} demo orders, reviews and questions`);
}

async function seedDemoTickets(prisma: PrismaClient, customerId: string): Promise<void> {
  if ((await prisma.ticket.count({ where: { userId: customerId } })) > 0) return;
  const support = await prisma.user.findUnique({ where: { email: 'support@example.com' } });
  const order = await prisma.order.findFirst({
    where: { userId: customerId, status: 'shipped' },
    orderBy: { createdAt: 'desc' },
  });
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000);

  await prisma.ticket.create({
    data: {
      userId: customerId,
      orderId: order?.id ?? null,
      subject: 'زمان رسیدن مرسوله',
      category: 'shipping',
      status: 'answered',
      assigneeId: support?.id ?? null,
      customerUnread: true,
      staffUnread: false,
      lastMessageAt: at(2),
      createdAt: at(26),
      messages: {
        create: [
          {
            authorId: customerId,
            authorType: 'customer',
            body: 'سلام، سفارشم ارسال شده ولی هنوز به دستم نرسیده. کی تحویل می‌شود؟',
            createdAt: at(26),
          },
          {
            authorId: support?.id ?? null,
            authorType: 'staff',
            isInternal: true,
            body: 'با پست پیگیری شد؛ مرسوله در مرکز مبادلات است.',
            createdAt: at(3),
          },
          {
            authorId: support?.id ?? null,
            authorType: 'staff',
            body: 'سلام، مرسوله شما در مسیر است و طی یک تا دو روز کاری تحویل می‌شود. کد رهگیری در صفحه سفارش قابل مشاهده است.',
            createdAt: at(2),
          },
        ],
      },
    },
  });

  await prisma.ticket.create({
    data: {
      userId: customerId,
      subject: 'سازگاری باتری با دریل ۱۸ ولت',
      category: 'product',
      status: 'open',
      staffUnread: true,
      lastMessageAt: at(1),
      createdAt: at(1),
      messages: {
        create: {
          authorId: customerId,
          authorType: 'customer',
          body: 'آیا باتری ۴ آمپر ولتر با دریل شارژی ۱۸ ولت همین برند سازگار است؟',
          createdAt: at(1),
        },
      },
    },
  });
  console.log('✔ 2 demo support tickets');
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrismaClient({ url, poolSize: 2 });
  try {
    await seedAccessControl(prisma);
    const customerId = await seedUsers(prisma);
    const admin = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: SUPER_ADMIN_ROLE } } } },
      orderBy: { createdAt: 'asc' },
    });
    await seedSettings(prisma);
    const warehouses = await seedWarehouses(prisma);
    const attributes = await seedAttributes(prisma);
    const brands = await seedBrands(prisma);
    const categories = await seedCategories(prisma, attributes);
    await seedProducts(prisma, {
      categories,
      brands,
      attributes,
      warehouses,
      adminId: admin?.id ?? null,
    });
    await seedCommerce(prisma);
    await seedContent(prisma);
    if (!isProduction) {
      await seedDemoOrders(prisma, customerId);
      await seedDemoTickets(prisma, customerId);
    }
    console.log('Seed completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
