import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, Screen, TextField, Title } from '../../src/ui/components';
import { ApiError } from '../../src/services/api-client';
import { useAuth } from '../../src/state/auth-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('aluno.dev@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)/(tabs)/catalogo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>Entrar</Title>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText message={error} />
      <Button
        title={submitting ? 'Entrando...' : 'Entrar'}
        onPress={onSubmit}
        disabled={submitting}
      />
      <View style={{ height: 16 }} />
      <Link href="/(auth)/register">Ainda nao tenho conta</Link>
    </Screen>
  );
}
