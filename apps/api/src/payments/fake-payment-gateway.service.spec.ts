import { PublishStatus, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { FakePaymentGateway } from './fake-payment-gateway.service';
import { NormalizedWebhookEvent } from './payment-gateway.interface';

const SECRET = 'test-secret';

function buildPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'plan-1',
    name: '[TEST] Plano Mensal',
    description: null,
    priceCents: 4990,
    currency: 'BRL',
    interval: 'month',
    trialDays: 0,
    status: PublishStatus.PUBLISHED,
    gatewayPriceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FakePaymentGateway', () => {
  it('verifySignature accepts only a signature matching the HMAC of the body', async () => {
    const gateway = new FakePaymentGateway(SECRET);
    const rawBody = JSON.stringify({ a: 1 });

    expect(gateway.verifySignature(rawBody, undefined)).toBe(false);
    expect(gateway.verifySignature(rawBody, 'bogus')).toBe(false);

    await gateway.createSubscription({ gatewayCustomerId: 'cus_1', plan: buildPlan() });
    const [event] = gateway.drainSimulatedEvents();

    expect(gateway.verifySignature(event.rawBody, event.signature)).toBe(true);
  });

  it('mapWebhookEvent rehydrates dates from the JSON payload', () => {
    const gateway = new FakePaymentGateway(SECRET);
    const original: NormalizedWebhookEvent = {
      eventId: 'evt_1',
      type: 'subscription.updated',
      gatewaySubscriptionId: 'fake_sub_1',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    };

    const mapped = gateway.mapWebhookEvent(JSON.stringify(original));

    expect(mapped.currentPeriodStart).toBeInstanceOf(Date);
    expect(mapped.currentPeriodStart?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(mapped.currentPeriodEnd?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('createSubscription enqueues subscription.updated + invoice.paid for a plan without trial', async () => {
    const gateway = new FakePaymentGateway(SECRET);

    const result = await gateway.createSubscription({
      gatewayCustomerId: 'cus_1',
      plan: buildPlan({ trialDays: 0 }),
    });

    const events = gateway
      .drainSimulatedEvents()
      .map((call) => gateway.mapWebhookEvent(call.rawBody));

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('subscription.updated');
    expect(events[0].status).toBe(SubscriptionStatus.ACTIVE);
    expect(events[0].gatewaySubscriptionId).toBe(result.gatewaySubscriptionId);
    expect(events[1].type).toBe('invoice.paid');
    expect(events[1].invoice?.amountCents).toBe(4990);

    expect(gateway.drainSimulatedEvents()).toHaveLength(0);
  });

  it('createSubscription enqueues only subscription.updated (TRIALING) when the plan has a trial', async () => {
    const gateway = new FakePaymentGateway(SECRET);

    await gateway.createSubscription({
      gatewayCustomerId: 'cus_1',
      plan: buildPlan({ trialDays: 7 }),
    });

    const events = gateway
      .drainSimulatedEvents()
      .map((call) => gateway.mapWebhookEvent(call.rawBody));

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe(SubscriptionStatus.TRIALING);
  });

  it('cancelSubscription enqueues a subscription.canceled event', async () => {
    const gateway = new FakePaymentGateway(SECRET);

    await gateway.cancelSubscription('fake_sub_1');
    const events = gateway
      .drainSimulatedEvents()
      .map((call) => gateway.mapWebhookEvent(call.rawBody));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('subscription.canceled');
    expect(events[0].gatewaySubscriptionId).toBe('fake_sub_1');
  });
});
