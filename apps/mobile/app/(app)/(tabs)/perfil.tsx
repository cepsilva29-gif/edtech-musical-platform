import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { accessApi } from '../../../src/services/api';
import {
  Button,
  Card,
  LoadingState,
  Muted,
  Screen,
  Subtitle,
  Title,
} from '../../../src/ui/components';
import { useAuth } from '../../../src/state/auth-context';

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const accessQuery = useQuery({ queryKey: ['access-me'], queryFn: accessApi.me });

  if (!user) {
    return <LoadingState />;
  }

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <Screen>
      <Title>{user.name}</Title>
      <Muted>{user.email}</Muted>

      <Card>
        <Subtitle>Papeis</Subtitle>
        <Muted>{user.roles.join(', ')}</Muted>
      </Card>

      <Card>
        <Subtitle>Assinatura</Subtitle>
        {accessQuery.isLoading ? (
          <Muted>Carregando...</Muted>
        ) : (
          <Muted>
            {accessQuery.data?.hasActiveEntitlement
              ? 'Assinatura ativa - acesso liberado ao conteudo premium.'
              : 'Sem assinatura ativa.'}
          </Muted>
        )}
      </Card>

      <Button title="Sair" variant="danger" onPress={onLogout} />
    </Screen>
  );
}
