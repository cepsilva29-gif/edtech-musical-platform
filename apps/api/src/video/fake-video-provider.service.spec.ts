import { FakeVideoProvider } from './fake-video-provider.service';

describe('FakeVideoProvider', () => {
  it('resolves a URL that expires ttlSeconds from now, signed with the given secret', async () => {
    const ttlSeconds = 600;
    const provider = new FakeVideoProvider('test-secret', ttlSeconds);
    const before = Date.now();

    const result = await provider.resolvePlaybackUrl({ videoProvider: 'mux', videoRef: 'abc-123' });

    const after = Date.now();
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlSeconds * 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + ttlSeconds * 1000);
    expect(result.url).toContain('abc-123');
    expect(result.url).toMatch(/[?&]sig=[0-9a-f]{64}/);
  });

  it('produces a different signature for a different secret', async () => {
    const a = new FakeVideoProvider('secret-a', 600);
    const b = new FakeVideoProvider('secret-b', 600);

    const resultA = await a.resolvePlaybackUrl({ videoProvider: null, videoRef: 'same-ref' });
    const resultB = await b.resolvePlaybackUrl({ videoProvider: null, videoRef: 'same-ref' });

    expect(resultA.url).not.toBe(resultB.url);
  });

  it('URL-encodes the videoRef', async () => {
    const provider = new FakeVideoProvider('test-secret', 600);

    const result = await provider.resolvePlaybackUrl({
      videoProvider: null,
      videoRef: 'has spaces/slash',
    });

    expect(result.url).toContain(encodeURIComponent('has spaces/slash'));
  });
});
