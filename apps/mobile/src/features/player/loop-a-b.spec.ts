import {
  clearLoop,
  computeSeekTarget,
  EMPTY_LOOP_AB,
  isLoopActive,
  setPointA,
  setPointB,
} from './loop-a-b';

describe('setPointA / setPointB', () => {
  it('sets pointA, leaving pointB untouched when it is still valid', () => {
    const withB = setPointB(setPointA(EMPTY_LOOP_AB, 10), 20);
    const moved = setPointA(withB, 15);
    expect(moved).toEqual({ pointA: 15, pointB: 20 });
  });

  it('discards pointB when the new pointA would land at or after it', () => {
    const withB = setPointB(setPointA(EMPTY_LOOP_AB, 10), 20);
    const moved = setPointA(withB, 25);
    expect(moved).toEqual({ pointA: 25, pointB: null });
  });

  it('ignores setPointB before pointA is set', () => {
    expect(setPointB(EMPTY_LOOP_AB, 10)).toBe(EMPTY_LOOP_AB);
  });

  it('ignores setPointB at or before the current pointA', () => {
    const withA = setPointA(EMPTY_LOOP_AB, 10);
    expect(setPointB(withA, 10)).toBe(withA);
    expect(setPointB(withA, 5)).toBe(withA);
  });

  it('accepts a valid pointB after pointA', () => {
    const withA = setPointA(EMPTY_LOOP_AB, 10);
    expect(setPointB(withA, 20)).toEqual({ pointA: 10, pointB: 20 });
  });
});

describe('clearLoop / isLoopActive', () => {
  it('clearLoop resets to the empty state', () => {
    expect(clearLoop()).toEqual(EMPTY_LOOP_AB);
  });

  it('isLoopActive is true only when both points are set', () => {
    expect(isLoopActive(EMPTY_LOOP_AB)).toBe(false);
    expect(isLoopActive(setPointA(EMPTY_LOOP_AB, 10))).toBe(false);
    expect(isLoopActive(setPointB(setPointA(EMPTY_LOOP_AB, 10), 20))).toBe(true);
  });
});

describe('computeSeekTarget', () => {
  it('returns null when the loop is not fully set', () => {
    expect(computeSeekTarget(EMPTY_LOOP_AB, 100)).toBeNull();
    expect(computeSeekTarget(setPointA(EMPTY_LOOP_AB, 10), 100)).toBeNull();
  });

  it('returns null while currentTime is still before pointB', () => {
    const loop = setPointB(setPointA(EMPTY_LOOP_AB, 10), 20);
    expect(computeSeekTarget(loop, 19.9)).toBeNull();
  });

  it('returns pointA once currentTime reaches or passes pointB', () => {
    const loop = setPointB(setPointA(EMPTY_LOOP_AB, 10), 20);
    expect(computeSeekTarget(loop, 20)).toBe(10);
    expect(computeSeekTarget(loop, 25)).toBe(10);
  });
});
