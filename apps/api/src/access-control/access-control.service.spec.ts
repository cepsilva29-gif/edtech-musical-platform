import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from './access-control.service';

function createPrismaMock(result: unknown) {
  return {
    userSubscription: { findFirst: jest.fn().mockResolvedValue(result) },
  } as unknown as PrismaService;
}

describe('AccessControlService', () => {
  it('returns true when an active/trialing subscription is found', async () => {
    const prisma = createPrismaMock({ id: 'sub-1' });
    const service = new AccessControlService(prisma);

    await expect(service.hasActiveEntitlement('user-1')).resolves.toBe(true);
  });

  it('returns false when no matching subscription is found', async () => {
    const prisma = createPrismaMock(null);
    const service = new AccessControlService(prisma);

    await expect(service.hasActiveEntitlement('user-1')).resolves.toBe(false);
  });

  it('queries only ACTIVE/TRIALING statuses with a non-expired or open-ended period', async () => {
    const prisma = createPrismaMock(null);
    const service = new AccessControlService(prisma);

    await service.hasActiveEntitlement('user-1');

    const findFirstMock = prisma.userSubscription.findFirst as jest.Mock;
    const [callArgs] = findFirstMock.mock.calls[0];
    expect(callArgs.where.userId).toBe('user-1');
    expect(callArgs.where.status.in).toEqual([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ]);
    expect(callArgs.where.OR).toEqual([
      { currentPeriodEnd: null },
      { currentPeriodEnd: { gte: expect.any(Date) } },
    ]);
  });
});

describe('AccessControlService.assertEntitled', () => {
  it('never queries the database when the caller already manages the resource', async () => {
    const prisma = createPrismaMock(null);
    const service = new AccessControlService(prisma);

    await expect(service.assertEntitled('user-1', true)).resolves.toBeUndefined();
    expect(prisma.userSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('resolves when the user is not a manager but has an active entitlement', async () => {
    const prisma = createPrismaMock({ id: 'sub-1' });
    const service = new AccessControlService(prisma);

    await expect(service.assertEntitled('user-1', false)).resolves.toBeUndefined();
  });

  it('throws ForbiddenException when the user is not a manager and has no active entitlement', async () => {
    const prisma = createPrismaMock(null);
    const service = new AccessControlService(prisma);

    await expect(service.assertEntitled('user-1', false)).rejects.toThrow(ForbiddenException);
  });
});
