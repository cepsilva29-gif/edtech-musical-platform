import type { LessonPlaybackUrl } from 'shared';
import { apiRequest } from '../api-client';

export const playbackApi = {
  getLessonPlaybackUrl: (lessonId: string) =>
    apiRequest<LessonPlaybackUrl>(`/lessons/${lessonId}/playback`),
};
