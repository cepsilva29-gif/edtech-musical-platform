import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';
import { liveSessionsApi } from '../../../src/services/api';
import { ApiError } from '../../../src/services/api-client';
import { LoadingState, Muted, Screen, Title } from '../../../src/ui/components';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada',
  LIVE: 'Ao vivo agora',
  FINISHED: 'Encerrada',
  CANCELED: 'Cancelada',
};

export default function LiveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const liveQuery = useQuery({
    queryKey: ['live-session', id],
    queryFn: () => liveSessionsApi.get(id),
  });

  const playbackQuery = useQuery({
    queryKey: ['live-playback', id],
    queryFn: () => liveSessionsApi.getPlaybackUrl(id),
    enabled: liveQuery.data?.status === 'LIVE' || liveQuery.data?.status === 'FINISHED',
    retry: false,
  });

  const player = useVideoPlayer(playbackQuery.data?.url ?? null);

  if (liveQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <Screen>
      <Title>{liveQuery.data?.title}</Title>
      {liveQuery.data && (
        <Muted>
          {STATUS_LABEL[liveQuery.data.status] ?? liveQuery.data.status} -{' '}
          {new Date(liveQuery.data.scheduledAt).toLocaleString('pt-BR')}
        </Muted>
      )}
      {liveQuery.data?.description ? <Muted>{liveQuery.data.description}</Muted> : null}

      {playbackQuery.data && (
        <VideoView
          style={styles.video}
          player={player}
          fullscreenOptions={{ enable: true }}
          nativeControls
        />
      )}

      {playbackQuery.isError && (
        <Muted>
          {playbackQuery.error instanceof ApiError
            ? playbackQuery.error.message
            : 'Video indisponivel no momento.'}
        </Muted>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 8,
    marginTop: 12,
  },
});
