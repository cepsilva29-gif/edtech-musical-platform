import { ConflictException } from '@nestjs/common';
import { LiveStatus } from '@prisma/client';
import {
  assertValidLiveStatusTransition,
  isValidLiveStatusTransition,
} from './live-status-transition.util';

describe('isValidLiveStatusTransition', () => {
  it.each([
    [LiveStatus.SCHEDULED, LiveStatus.LIVE, true],
    [LiveStatus.SCHEDULED, LiveStatus.CANCELED, true],
    [LiveStatus.LIVE, LiveStatus.FINISHED, true],
  ])('allows %s -> %s: %p', (from, to, expected) => {
    expect(isValidLiveStatusTransition(from, to)).toBe(expected);
  });

  it.each([
    [LiveStatus.SCHEDULED, LiveStatus.FINISHED],
    [LiveStatus.LIVE, LiveStatus.SCHEDULED],
    [LiveStatus.LIVE, LiveStatus.CANCELED],
    [LiveStatus.FINISHED, LiveStatus.LIVE],
    [LiveStatus.FINISHED, LiveStatus.SCHEDULED],
    [LiveStatus.CANCELED, LiveStatus.SCHEDULED],
    [LiveStatus.CANCELED, LiveStatus.LIVE],
  ])('rejects %s -> %s', (from, to) => {
    expect(isValidLiveStatusTransition(from, to)).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(isValidLiveStatusTransition(LiveStatus.LIVE, LiveStatus.LIVE)).toBe(false);
  });
});

describe('assertValidLiveStatusTransition', () => {
  it('does not throw for an allowed transition', () => {
    expect(() =>
      assertValidLiveStatusTransition(LiveStatus.SCHEDULED, LiveStatus.LIVE),
    ).not.toThrow();
  });

  it('throws ConflictException for a disallowed transition', () => {
    expect(() => assertValidLiveStatusTransition(LiveStatus.FINISHED, LiveStatus.LIVE)).toThrow(
      ConflictException,
    );
  });
});
