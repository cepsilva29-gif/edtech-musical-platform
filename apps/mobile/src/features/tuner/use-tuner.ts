import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { detectPitch, matchNearestNote, TunerSmoother, type NoteMatch } from 'music-tools';
import { useCallback, useRef, useState } from 'react';

const SAMPLE_RATE = 44100;
const SMOOTHING_WINDOW = 6;

export interface UseTunerResult {
  listening: boolean;
  hasSignal: boolean;
  note: string | null;
  cents: number | null;
  inTune: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Wrapper de `detectPitch`/`matchNearestNote` (packages/music-tools) sobre captura de audio real
 * via `expo-audio`'s `useAudioStream` - PCM cru do microfone em tempo real (`onBuffer`), sem
 * precisar gravar arquivo/decodificar depois. O algoritmo em si (YIN, cents, tolerancia) e o
 * mesmo usado/testado no pacote puro; aqui so existe a ponte para o hardware de verdade.
 */
export function useTuner(): UseTunerResult {
  const [listening, setListening] = useState(false);
  const [hasSignal, setHasSignal] = useState(false);
  const [match, setMatch] = useState<NoteMatch | null>(null);
  const smootherRef = useRef(new TunerSmoother(SMOOTHING_WINDOW));

  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buffer) => {
      const samples = new Float32Array(buffer.data);
      const pitch = detectPitch(samples, buffer.sampleRate);

      if (!pitch) {
        setHasSignal(false);
        return;
      }

      setHasSignal(true);
      const nearest = matchNearestNote(pitch.frequency);
      const smoothedCents = smootherRef.current.push(nearest.cents);
      setMatch({ ...nearest, cents: smoothedCents, inTune: Math.abs(smoothedCents) <= 5 });
    },
  });

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      throw new Error('Permissao de microfone negada.');
    }
    smootherRef.current.reset();
    setMatch(null);
    setHasSignal(false);
    await stream.start();
    setListening(true);
  }, [stream]);

  const stop = useCallback(() => {
    stream.stop();
    setListening(false);
    setHasSignal(false);
    setMatch(null);
  }, [stream]);

  return {
    listening,
    hasSignal,
    note: match?.note ?? null,
    cents: match?.cents ?? null,
    inTune: match?.inTune ?? false,
    start,
    stop,
  };
}
