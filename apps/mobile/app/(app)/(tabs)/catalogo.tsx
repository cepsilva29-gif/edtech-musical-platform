import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList } from 'react-native';
import { catalogApi } from '../../../src/services/api';
import { Card, LoadingState, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

export default function CatalogoScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['instruments'],
    queryFn: () => catalogApi.listInstruments({ limit: 50 }),
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
        ListHeaderComponent={<Title>Instrumentos</Title>}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(app)/instrumento/${item.id}`)}>
            <Subtitle>{item.name}</Subtitle>
            {item.description ? <Muted>{item.description}</Muted> : null}
          </Card>
        )}
      />
    </Screen>
  );
}
