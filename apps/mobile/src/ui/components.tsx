import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const Container = scroll ? ScrollView : View;
  return (
    <Container
      style={styles.screen}
      contentContainerStyle={scroll ? styles.scrollContent : undefined}
    >
      {children}
    </Container>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const content = <View style={styles.card}>{children}</View>;
  if (!onPress) {
    return content;
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor="#94A3B8" {...rest} />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) {
    return null;
  }
  return <Text style={styles.error}>{message}</Text>;
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginTop: 8 },
  muted: { fontSize: 13, color: '#64748B' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pressed: { opacity: 0.6 },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: '#E2E8F0' },
  buttonDanger: { backgroundColor: '#DC2626' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  buttonTextSecondary: { color: '#0F172A' },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#334155', marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  error: { color: '#DC2626', fontSize: 13, marginTop: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
