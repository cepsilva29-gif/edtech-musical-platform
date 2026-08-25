import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { VideoView } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';
import { catalogApi, playbackApi } from '../../../src/services/api';
import { ApiError } from '../../../src/services/api-client';
import { useLessonPlayer } from '../../../src/features/player/use-lesson-player';
import { Button, LoadingState, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

export default function AulaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const lessonQuery = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => catalogApi.getLesson(id),
  });

  const playbackQuery = useQuery({
    queryKey: ['lesson-playback', id],
    queryFn: () => playbackApi.getLessonPlaybackUrl(id),
    enabled: !!lessonQuery.data?.videoRef,
  });

  const materialsQuery = useQuery({
    queryKey: ['lesson-materials', id],
    queryFn: () => catalogApi.listLessonMaterials(id),
  });

  const player = useLessonPlayer(id, playbackQuery.data?.url ?? null);

  if (lessonQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <Screen>
      <Title>{lessonQuery.data?.title}</Title>
      {lessonQuery.data?.description ? <Muted>{lessonQuery.data.description}</Muted> : null}

      {!lessonQuery.data?.videoRef && <Muted>Esta aula ainda nao tem video associado.</Muted>}

      {lessonQuery.data?.videoRef && playbackQuery.isError && (
        <Muted>
          {playbackQuery.error instanceof ApiError
            ? playbackQuery.error.message
            : 'Nao foi possivel carregar o video.'}
        </Muted>
      )}

      {playbackQuery.data && (
        <View>
          <VideoView
            style={styles.video}
            player={player.playerRef}
            fullscreenOptions={{ enable: true }}
            nativeControls={false}
          />

          <View style={styles.controlsRow}>
            <Button
              title={player.isPlaying ? 'Pausar' : 'Tocar'}
              onPress={() => (player.isPlaying ? player.pause() : player.play())}
            />
          </View>

          <View style={styles.controlsRow}>
            <Button title="Marcar A" onPress={player.markLoopA} variant="secondary" />
            <Button title="Marcar B" onPress={player.markLoopB} variant="secondary" />
            <Button title="Limpar loop" onPress={player.clearLoopAB} variant="secondary" />
          </View>
          {player.loopActive && <Muted>Loop A-B ativo - repete entre os pontos marcados.</Muted>}

          <Text style={styles.time}>
            {Math.floor(player.currentTime)}s / {Math.floor(player.duration)}s
          </Text>
        </View>
      )}

      {materialsQuery.data && materialsQuery.data.items.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Subtitle>Materiais</Subtitle>
          {materialsQuery.data.items.map((material) => (
            <View key={material.id} style={styles.materialRow}>
              <Text>
                {material.type} - {material.title}
              </Text>
            </View>
          ))}
        </View>
      )}
      {materialsQuery.isError && materialsQuery.error instanceof ApiError && (
        <Muted>{materialsQuery.error.message}</Muted>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8 },
  controlsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  time: { marginTop: 6, color: '#334155' },
  materialRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
});
