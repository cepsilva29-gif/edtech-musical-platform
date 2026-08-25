import { TunerSmoother } from './tuner-smoother';

describe('TunerSmoother', () => {
  it('averages readings within the window', () => {
    const smoother = new TunerSmoother(3);
    expect(smoother.push(10)).toBe(10);
    expect(smoother.push(20)).toBe(15);
    expect(smoother.push(30)).toBe(20);
  });

  it('drops the oldest reading once the window is full', () => {
    const smoother = new TunerSmoother(3);
    smoother.push(10);
    smoother.push(20);
    smoother.push(30);
    // janela agora e [20, 30, 40] - o 10 caiu fora.
    expect(smoother.push(40)).toBe(30);
  });

  it('average() returns 0 before any reading and reflects the current window otherwise', () => {
    const smoother = new TunerSmoother(2);
    expect(smoother.average()).toBe(0);
    smoother.push(4);
    smoother.push(8);
    expect(smoother.average()).toBe(6);
  });

  it('reset() clears the window', () => {
    const smoother = new TunerSmoother(3);
    smoother.push(100);
    smoother.reset();
    expect(smoother.average()).toBe(0);
    expect(smoother.push(10)).toBe(10);
  });

  it('rejects a non-positive or non-integer windowSize', () => {
    expect(() => new TunerSmoother(0)).toThrow(RangeError);
    expect(() => new TunerSmoother(-1)).toThrow(RangeError);
    expect(() => new TunerSmoother(1.5)).toThrow(RangeError);
  });
});
