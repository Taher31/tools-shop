import '../../../src/bootstrap-env';
import { randomInt } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';

export type Agent = ReturnType<typeof request.agent>;

export const API = '/api/v1';

/** Boots the whole application with the exact production HTTP pipeline. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return app;
}

/** A cookie-keeping client, like a browser tab. */
export function agentFor(app: NestExpressApplication): Agent {
  return request.agent(app.getHttpServer());
}

export async function login(
  app: NestExpressApplication,
  identifier: string,
  password: string,
): Promise<Agent> {
  const agent = agentFor(app);
  await agent.post(`${API}/auth/login`).send({ identifier, password }).expect(200);
  return agent;
}

export const ADMIN = { identifier: 'admin@example.com', password: 'Admin@12345' };
export const WAREHOUSE = { identifier: 'warehouse@example.com', password: 'Staff@12345' };
export const SUPPORT = { identifier: 'support@example.com', password: 'Staff@12345' };
export const CUSTOMER = { identifier: '09120000001', password: 'Customer@123' };

let customerSequence = 0;

/** Registers a fresh customer with a default address and returns a logged-in client. */
export async function newCustomer(
  app: NestExpressApplication,
): Promise<{ agent: Agent; addressId: string; mobile: string; password: string }> {
  customerSequence += 1;
  // Random suffix: spec files share one database but not module state.
  const mobile = `0935${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
  const agent = agentFor(app);
  await agent
    .post(`${API}/auth/register`)
    .send({
      firstName: 'مشتری',
      lastName: `آزمایشی ${customerSequence}`,
      mobile,
      password: 'Test@12345',
    })
    .expect(201);
  const address = await agent
    .post(`${API}/account/addresses`)
    .send({
      recipientName: 'گیرنده آزمایشی',
      recipientMobile: mobile,
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان آزمایش، کوچه نمونه، پلاک ۵',
      postalCode: '1311111111',
      isDefault: true,
    })
    .expect(201);
  return { agent, addressId: (address.body as { id: string }).id, mobile, password: 'Test@12345' };
}
