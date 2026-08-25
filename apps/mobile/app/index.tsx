import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/state/auth-context';

export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Redirect href={status === 'authenticated' ? '/(app)/(tabs)/catalogo' : '/(auth)/login'} />
  );
}
