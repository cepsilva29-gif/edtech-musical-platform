'use client';

import { MetronomeEngine, type MetronomeState } from 'music-tools';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ponte entre o MetronomeEngine puro (packages/music-tools) e a Web Audio API.
 *
 * Ao contrario do mobile (apps/mobile/src/features/metronome/use-metronome.ts, que depende do
 * timer JS para efetivamente disparar `player.play()`), aqui `AudioContext.currentTime` e um clock
 * de audio de alta precisao: cada tick e agendado com `oscillator.start(tick.time)` no clock real,
 * entao o disparo do som tem precisao de amostra mesmo que o `setInterval` do scheduler sofra
 * jitter - o timer so decide "ate quando olhar a frente" (lookahead), nunca o instante do som.
 */

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SECONDS = 0.15;
const CLICK_FREQUENCY = 1000;
const ACCENT_FREQUENCY = 1600;
const CLICK_DURATION_SECONDS = 0.05;

export const DEFAULT_METRONOME_STATE: MetronomeState = {
  bpm: 100,
  timeSignature: { beatsPerBar: 4 },
  subdivision: 1,
  accentFirstBeat: true,
  volume: 1,
};

export interface UseMetronomeWebResult {
  state: MetronomeState;
  isRunning: boolean;
  currentBeat: number | null;
  start: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  setBeatsPerBar: (beatsPerBar: number) => void;
  setSubdivision: (subdivision: number) => void;
  setAccentFirstBeat: (accent: boolean) => void;
}

export function useMetronomeWeb(): UseMetronomeWebResult {
  const [state, setState] = useState<MetronomeState>(DEFAULT_METRONOME_STATE);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);

  const engineRef = useRef(new MetronomeEngine(DEFAULT_METRONOME_STATE));
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateState = useCallback((patch: Partial<MetronomeState>) => {
    engineRef.current.updateState(patch);
    setState(engineRef.current.getState());
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    engineRef.current.stop();
    setIsRunning(false);
    setCurrentBeat(null);
  }, []);

  const start = useCallback(() => {
    const audioContext = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audioContext;
    void audioContext.resume();

    engineRef.current.start(audioContext.currentTime);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      const scheduleUntil = audioContext.currentTime + LOOKAHEAD_SECONDS;
      const ticks = engineRef.current.tick(scheduleUntil);

      for (const tick of ticks) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = tick.isAccent ? ACCENT_FREQUENCY : CLICK_FREQUENCY;
        gain.gain.setValueAtTime(engineRef.current.getState().volume, tick.time);
        gain.gain.exponentialRampToValueAtTime(0.0001, tick.time + CLICK_DURATION_SECONDS);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(tick.time);
        oscillator.stop(tick.time + CLICK_DURATION_SECONDS);

        if (tick.isBeat) {
          const delayMs = Math.max(0, (tick.time - audioContext.currentTime) * 1000);
          setTimeout(() => setCurrentBeat(tick.beatIndex), delayMs);
        }
      }
    }, SCHEDULER_INTERVAL_MS);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    state,
    isRunning,
    currentBeat,
    start,
    stop,
    setBpm: (bpm) => updateState({ bpm }),
    setBeatsPerBar: (beatsPerBar) => updateState({ timeSignature: { beatsPerBar } }),
    setSubdivision: (subdivision) => updateState({ subdivision }),
    setAccentFirstBeat: (accentFirstBeat) => updateState({ accentFirstBeat }),
  };
}
