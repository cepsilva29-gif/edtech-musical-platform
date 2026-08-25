import { MetronomeEngine, MetronomeState } from './metronome-engine';

function baseState(overrides: Partial<MetronomeState> = {}): MetronomeState {
  return {
    bpm: 120,
    timeSignature: { beatsPerBar: 4 },
    subdivision: 1,
    accentFirstBeat: true,
    volume: 0.8,
    ...overrides,
  };
}

describe('MetronomeEngine construction/validation', () => {
  it.each([39, 241, NaN])('rejects bpm out of the 40-240 range (%p)', (bpm) => {
    expect(() => new MetronomeEngine(baseState({ bpm }))).toThrow(RangeError);
  });

  it('accepts the boundary values 40 and 240', () => {
    expect(() => new MetronomeEngine(baseState({ bpm: 40 }))).not.toThrow();
    expect(() => new MetronomeEngine(baseState({ bpm: 240 }))).not.toThrow();
  });

  it('rejects a non-positive beatsPerBar or subdivision', () => {
    expect(() => new MetronomeEngine(baseState({ timeSignature: { beatsPerBar: 0 } }))).toThrow(
      RangeError,
    );
    expect(() => new MetronomeEngine(baseState({ subdivision: 0 }))).toThrow(RangeError);
  });

  it('rejects volume outside 0-1', () => {
    expect(() => new MetronomeEngine(baseState({ volume: 1.5 }))).toThrow(RangeError);
    expect(() => new MetronomeEngine(baseState({ volume: -0.1 }))).toThrow(RangeError);
  });

  it('updateState validates the merged state, not just the patch', () => {
    const engine = new MetronomeEngine(baseState());
    expect(() => engine.updateState({ bpm: 999 })).toThrow(RangeError);
    expect(engine.getState().bpm).toBe(120);
  });
});

describe('MetronomeEngine.tick (lookahead scheduling)', () => {
  it('is idle (no ticks, not running) before start()', () => {
    const engine = new MetronomeEngine(baseState());
    expect(engine.isRunning).toBe(false);
    expect(engine.tick(10)).toEqual([]);
  });

  it('schedules one tick per beat at bpm=60/subdivision=1, exactly 1s apart', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60, subdivision: 1 }));
    engine.start(0);

    const ticks = engine.tick(3.5);

    expect(ticks.map((t) => t.time)).toEqual([0, 1, 2, 3]);
    expect(ticks.every((t) => t.isBeat)).toBe(true);
  });

  it('continues scheduling from where the previous call left off (no gaps/overlaps)', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60, subdivision: 1 }));
    engine.start(0);

    const first = engine.tick(2.5);
    const second = engine.tick(4.5);

    expect(first.map((t) => t.time)).toEqual([0, 1, 2]);
    expect(second.map((t) => t.time)).toEqual([3, 4]);
  });

  it('marks only the first beat of the bar as accented when accentFirstBeat is true', () => {
    const engine = new MetronomeEngine(
      baseState({
        bpm: 60,
        subdivision: 1,
        timeSignature: { beatsPerBar: 4 },
        accentFirstBeat: true,
      }),
    );
    engine.start(0);

    const ticks = engine.tick(8.5);

    expect(ticks.map((t) => t.isAccent)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
    expect(ticks.map((t) => t.beatIndex)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
  });

  it('never accents when accentFirstBeat is false', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60, accentFirstBeat: false }));
    engine.start(0);

    expect(engine.tick(4.5).every((t) => !t.isAccent)).toBe(true);
  });

  it('emits subdivision ticks between beats, flagging isBeat only on the downbeat', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60, subdivision: 2 }));
    engine.start(0);

    const ticks = engine.tick(2.1);

    expect(ticks.map((t) => t.time)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(ticks.map((t) => t.isBeat)).toEqual([true, false, true, false, true]);
    expect(ticks.map((t) => t.subdivisionIndex)).toEqual([0, 1, 0, 1, 0]);
  });

  it('stop() halts scheduling and start() resets bar/beat position to the start', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60 }));
    engine.start(0);
    engine.tick(2.5);
    engine.stop();

    expect(engine.isRunning).toBe(false);
    expect(engine.tick(10)).toEqual([]);

    engine.start(100);
    const ticks = engine.tick(101.5);
    expect(ticks.map((t) => t.time)).toEqual([100, 101]);
    expect(ticks[0].beatIndex).toBe(0);
  });

  it('a bpm change via updateState takes effect on ticks scheduled after the change', () => {
    const engine = new MetronomeEngine(baseState({ bpm: 60 }));
    engine.start(0);
    const before = engine.tick(1.5);
    expect(before.map((t) => t.time)).toEqual([0, 1]);

    engine.updateState({ bpm: 120 });
    const after = engine.tick(2.75);
    expect(after.map((t) => t.time)).toEqual([2, 2.5]);
  });
});
