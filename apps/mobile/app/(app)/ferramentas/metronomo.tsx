import { StyleSheet, Text, View } from 'react-native';
import { useMetronome } from '../../../src/features/metronome/use-metronome';
import { Button, Muted, Screen, Subtitle, Title } from '../../../src/ui/components';

const BPM_MIN = 40;
const BPM_MAX = 240;
const BPM_STEP = 5;

export default function MetronomoScreen() {
  const metronome = useMetronome();
  const { state, isRunning, currentBeat } = metronome;

  return (
    <Screen>
      <Title>Metronomo</Title>
      <Muted>
        Precisao do clique depende do timer do dispositivo (sem AudioContext nativo no Expo
        gerenciado) - pode haver alguns ms de variacao. Ver packages/music-tools/README.md.
      </Muted>

      <View style={styles.bpmRow}>
        <Button
          title="-"
          variant="secondary"
          onPress={() => metronome.setBpm(Math.max(BPM_MIN, state.bpm - BPM_STEP))}
        />
        <Text style={styles.bpmValue}>{state.bpm} bpm</Text>
        <Button
          title="+"
          variant="secondary"
          onPress={() => metronome.setBpm(Math.min(BPM_MAX, state.bpm + BPM_STEP))}
        />
      </View>

      <View style={styles.beatsRow}>
        {Array.from({ length: state.timeSignature.beatsPerBar }).map((_, index) => (
          <View
            key={index}
            style={[styles.beatDot, currentBeat === index && isRunning && styles.beatDotActive]}
          />
        ))}
      </View>

      <Subtitle>Compasso</Subtitle>
      <View style={styles.stepperRow}>
        <Button
          title="-"
          variant="secondary"
          onPress={() => metronome.setBeatsPerBar(Math.max(1, state.timeSignature.beatsPerBar - 1))}
        />
        <Text style={styles.stepperValue}>{state.timeSignature.beatsPerBar} tempos</Text>
        <Button
          title="+"
          variant="secondary"
          onPress={() =>
            metronome.setBeatsPerBar(Math.min(12, state.timeSignature.beatsPerBar + 1))
          }
        />
      </View>

      <Subtitle>Subdivisao</Subtitle>
      <View style={styles.stepperRow}>
        <Button
          title="-"
          variant="secondary"
          onPress={() => metronome.setSubdivision(Math.max(1, state.subdivision - 1))}
        />
        <Text style={styles.stepperValue}>{state.subdivision}x por tempo</Text>
        <Button
          title="+"
          variant="secondary"
          onPress={() => metronome.setSubdivision(Math.min(4, state.subdivision + 1))}
        />
      </View>

      <View style={{ marginTop: 8 }}>
        <Button
          title={state.accentFirstBeat ? 'Acento: ligado' : 'Acento: desligado'}
          variant="secondary"
          onPress={() => metronome.setAccentFirstBeat(!state.accentFirstBeat)}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <Button
          title={isRunning ? 'Parar' : 'Iniciar'}
          variant={isRunning ? 'danger' : 'primary'}
          onPress={isRunning ? metronome.stop : metronome.start}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  bpmValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 110,
    textAlign: 'center',
  },
  beatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 16 },
  beatDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E2E8F0' },
  beatDotActive: { backgroundColor: '#2563EB' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  stepperValue: { fontSize: 16, color: '#0F172A', minWidth: 110, textAlign: 'center' },
});
