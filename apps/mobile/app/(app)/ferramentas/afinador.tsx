import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTuner } from '../../../src/features/tuner/use-tuner';
import { Button, ErrorText, Muted, Screen, Title } from '../../../src/ui/components';

export default function AfinadorScreen() {
  const tuner = useTuner();
  const [error, setError] = useState<string | null>(null);

  const onToggle = async () => {
    setError(null);
    if (tuner.listening) {
      tuner.stop();
      return;
    }
    try {
      await tuner.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel acessar o microfone.');
    }
  };

  return (
    <Screen>
      <Title>Afinador</Title>
      <Muted>
        Afinacao padrao de violao/guitarra (E2 A2 D3 G3 B3 E4). Detecta por autocorrelacao (YIN)
        sobre o audio real do microfone - packages/music-tools.
      </Muted>

      <View style={styles.display}>
        <Text style={styles.note}>{tuner.note ?? '--'}</Text>
        {tuner.note && (
          <Text style={[styles.cents, tuner.inTune && styles.centsInTune]}>
            {tuner.cents !== null
              ? `${tuner.cents > 0 ? '+' : ''}${tuner.cents.toFixed(1)} cents`
              : ''}
          </Text>
        )}
        {tuner.listening && !tuner.hasSignal && (
          <Muted>Sinal fraco - toque uma corda perto do microfone.</Muted>
        )}
      </View>

      <ErrorText message={error} />
      <Button
        title={tuner.listening ? 'Parar' : 'Comecar a afinar'}
        onPress={onToggle}
        variant={tuner.listening ? 'danger' : 'primary'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  display: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  note: { fontSize: 56, fontWeight: '700', color: '#0F172A' },
  cents: { fontSize: 20, color: '#DC2626' },
  centsInTune: { color: '#16A34A' },
});
