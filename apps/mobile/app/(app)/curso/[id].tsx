import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { catalogApi, progressApi } from '../../../src/services/api';
import { LoadingState, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min` : `${seconds}s`;
}

export default function CursoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const courseQuery = useQuery({
    queryKey: ['course', id],
    queryFn: () => catalogApi.getCourse(id),
  });

  const progressQuery = useQuery({
    queryKey: ['course-progress', id],
    queryFn: () => progressApi.getCourseProgress(id),
  });

  if (courseQuery.isLoading || progressQuery.isLoading) {
    return <LoadingState />;
  }

  const summary = progressQuery.data;

  return (
    <Screen>
      <Title>{courseQuery.data?.title}</Title>
      {courseQuery.data?.description ? <Muted>{courseQuery.data.description}</Muted> : null}

      {summary && summary.totalLessons > 0 ? (
        <View style={styles.progressRow}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${summary.percentComplete}%` }]} />
          </View>
          <Muted>
            {summary.percentComplete}% - {summary.completedLessons}/{summary.totalLessons} aulas
          </Muted>
        </View>
      ) : null}

      {summary?.modules.map((courseModule) => (
        <View key={courseModule.moduleId} style={{ marginTop: 12 }}>
          <Subtitle>{courseModule.title}</Subtitle>
          {courseModule.lessons.map((lesson) => (
            <Pressable
              key={lesson.lessonId}
              onPress={() => router.push(`/(app)/aula/${lesson.lessonId}`)}
              style={({ pressed }) => [styles.lessonRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.lessonCheck}>{lesson.isCompleted ? '✓' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Muted>{formatDuration(lesson.durationSeconds)}</Muted>
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      {summary?.modules.length === 0 ? <Muted>Nenhum modulo publicado ainda.</Muted> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { marginTop: 8, gap: 4 },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: { height: 8, backgroundColor: '#2563EB' },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  lessonCheck: { fontSize: 16, color: '#2563EB', width: 20 },
  lessonTitle: { fontSize: 15, color: '#0F172A', fontWeight: '500' },
});
