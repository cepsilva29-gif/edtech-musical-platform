import { router } from 'expo-router';
import { Card, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

export default function FerramentasScreen() {
  return (
    <Screen>
      <Title>Ferramentas</Title>
      <Card onPress={() => router.push('/(app)/ferramentas/metronomo')}>
        <Subtitle>Metronomo</Subtitle>
        <Muted>40-240 bpm, compasso e subdivisao configuraveis.</Muted>
      </Card>
      <Card onPress={() => router.push('/(app)/ferramentas/afinador')}>
        <Subtitle>Afinador</Subtitle>
        <Muted>Deteccao de pitch pelo microfone (afinacao padrao de violao/guitarra).</Muted>
      </Card>
    </Screen>
  );
}
