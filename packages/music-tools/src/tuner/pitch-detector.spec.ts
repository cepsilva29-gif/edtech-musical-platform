import { detectPitch } from './pitch-detector';

const SAMPLE_RATE = 44100;

function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationSeconds: number,
): Float32Array {
  const length = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

describe('detectPitch', () => {
  it.each([110, 146.83, 220, 329.63])(
    'detects the frequency of a clean sine wave at %p Hz within 1%%',
    (frequency) => {
      const buffer = generateSineWave(frequency, SAMPLE_RATE, 0.05);

      const result = detectPitch(buffer, SAMPLE_RATE);

      expect(result).not.toBeNull();
      expect(result?.frequency).toBeGreaterThan(frequency * 0.99);
      expect(result?.frequency).toBeLessThan(frequency * 1.01);
      expect(result?.confidence).toBeGreaterThan(0.5);
    },
  );

  it('returns null for silence (below the RMS gate)', () => {
    const silence = new Float32Array(SAMPLE_RATE * 0.05);
    expect(detectPitch(silence, SAMPLE_RATE)).toBeNull();
  });

  it('returns null for a signal below the configured minRms even if not exactly silent', () => {
    const quiet = generateSineWave(220, SAMPLE_RATE, 0.05).map((sample) => sample * 0.001);
    expect(detectPitch(quiet, SAMPLE_RATE)).toBeNull();
  });

  it('returns null for white noise (no clear periodicity)', () => {
    const length = Math.floor(SAMPLE_RATE * 0.05);
    const noise = new Float32Array(length);
    // PRNG determinístico simples para o teste ser reprodutível sem depender de Math.random.
    let seed = 42;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (seed / 0x7fffffff) * 2 - 1;
    }

    expect(detectPitch(noise, SAMPLE_RATE)).toBeNull();
  });

  it('respects a custom minConfidence by rejecting borderline signals', () => {
    const buffer = generateSineWave(220, SAMPLE_RATE, 0.05);
    const result = detectPitch(buffer, SAMPLE_RATE, { minConfidence: 1.1 });
    expect(result).toBeNull();
  });
});
