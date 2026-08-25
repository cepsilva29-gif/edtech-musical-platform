import { INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerStudent, registerWithRoles } from './utils/fixtures';
import { resetDatabase } from './utils/reset-database';
import { createTestApp } from './utils/test-app';

describe('Assinaturas: checkout, entitlement e cancelamento (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('checkout aprova instantaneamente via FakePaymentGateway (drena o webhook simulado)', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const student = await registerStudent(app);

    const plan = await request(server())
      .post('/api/v1/subscription-plans')
      .set(...authHeader(admin))
      .send({ name: 'Plano Mensal', priceCents: 4990, interval: 'month', status: 'PUBLISHED' });
    expect(plan.status).toBe(201);
    const planId = plan.body.data.id as string;

    const beforeCheckout = await request(server())
      .get('/api/v1/subscriptions/me')
      .set(...authHeader(student));
    expect(beforeCheckout.body.data).toBeNull();

    const checkout = await request(server())
      .post('/api/v1/subscriptions/checkout')
      .set(...authHeader(student))
      .send({ planId });
    expect(checkout.status).toBe(200);

    const afterCheckout = await request(server())
      .get('/api/v1/subscriptions/me')
      .set(...authHeader(student));
    expect(afterCheckout.body.data).toMatchObject({
      status: 'ACTIVE',
      plan: { name: 'Plano Mensal' },
    });

    // uma segunda assinatura ativa deve ser recusada (regra de negocio, nao so validacao de DTO)
    const secondCheckout = await request(server())
      .post('/api/v1/subscriptions/checkout')
      .set(...authHeader(student))
      .send({ planId });
    expect(secondCheckout.status).toBe(409);
  });

  it('cancelamento marca a assinatura como CANCELED imediatamente (gateway fake e sincrono)', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const student = await registerStudent(app);

    const plan = await request(server())
      .post('/api/v1/subscription-plans')
      .set(...authHeader(admin))
      .send({ name: 'Plano Anual', priceCents: 49900, interval: 'year', status: 'PUBLISHED' });

    await request(server())
      .post('/api/v1/subscriptions/checkout')
      .set(...authHeader(student))
      .send({ planId: plan.body.data.id })
      .expect(200);

    await request(server())
      .post('/api/v1/subscriptions/cancel')
      .set(...authHeader(student))
      .expect(200);

    const afterCancel = await request(server())
      .get('/api/v1/subscriptions/me')
      .set(...authHeader(student));
    expect(afterCancel.body.data.status).toBe('CANCELED');
  });

  it('idempotencia de webhook: reenviar o mesmo eventId nao reprocessa (constraint unica, nao logica de app)', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const student = await registerStudent(app);

    const plan = await request(server())
      .post('/api/v1/subscription-plans')
      .set(...authHeader(admin))
      .send({ name: 'Plano Mensal', priceCents: 4990, interval: 'month', status: 'PUBLISHED' });

    await request(server())
      .post('/api/v1/subscriptions/checkout')
      .set(...authHeader(student))
      .send({ planId: plan.body.data.id })
      .expect(200);

    const subscription = await prisma.userSubscription.findFirstOrThrow({
      where: { userId: student.id },
    });

    // Simula um retry de gateway real: o MESMO eventId, assinado com o segredo configurado em
    // FAKE_PAYMENT_GATEWAY_SECRET, enviado duas vezes contra a rota publica de webhook.
    const secret = process.env.FAKE_PAYMENT_GATEWAY_SECRET!;
    const eventId = randomUUID();
    const rawBody = JSON.stringify({
      eventId,
      type: 'subscription.updated',
      gatewaySubscriptionId: subscription.gatewaySubscriptionId,
      status: 'PAST_DUE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

    const firstCall = await request(server())
      .post('/api/v1/payments/webhook/fake')
      .set('x-webhook-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(firstCall.status).toBe(200);

    const afterFirst = await prisma.userSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(afterFirst.status).toBe('PAST_DUE');

    // Reverte manualmente para provar que o segundo envio do MESMO eventId nao reaplica o evento
    // (senao o status voltaria para PAST_DUE de novo, mesmo tendo sido revertido aqui).
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE' },
    });

    const secondCall = await request(server())
      .post('/api/v1/payments/webhook/fake')
      .set('x-webhook-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(secondCall.status).toBe(200);

    const afterSecond = await prisma.userSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });
    expect(afterSecond.status).toBe('ACTIVE');

    const eventRows = await prisma.paymentWebhookEvent.count({ where: { eventId } });
    expect(eventRows).toBe(1);
  });
});
