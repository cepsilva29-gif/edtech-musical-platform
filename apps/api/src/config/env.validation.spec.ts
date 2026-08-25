import 'reflect-metadata';
import { validate } from './env.validation';

const REQUIRED = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
};

describe('validate (env.validation)', () => {
  it('coerces PORT from the string every OS env var actually is into a number', () => {
    const config = validate({ ...REQUIRED, PORT: '4321' });
    expect(config.PORT).toBe(4321);
    expect(typeof config.PORT).toBe('number');
  });

  it('falls back to the documented defaults when optional vars are omitted', () => {
    const config = validate({ ...REQUIRED });
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PAYMENT_PROVIDER).toBe('fake');
    expect(config.VIDEO_PROVIDER).toBe('fake');
    expect(config.VIDEO_PLAYBACK_URL_TTL_SECONDS).toBe(600);
    expect(config.LIVE_PROVIDER).toBe('fake');
    expect(config.LIVE_RECORDING_URL_TTL_SECONDS).toBe(600);
  });

  it('coerces VIDEO_PLAYBACK_URL_TTL_SECONDS from string to number, same as PORT', () => {
    const config = validate({ ...REQUIRED, VIDEO_PLAYBACK_URL_TTL_SECONDS: '120' });
    expect(config.VIDEO_PLAYBACK_URL_TTL_SECONDS).toBe(120);
    expect(typeof config.VIDEO_PLAYBACK_URL_TTL_SECONDS).toBe('number');
  });

  it('coerces LIVE_RECORDING_URL_TTL_SECONDS from string to number, same as PORT', () => {
    const config = validate({ ...REQUIRED, LIVE_RECORDING_URL_TTL_SECONDS: '90' });
    expect(config.LIVE_RECORDING_URL_TTL_SECONDS).toBe(90);
    expect(typeof config.LIVE_RECORDING_URL_TTL_SECONDS).toBe('number');
  });

  it('rejects a PORT outside the valid TCP port range', () => {
    expect(() => validate({ ...REQUIRED, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a missing required variable (e.g. DATABASE_URL)', () => {
    expect(() =>
      validate({
        JWT_SECRET: REQUIRED.JWT_SECRET,
        JWT_REFRESH_SECRET: REQUIRED.JWT_REFRESH_SECRET,
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
