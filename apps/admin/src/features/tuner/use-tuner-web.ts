'use client';

import { detectPitch, matchNearestNote, TunerSmoother, type NoteMatch } from 'music-tools';
import { useCallback, useRef, useState } from 'react';

const BUFFER_SIZE = 2048;
const SMOOTHING_WINDOW = 6;

export interface UseTunerWebResult {
  listening: boolean;
  hasSignal: boolean;
  note: string | null;
  cents: number | null;
  inTune: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Wrapper de `detectPitch`/`matchNearestNote` (packages/music-tools) sobre captura de audio real
 * via `getUserMedia` + `ScriptProcessorNode`. `ScriptProcessorNode` esta formalmente depreciado em
 * favor de `AudioWorkletNode`, mas segue amplamente suportado e e muito mais simples de configurar
 * sem um arquivo worklet separado - aceitavel para o uso "preview/ferramenta de professor" deste
 * painel (nao e um produto de audio profissional). O algoritmo (YIN, cents, tolerancia) e o mesmo
 * testado no pacote puro.
 */
export function useTunerWeb(): UseTunerWebResult {
  const [listening, setListening] = useState(false);
  const [hasSignal, setHasSignal] = useState(false);
  const [match, setMatch] = useState<NoteMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const smootherRef = useRef(new TunerSmoother(SMOOTHING_WINDOW));
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setListening(false);
    setHasSignal(false);
    setMatch(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      smootherRef.current.reset();
      setMatch(null);
      setHasSignal(false);

      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        const pitch = detectPitch(samples, audioContext.sampleRate);

        if (!pitch) {
          setHasSignal(false);
          return;
        }

        setHasSignal(true);
        const nearest = matchNearestNote(pitch.frequency);
        const smoothedCents = smootherRef.current.push(nearest.cents);
        setMatch({ ...nearest, cents: smoothedCents, inTune: Math.abs(smoothedCents) <= 5 });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setListening(true);
    } catch {
      setError('Nao foi possivel acessar o microfone.');
      stop();
    }
  }, [stop]);

  return {
    listening,
    hasSignal,
    note: match?.note ?? null,
    cents: match?.cents ?? null,
    inTune: match?.inTune ?? false,
    error,
    start,
    stop,
  };
}
