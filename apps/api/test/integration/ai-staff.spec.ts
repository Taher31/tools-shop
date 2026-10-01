import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AdminQuestionView,
  AdminTicketDetail,
  AiDraft,
  AiSettingsView,
  AiUsageSummary,
  ApiErrorBody,
  Paginated,
  ProductContentDraft,
  TicketDetail,
  TicketTriage,
} from '@toolshop/shared';
import { aiSettingsSchema } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import { AiStaffService } from '../../src/modules/ai/ai-staff.service';
import {
  ADMIN,
  type Agent,
  API,
  createTestApp,
  login,
  newCustomer,
  SUPPORT,
  WAREHOUSE,
} from './support/app';
import { ok } from './support/commerce';

const errorCode = (body: unknown) => (body as ApiErrorBody).error.code;

describe('AI staff tools and AI center administration', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let support: Agent;
  let warehouse: Agent;
  let content: Agent;

  async function configure(overrides: Record<string, unknown> = {}) {
    const value = aiSettingsSchema.parse({ enabled: true, provider: 'mock', ...overrides });
    await prisma.setting.upsert({
      where: { key: 'ai' },
      update: { value },
      create: { key: 'ai', value },
    });
    await app.get(CacheService).del('ai:settings');
  }

  async function askQuestion(body: string): Promise<string> {
    const customer = await newCustomer(app);
    const product = await prisma.product.findFirstOrThrow({
      where: { slug: 'toolino-taw-adjustable-wrench' },
    });
    const response = await customer.agent
      .post(`${API}/products/${product.id}/questions`)
      .send({ body });
    expect(response.status).toBeLessThan(300);
    const question = await prisma.productQuestion.findFirstOrThrow({
      where: { body },
      orderBy: { createdAt: 'desc' },
    });
    return question.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [admin, support, warehouse, content] = await Promise.all([
      login(app, ADMIN.identifier, ADMIN.password),
      login(app, SUPPORT.identifier, SUPPORT.password),
      login(app, WAREHOUSE.identifier, WAREHOUSE.password),
      login(app, 'content@example.com', 'Staff@12345'),
    ]);
    await configure();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('stores the API key encrypted and never returns it', async () => {
    const key = 'sk-ant-test-0123456789abcdefWXYZ';
    const view = ok<AiSettingsView>(
      await admin.put(`${API}/admin/ai/secrets`).send({ anthropicApiKey: key }),
    );
    expect(view.key).toEqual({ source: 'settings', preview: '••••WXYZ' });
    expect(JSON.stringify(view)).not.toContain(key);

    const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'ai_secrets' } });
    expect(JSON.stringify(row.value)).not.toContain(key);
    const audits = await prisma.auditLog.findMany({ where: { action: 'ai.key.update' } });
    expect(JSON.stringify(audits)).not.toContain(key);

    const cleared = ok<AiSettingsView>(
      await admin.put(`${API}/admin/ai/secrets`).send({ anthropicApiKey: '' }),
    );
    expect(cleared.key.source).not.toBe('settings');
  });

  it('restricts the AI center to its permissions', async () => {
    expect((await warehouse.get(`${API}/admin/ai/settings`)).status).toBe(403);
    expect((await support.put(`${API}/admin/ai/settings`).send({})).status).toBe(403);
    expect((await support.put(`${API}/admin/ai/secrets`).send({})).status).toBe(403);
    ok<AiUsageSummary>(await admin.get(`${API}/admin/ai/usage`));

    const settings = ok<AiSettingsView>(await admin.get(`${API}/admin/ai/settings`));
    const updated = ok<AiSettingsView>(
      await admin
        .put(`${API}/admin/ai/settings`)
        .send({ ...settings.settings, assistantName: 'ابزاریار' }),
    );
    expect(updated.settings.assistantName).toBe('ابزاریار');
  });

  it('suggests answers to product questions and only auto-publishes when allowed', async () => {
    const questionId = await askQuestion('آیا این آچار برای لوله‌کشی مناسب است؟');
    const draft = ok<AiDraft>(
      await support.post(`${API}/admin/ai/questions/${questionId}/suggest`),
    );
    expect(draft.text.length).toBeGreaterThan(5);
    expect(draft.confidence).toBeGreaterThanOrEqual(0);

    // The suggestion is stored for the moderation list but not published.
    const list = ok<Paginated<AdminQuestionView>>(
      await support.get(`${API}/admin/questions?status=pending&pageSize=50`),
    );
    const row = list.items.find((q) => q.id === questionId);
    expect(row?.aiSuggestion?.answer).toBe(draft.text);
    expect(row?.status).toBe('pending');

    // Without ai.use a role cannot call the model, even with other permissions.
    expect((await warehouse.post(`${API}/admin/ai/questions/${questionId}/suggest`)).status).toBe(
      403,
    );

    // Auto-publish never fires for a draft that needs a human (the mock always says so).
    await configure({ qaAutoPublish: true, qaAutoPublishMinConfidence: 0.6 });
    await app.get(AiStaffService).suggestQuestionAnswer(questionId);
    const still = await prisma.productQuestion.findUniqueOrThrow({ where: { id: questionId } });
    expect(still.status).toBe('pending');
    await configure();
  });

  it('drafts and triages support tickets without changing anything customers see', async () => {
    const customer = await newCustomer(app);
    const ticket = ok<TicketDetail>(
      await customer.agent.post(`${API}/account/tickets`).send({
        subject: 'مبلغ کسر شد',
        category: 'other',
        body: 'مبلغ از حسابم کسر شد ولی پرداخت ثبت نشد، لطفاً فوری بررسی کنید.',
      }),
    );

    const draft = ok<AiDraft>(await support.post(`${API}/admin/ai/tickets/${ticket.id}/draft`));
    expect(draft.text.length).toBeGreaterThan(5);

    const triage = ok<TicketTriage>(
      await support.post(`${API}/admin/ai/tickets/${ticket.id}/triage`),
    );
    expect(triage.sentiment).toBe('negative');
    expect(triage.suggestedPriority).toBe('high');

    const detail = ok<AdminTicketDetail>(await support.get(`${API}/admin/tickets/${ticket.id}`));
    expect(detail.ai?.summary).toBeTruthy();
    expect(detail.priority).toBe('high');
    expect(detail.category).toBe('payment');
    // Drafts are never posted on their own.
    expect(detail.messages.filter((m) => m.authorType === 'staff')).toHaveLength(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ticket.ai_triage', entityId: ticket.id },
    });
    expect(audit?.actorType).toBe('ai');
  });

  it('generates sanitized product copy for content managers', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { parentId: { not: null } } });
    const draft = ok<ProductContentDraft>(
      await content.post(`${API}/admin/ai/product-content`).send({
        title: 'دریل پیچ‌گوشتی شارژی ۱۸ ولت',
        categoryId: category.id,
        attributes: [],
      }),
    );
    expect(draft.description).toContain('<p>');
    expect(draft.tags.length).toBeGreaterThan(0);
    expect(draft.seoTitle.length).toBeLessThanOrEqual(70);

    const invalid = await content
      .post(`${API}/admin/ai/product-content`)
      .send({ title: 'x', categoryId: '00000000-0000-7000-8000-000000000000', attributes: [] });
    expect(invalid.status).toBe(400);
  });

  it('reports a clear error when AI is switched off', async () => {
    await configure({ enabled: false });
    const response = await content.post(`${API}/admin/ai/product-content`).send({
      title: 'فرز',
      categoryId: (await prisma.category.findFirstOrThrow()).id,
      attributes: [],
    });
    expect(response.status).toBe(503);
    expect(errorCode(response.body)).toBeTruthy();
    await configure();
  });
});
