export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELED';

export interface LiveSession {
  id: string;
  instrumentId: string;
  teacherId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string;
  status: LiveStatus;
  streamProvider: string | null;
  streamRef: string | null;
  playbackUrl: string | null;
  recordingRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLiveSessionRequest {
  instrumentId: string;
  teacherId?: string;
  title: string;
  description?: string;
  scheduledAt: string;
}

export interface UpdateLiveSessionRequest {
  instrumentId?: string;
  teacherId?: string;
  title?: string;
  description?: string;
  scheduledAt?: string;
}

/** Resposta de GET /live-sessions/:id/playback. */
export interface LivePlaybackUrl {
  status: LiveStatus;
  url: string;
  expiresAt: string | null;
}
