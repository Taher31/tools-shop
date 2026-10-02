import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ImportReport } from '@toolshop/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ADMIN, type Agent, API, createTestApp, login, SUPPORT } from './support/app';
import { ok } from './support/commerce';

const bin = (response: { body: unknown }) => response.body as Buffer;

async function xlsx(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('bulk import and export', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let support: Agent;

  const upload = (entity: string, file: Buffer, name: string, dryRun: boolean) =>
    admin
      .post(`${API}/admin/data/${entity}/import?dryRun=${dryRun}`)
      .attach('file', file, { filename: name });
  const parse = async (path: string) => {
    const res = await admin
      .get(`${API}${path}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    return res;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [admin, support] = await Promise.all([
      login(app, ADMIN.identifier, ADMIN.password),
      login(app, SUPPORT.identifier, SUPPORT.password),
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves sample files with a guide sheet for every importable section', async () => {
    const list = ok<{ key: string; canImport: boolean }[]>(
      await admin.get(`${API}/admin/data/entities`),
    );
    expect(list.map((e) => e.key)).toEqual(
      expect.arrayContaining([
        'products',
        'categories',
        'brands',
        'coupons',
        'inventory',
        'orders',
        'customers',
      ]),
    );
    for (const key of ['products', 'categories', 'brands', 'coupons', 'inventory']) {
      const file = await parse(`/admin/data/${key}/template?format=xlsx`);
      expect(file.status, key).toBe(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bin(file) as never);
      expect(workbook.worksheets.map((s) => s.name)).toEqual(['نمونه', 'راهنما']);
      expect(workbook.worksheets[0]?.rowCount).toBeGreaterThan(1);
    }
    const csv = await parse('/admin/data/brands/template?format=csv');
    expect(bin(csv).toString('utf8').startsWith('﻿')).toBe(true);
    expect((await admin.get(`${API}/admin/data/orders/template`)).status).toBe(409);
  });

  it('imports brands, categories and then products with variants, stock and specs', async () => {
    const brandFile = await xlsx(
      ['نام برند', 'نام انگلیسی'],
      [
        ['برند وارداتی', 'ImportCo'],
        ['برند وارداتی', 'dup'],
      ],
    );
    const preview = ok<ImportReport>(await upload('brands', brandFile, 'brands.xlsx', true));
    expect(preview).toMatchObject({ dryRun: true, created: 1, failed: 1 });
    expect(await prisma.brand.count({ where: { name: 'برند وارداتی' } })).toBe(0);
    const brands = ok<ImportReport>(await upload('brands', brandFile, 'brands.xlsx', false));
    expect(brands.created).toBe(1);
    expect(await prisma.brand.count({ where: { name: 'برند وارداتی' } })).toBe(1);

    const cats = ok<ImportReport>(
      await upload(
        'categories',
        await xlsx(
          ['مسیر دسته‌بندی'],
          [['دسته وارداتی'], ['دسته وارداتی > زیر دسته'], ['ناموجود > فرزند']],
        ),
        'c.xlsx',
        false,
      ),
    );
    expect(cats).toMatchObject({ created: 2, failed: 1 });

    const headers = [
      'کد گروه محصول',
      'عنوان محصول',
      'دسته‌بندی',
      'برند',
      'وضعیت',
      'SKU',
      'قیمت (تومان)',
      'قیمت قبل از تخفیف (تومان)',
      'گزینه‌های تنوع',
      'موجودی',
      'کد انبار',
      'تصاویر',
    ];
    const rows = [
      [
        'G1',
        'محصول وارداتی یک',
        'دسته وارداتی > زیر دسته',
        'برند وارداتی',
        'فعال',
        'imp-001',
        '1,500,000',
        '1,800,000',
        'رنگ=قرمز',
        '12',
        'MAIN',
        'https://example.com/a.jpg',
      ],
      ['G1', '', '', '', '', 'imp-002', '۱۶۰۰۰۰۰', '', 'رنگ=آبی', '5', '', ''],
      [
        'G2',
        'محصول با قیمت بد',
        'دسته وارداتی',
        '',
        'پیش‌نویس',
        'imp-003',
        'abc',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'G3',
        'محصول با دسته ناشناس',
        'دسته‌ای که نیست',
        '',
        '',
        'imp-004',
        '1000',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'G4',
        'محصول با تخفیف نادرست',
        'دسته وارداتی',
        '',
        '',
        'imp-005',
        '1000',
        '900',
        '',
        '',
        '',
        '',
      ],
    ];
    const file = await xlsx(headers, rows);
    const dry = ok<ImportReport>(await upload('products', file, 'p.xlsx', true));
    expect(dry).toMatchObject({ dryRun: true, created: 1, failed: 3 });
    expect(await prisma.productVariant.count({ where: { sku: { startsWith: 'IMP-' } } })).toBe(0);
    expect(dry.results.find((r) => r.row === 4)?.messages.join(' ')).toContain('عدد معتبر نیست');
    expect(dry.results.find((r) => r.row === 5)?.messages.join(' ')).toContain('پیدا نشد');

    const real = ok<ImportReport>(await upload('products', file, 'p.xlsx', false));
    expect(real).toMatchObject({ created: 1, failed: 3 });
    const product = await prisma.product.findFirstOrThrow({
      where: { title: 'محصول وارداتی یک' },
      include: { variants: { include: { inventoryLevels: true } }, images: true },
    });
    expect(product.status).toBe('active');
    expect(product.variants.map((v) => v.sku).sort()).toEqual(['IMP-001', 'IMP-002']);
    expect(product.variants.find((v) => v.sku === 'IMP-001')?.price).toBe(15_000_000n);
    expect(product.variants.find((v) => v.sku === 'IMP-002')?.price).toBe(16_000_000n);
    expect(product.variants.find((v) => v.sku === 'IMP-001')?.inventoryLevels[0]?.onHand).toBe(12);
    expect(product.images).toHaveLength(1);
    expect(await prisma.product.count({ where: { title: 'محصول با قیمت بد' } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'data.import' } })).toBeGreaterThan(0);

    // Re-importing a changed price updates the same product and keeps untouched fields.
    const update = await xlsx(['SKU', 'قیمت (تومان)'], [['IMP-001', '1400000']]);
    const updated = ok<ImportReport>(await upload('products', update, 'u.xlsx', false));
    expect(updated.results[0], JSON.stringify(updated.results)).toMatchObject({ status: 'update' });
    const after = await prisma.product.findFirstOrThrow({
      where: { id: product.id },
      include: { variants: true },
    });
    expect(after.title).toBe('محصول وارداتی یک');
    expect(after.variants).toHaveLength(2);
    expect(after.variants.find((v) => v.sku === 'IMP-001')?.price).toBe(14_000_000n);
  });

  it('accepts CSV with a different delimiter and BOM, and sets stock by SKU', async () => {
    const csv = '﻿sku;موجودی;کد انبار\r\nIMP-001;30;MAIN\r\nNOPE-1;1;MAIN\r\n';
    const report = ok<ImportReport>(
      await upload('inventory', Buffer.from(csv, 'utf8'), 'stock.csv', false),
    );
    expect(report).toMatchObject({ updated: 1, failed: 1 });
    const level = await prisma.inventoryLevel.findFirstOrThrow({
      where: { variant: { sku: 'IMP-001' } },
    });
    expect(level.onHand).toBe(30);
  });

  it('reports bad files and missing columns clearly', async () => {
    const noSku = await upload('inventory', await xlsx(['موجودی'], [['3']]), 'x.xlsx', true);
    expect(noSku.status).toBe(400);
    expect(JSON.stringify(noSku.body)).toContain('SKU');
    const junk = await upload('brands', Buffer.from('not a spreadsheet'), 'x.xlsx', true);
    expect(junk.status).toBe(400);
    expect((await upload('brands', Buffer.from('a,b'), 'x.xls', true)).status).toBe(400);
  });

  it('exports with list filters and neutralises spreadsheet formulas', async () => {
    const exported = await parse('/admin/data/products/export?format=csv&q=IMP-001');
    const text = bin(exported).toString('utf8');
    expect(text).toContain('IMP-001');
    expect(text).not.toContain('IMP-003');
    const orders = await parse(
      '/admin/data/orders/export?format=xlsx&from=2001-01-01&to=2001-01-02',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bin(orders) as never);
    expect(workbook.worksheets[0]?.rowCount).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'data.export' } })).toBeGreaterThan(0);

    await prisma.brand.create({
      data: { name: '=HYPERLINK("http://evil")', slug: 'evil-formula' },
    });
    const brands = bin(await parse('/admin/data/brands/export?format=csv')).toString('utf8');
    expect(brands).toContain(`'=HYPERLINK`);
  });

  it('enforces permissions per section', async () => {
    const warehouse = await login(app, 'warehouse@example.com', 'Staff@12345');
    expect((await warehouse.get(`${API}/admin/data/customers/export?format=csv`)).status).toBe(403);
    expect((await warehouse.get(`${API}/admin/data/inventory/template`)).status).toBe(200);
    expect((await support.get(`${API}/admin/data/inventory/template`)).status).toBe(403);
    expect((await support.get(`${API}/admin/data/orders/export?format=csv`)).status).toBe(403);
    const sales = await login(app, 'sales@example.com', 'Staff@12345');
    expect((await sales.get(`${API}/admin/data/orders/export?format=csv`)).status).toBe(200);
    const upload403 = await support
      .post(`${API}/admin/data/brands/import`)
      .attach('file', Buffer.from('a'), { filename: 'a.csv' });
    expect(upload403.status).toBe(403);
    const content = await login(app, 'content@example.com', 'Staff@12345');
    expect((await content.get(`${API}/admin/data/orders/export?format=csv`)).status).toBe(403);
    expect((await content.get(`${API}/admin/data/products/export?format=csv`)).status).toBe(200);
  });
});
