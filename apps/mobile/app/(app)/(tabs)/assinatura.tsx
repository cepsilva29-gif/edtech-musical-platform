import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { subscriptionsApi } from '../../../src/services/api';
import { ApiError } from '../../../src/services/api-client';
import {
  Button,
  Card,
  ErrorText,
  LoadingState,
  Muted,
  Screen,
  Subtitle,
  Title,
} from '../../../src/ui/components';

function formatPrice(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function AssinaturaScreen() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentQuery = useQuery({
    queryKey: ['subscription-mine'],
    queryFn: subscriptionsApi.mine,
  });
  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionsApi.listPlans({ limit: 20 }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['subscription-mine'] });
  };

  const onCheckout = async (planId: string) => {
    setError(null);
    setBusy(true);
    try {
      await subscriptionsApi.checkout({ planId });
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel iniciar a assinatura.');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setError(null);
    setBusy(true);
    try {
      await subscriptionsApi.cancel();
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel cancelar.');
    } finally {
      setBusy(false);
    }
  };

  if (currentQuery.isLoading || plansQuery.isLoading) {
    return <LoadingState />;
  }

  const current = currentQuery.data;
  const isOpen = current && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(current.status);

  return (
    <Screen>
      <Title>Assinatura</Title>

      {isOpen && current ? (
        <Card>
          <Subtitle>{current.plan.name}</Subtitle>
          <Muted>Status: {current.status}</Muted>
          {current.currentPeriodEnd && (
            <Muted>
              Renova em: {new Date(current.currentPeriodEnd).toLocaleDateString('pt-BR')}
            </Muted>
          )}
          <View style={{ marginTop: 10 }}>
            <Button
              title="Cancelar assinatura"
              variant="danger"
              onPress={onCancel}
              disabled={busy}
            />
          </View>
        </Card>
      ) : (
        <>
          <Muted>Voce ainda nao tem uma assinatura ativa. Escolha um plano:</Muted>
          {plansQuery.data?.items.map((plan) => (
            <Card key={plan.id}>
              <Subtitle>{plan.name}</Subtitle>
              {plan.description ? <Muted>{plan.description}</Muted> : null}
              <Muted>
                {formatPrice(plan.priceCents, plan.currency)} /{' '}
                {plan.interval === 'month' ? 'mes' : 'ano'}
                {plan.trialDays > 0 ? ` - ${plan.trialDays} dias gratis` : ''}
              </Muted>
              <View style={{ marginTop: 10 }}>
                <Button title="Assinar" onPress={() => onCheckout(plan.id)} disabled={busy} />
              </View>
            </Card>
          ))}
        </>
      )}

      <ErrorText message={error} />
    </Screen>
  );
}
