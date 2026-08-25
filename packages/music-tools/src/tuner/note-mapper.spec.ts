import { centsDeviation, matchNearestNote, STANDARD_GUITAR_TUNING } from './note-mapper';

describe('centsDeviation', () => {
  it('is 0 when the frequency matches the target exactly', () => {
    expect(centsDeviation(440, 440)).toBeCloseTo(0, 6);
  });

  it('is +1200 cents for exactly one octave above', () => {
    expect(centsDeviation(880, 440)).toBeCloseTo(1200, 6);
  });

  it('is -1200 cents for exactly one octave below', () => {
    expect(centsDeviation(220, 440)).toBeCloseTo(-1200, 6);
  });

  it('is positive when sharp (above target) and negative when flat (below target)', () => {
    expect(centsDeviation(442, 440)).toBeGreaterThan(0);
    expect(centsDeviation(438, 440)).toBeLessThan(0);
  });
});

describe('matchNearestNote', () => {
  it('matches the exact standard-tuning frequency with 0 cents and inTune=true', () => {
    const match = matchNearestNote(110.0, STANDARD_GUITAR_TUNING);
    expect(match.note).toBe('A2');
    expect(match.cents).toBeCloseTo(0, 3);
    expect(match.inTune).toBe(true);
  });

  it('picks the closest note even when slightly off, and flags out-of-tune beyond +-5 cents', () => {
    // ~30 cents acima de A2 (110Hz) ainda esta mais perto de A2 que de D3.
    const sharpA = 110 * 2 ** (30 / 1200);
    const match = matchNearestNote(sharpA, STANDARD_GUITAR_TUNING);
    expect(match.note).toBe('A2');
    expect(match.cents).toBeCloseTo(30, 1);
    expect(match.inTune).toBe(false);
  });

  it('stays inTune comfortably within the +-5 cents tolerance', () => {
    const almostA = 110 * 2 ** (4.9 / 1200);
    const match = matchNearestNote(almostA, STANDARD_GUITAR_TUNING);
    expect(match.inTune).toBe(true);
  });

  it('is out of tune just past the +-5 cents tolerance', () => {
    const justSharp = 110 * 2 ** (5.1 / 1200);
    const match = matchNearestNote(justSharp, STANDARD_GUITAR_TUNING);
    expect(match.inTune).toBe(false);
  });

  it('throws for an empty tuning set', () => {
    expect(() => matchNearestNote(110, [])).toThrow(RangeError);
  });
});
