import { addInterval, intervalForPlan } from './date-interval.util';

describe('addInterval', () => {
  it('adds days, months and years without mutating the input date', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');

    expect(addInterval(start, { days: 10 }).toISOString()).toBe('2026-01-25T10:00:00.000Z');
    expect(addInterval(start, { months: 1 }).toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(addInterval(start, { years: 1 }).toISOString()).toBe('2027-01-15T10:00:00.000Z');
    expect(start.toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('returns the same instant when the delta is empty', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    expect(addInterval(start, {}).toISOString()).toBe(start.toISOString());
  });
});

describe('intervalForPlan', () => {
  it('maps "year" to a 1-year delta and anything else to a 1-month delta', () => {
    expect(intervalForPlan('year')).toEqual({ years: 1 });
    expect(intervalForPlan('month')).toEqual({ months: 1 });
  });
});
