import { FakeLiveProvider } from './fake-live-provider.service';

const SECRET = 'test-secret';

describe('FakeLiveProvider', () => {
  it('createLiveStream returns a unique streamRef and playback/ingest info without enqueuing events', async () => {
    const provider = new FakeLiveProvider(SECRET, 600);

    const result = await provider.createLiveStream({
      liveSessionId: 'live-1',
      title: 'Aula ao vivo',
    });

    expect(result.streamRef).toMatch(/^fake_live_/);
    expect(result.playbackUrl).toContain(result.streamRef);
    expect(result.ingestUrl).toBeTruthy();
    expect(result.streamKey).toBeTruthy();
    expect(provider.drainSimulatedEvents()).toHaveLength(0);
  });

  it('endLiveStream enqueues a signed recording.ready event referencing the given streamRef', async () => {
    const provider = new FakeLiveProvider(SECRET, 600);

    await provider.endLiveStream({ streamRef: 'fake_live_abc' });
    const [call] = provider.drainSimulatedEvents();

    expect(provider.verifySignature(call.rawBody, call.signature)).toBe(true);
    const event = provider.mapWebhookEvent(call.rawBody);
    expect(event.type).toBe('recording.ready');
    expect(event.streamRef).toBe('fake_live_abc');
    expect(event.recordingRef).toMatch(/^fake_rec_/);
  });

  it('drainSimulatedEvents empties the queue', async () => {
    const provider = new FakeLiveProvider(SECRET, 600);
    await provider.endLiveStream({ streamRef: 'fake_live_abc' });

    expect(provider.drainSimulatedEvents()).toHaveLength(1);
    expect(provider.drainSimulatedEvents()).toHaveLength(0);
  });

  it('resolveRecordingPlaybackUrl signs a URL that expires ttlSeconds from now', async () => {
    const ttlSeconds = 300;
    const provider = new FakeLiveProvider(SECRET, ttlSeconds);
    const before = Date.now();

    const result = await provider.resolveRecordingPlaybackUrl({
      streamProvider: 'fake',
      recordingRef: 'fake_rec_xyz',
    });

    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlSeconds * 1000);
    expect(result.url).toContain('fake_rec_xyz');
    expect(result.url).toMatch(/[?&]sig=[0-9a-f]{64}/);
  });

  it('verifySignature rejects a missing or wrong signature', () => {
    const provider = new FakeLiveProvider(SECRET, 600);
    expect(provider.verifySignature('{}', undefined)).toBe(false);
    expect(provider.verifySignature('{}', 'bogus')).toBe(false);
  });
});
