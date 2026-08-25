import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, Screen, TextField, Title } from '../../src/ui/components';
import { ApiError } from '../../src/services/api-client';
import { useAuth } from '../../src/state/auth-context';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace('/(app)/(tabs)/catalogo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel criar a conta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>Criar conta</Title>
      <TextField label="Nome" value={name} onChangeText={setName} />
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField
        label="Senha (min. 8 caracteres, letra + numero)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <ErrorText message={error} />
      <Button
        title={submitting ? 'Criando...' : 'Criar conta'}
        onPress={onSubmit}
        disabled={submitting}
      />
      <View style={{ height: 16 }} />
      <Link href="/(auth)/login">Ja tenho conta</Link>
    </Screen>
  );
}
