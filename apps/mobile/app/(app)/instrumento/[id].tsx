import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList } from 'react-native';
import { catalogApi } from '../../../src/services/api';
import { Card, LoadingState, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

export default function InstrumentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const instrumentQuery = useQuery({
    queryKey: ['instrument', id],
    queryFn: () => catalogApi.getInstrument(id),
  });

  const coursesQuery = useQuery({
    queryKey: ['courses', { instrumentId: id }],
    queryFn: () => catalogApi.listCourses({ instrumentId: id, limit: 50 }),
  });

  if (instrumentQuery.isLoading || coursesQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={coursesQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            <Title>{instrumentQuery.data?.name}</Title>
            {instrumentQuery.data?.description ? (
              <Muted>{instrumentQuery.data.description}</Muted>
            ) : null}
            <Subtitle>Cursos</Subtitle>
          </>
        }
        ListEmptyComponent={<Muted>Nenhum curso publicado ainda.</Muted>}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(app)/curso/${item.id}`)}>
            <Subtitle>{item.title}</Subtitle>
            <Muted>Nivel: {item.level}</Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
