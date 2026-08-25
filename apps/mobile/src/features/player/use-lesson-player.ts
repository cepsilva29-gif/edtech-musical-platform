import { useEvent } from 'expo';
import { useVideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { progressApi } from '../../services/api';
import {
  clearLoop,
  computeSeekTarget,
  EMPTY_LOOP_AB,
  isLoopActive,
  type LoopABState,
  setPointA,
  setPointB,
} from './loop-a-b';

const PROGRESS_REPORT_INTERVAL_SECONDS = 10;

export interface UseLessonPlayerResult {
  play: () => void;
  pause: () => void;
  isPlaying: boolean;
  status: VideoPlayerStatus;
  currentTime: number;
  duration: number;
  loopActive: boolean;
  markLoopA: () => void;
  markLoopB: () => void;
  clearLoopAB: () => void;
  playerRef: ReturnType<typeof useVideoPlayer>;
}

/**
 * Player de aula: reproducao (expo-video), loop A-B (client-side, secao 10) e reporte periodico
 * de progresso (FASE 5) - a cada ~10s de reproducao e ao desmontar a tela.
 */
export function useLessonPlayer(lessonId: string, videoUrl: string | null): UseLessonPlayerResult {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.timeUpdateEventInterval = 0.5;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const [loop, setLoop] = useState<LoopABState>(EMPTY_LOOP_AB);
  const lastReportedAtRef = useRef(0);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const target = computeSeekTarget(loop, currentTime);
    if (target !== null) {
      // expo-video: `currentTime` e uma propriedade gravavel do VideoPlayer nativo (handle
      // imperativo, nao estado gerenciado pelo React) - atribuir e a forma documentada de dar
      // seek. eslint-disable-next-line abaixo silencia a regra experimental de imutabilidade do
      // react-hooks (pensada para objetos comuns do React, nao para SharedObject nativo).
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = target;
    }
  }, [currentTime, loop, player]);

  const reportProgress = useCallback(
    (time: number) => {
      progressApi
        .updateLessonProgress(lessonId, {
          watchedSeconds: Math.floor(time),
          lastPositionSeconds: Math.floor(time),
        })
        .catch(() => undefined);
    },
    [lessonId],
  );

  useEffect(() => {
    if (currentTime - lastReportedAtRef.current < PROGRESS_REPORT_INTERVAL_SECONDS) {
      return;
    }
    lastReportedAtRef.current = currentTime;
    reportProgress(currentTime);
  }, [currentTime, reportProgress]);

  useEffect(() => {
    return () => {
      if (currentTimeRef.current > 0) {
        reportProgress(currentTimeRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  return {
    play: () => player.play(),
    pause: () => player.pause(),
    isPlaying,
    status,
    currentTime,
    duration: player.duration,
    loopActive: isLoopActive(loop),
    markLoopA: () => setLoop((s) => setPointA(s, currentTime)),
    markLoopB: () => setLoop((s) => setPointB(s, currentTime)),
    clearLoopAB: () => setLoop(clearLoop()),
    playerRef: player,
  };
}
