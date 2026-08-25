import { Redirect, Stack } from 'expo-router';
import { LoadingState } from '../../src/ui/components';
import { useAuth } from '../../src/state/auth-context';

export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="instrumento/[id]" options={{ title: 'Instrumento' }} />
      <Stack.Screen name="curso/[id]" options={{ title: 'Curso' }} />
      <Stack.Screen name="aula/[id]" options={{ title: 'Aula' }} />
      <Stack.Screen name="ferramentas/metronomo" options={{ title: 'Metronomo' }} />
      <Stack.Screen name="ferramentas/afinador" options={{ title: 'Afinador' }} />
      <Stack.Screen name="lives/[id]" options={{ title: 'Live' }} />
    </Stack>
  );
}
