import accentSound from '../../../assets/sounds/accent.wav';
import clickSound from '../../../assets/sounds/click.wav';
import { useAudioPlayer } from 'expo-audio';
import { MetronomeEngine, type MetronomeState } from 'music-tools';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ponte entre o MetronomeEngine puro (packages/music-tools) e audio de verdade no Expo.
 *
 * LIMITACAO CONHECIDA: o Web Audio API (usado no player web/preview, secao 11 do prompt-mestre)
 * expoe um clock de alta precisao (`AudioContext.currentTime`) que permite agendar cada som com
 * precisao de amostra, independente de quando o timer JS realmente disparou. O Expo/React Native
 * gerenciado nao expoe um equivalente (nenhum `AudioContext` real) - `useAudioPlayer().play()` so
 * pode ser chamado no momento em que o timer JS dispara, sujeito ao jitter normal do event loop
 * (tipicamente alguns ms, podendo piorar sob carga de UI). Por isso ainda seguimos o padrao de
 * "lookahead scheduling" (o timer so decide QUANDO checar, nunca toca o som direto no clock do
 * engine), mas a precisao final do clique depende do timer JS, nao de um clock de audio nativo -
 * limite aceito e documentado, mesmo espirito da granularidade do Loop A-B (secao 10).
 */

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SECONDS = 0.15;

export const DEFAULT_METRONOME_STATE: MetronomeState = {
  bpm: 100,
  timeSignature: { beatsPerBar: 4 },
  subdivision: 1,
  accentFirstBeat: true,
  volume: 1,
};

export interface UseMetronomeResult {
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

export function useMetronome(): UseMetronomeResult {
  const [state, setState] = useState<MetronomeState>(DEFAULT_METRONOME_STATE);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);

  const engineRef = useRef(new MetronomeEngine(DEFAULT_METRONOME_STATE));
  const clickPlayer = useAudioPlayer(clickSound);
  const accentPlayer = useAudioPlayer(accentSound);
  const audioStartRef = useRef(0); // Date.now() (ms) correspondente a engine.start(0)
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
    audioStartRef.current = Date.now();
    engineRef.current.start(0);
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      const audioNow = (Date.now() - audioStartRef.current) / 1000;
      const ticks = engineRef.current.tick(audioNow + LOOKAHEAD_SECONDS);

      for (const tick of ticks) {
        const delayMs = Math.max(0, (tick.time - audioNow) * 1000);
        const player = tick.isAccent ? accentPlayer : clickPlayer;
        setTimeout(() => {
          player.seekTo(0);
          player.play();
        }, delayMs);

        if (tick.isBeat) {
          setTimeout(() => setCurrentBeat(tick.beatIndex), delayMs);
        }
      }
    }, SCHEDULER_INTERVAL_MS);
  }, [accentPlayer, clickPlayer]);

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
