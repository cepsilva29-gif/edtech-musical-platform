export interface DateDelta {
  days?: number;
  months?: number;
  years?: number;
}

export function addInterval(date: Date, delta: DateDelta): Date {
  const result = new Date(date.getTime());
  if (delta.days) {
    result.setDate(result.getDate() + delta.days);
  }
  if (delta.months) {
    result.setMonth(result.getMonth() + delta.months);
  }
  if (delta.years) {
    result.setFullYear(result.getFullYear() + delta.years);
  }
  return result;
}

export function intervalForPlan(interval: string): DateDelta {
  return interval === 'year' ? { years: 1 } : { months: 1 };
}
