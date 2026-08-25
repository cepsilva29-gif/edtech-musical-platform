/** Resposta de GET /lessons/:id/playback. */
export interface LessonPlaybackUrl {
  lessonId: string;
  provider: string;
  url: string;
  expiresAt: string;
}
