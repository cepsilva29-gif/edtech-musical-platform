import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList } from 'react-native';
import { liveSessionsApi } from '../../../src/services/api';
import { Card, LoadingState, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada',
  LIVE: 'Ao vivo agora',
  FINISHED: 'Encerrada',
  CANCELED: 'Cancelada',
};

export default function LivesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['live-sessions'],
    queryFn: () => liveSessionsApi.list({ limit: 50 }),
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={<Title>Lives</Title>}
        ListEmptyComponent={<Muted>Nenhuma live agendada.</Muted>}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(app)/lives/${item.id}`)}>
            <Subtitle>{item.title}</Subtitle>
            <Muted>
              {STATUS_LABEL[item.status] ?? item.status} -{' '}
              {new Date(item.scheduledAt).toLocaleString('pt-BR')}
            </Muted>
          </Card>
        )}
      />
    </Screen>
  );
}
