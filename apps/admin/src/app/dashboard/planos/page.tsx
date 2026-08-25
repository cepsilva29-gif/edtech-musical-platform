'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PublishStatus, SubscriptionPlan } from 'shared';
import { subscriptionPlansApi } from '../../../services/api';
import { ApiError } from '../../../services/api-client';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  LoadingState,
  PageTitle,
  Select,
} from '../../../ui/components';

const STATUS_OPTIONS: PublishStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const INTERVALS: Array<'month' | 'year'> = ['month', 'year'];

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function PlanCard({ plan, onSaved }: { plan: SubscriptionPlan; onSaved: () => void }) {
  const [name, setName] = useState(plan.name);
  const [priceCents, setPriceCents] = useState(plan.priceCents);
  const [interval, setInterval] = useState<'month' | 'year'>(plan.interval);
  const [trialDays, setTrialDays] = useState(plan.trialDays);
  const [status, setStatus] = useState<PublishStatus>(plan.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      await subscriptionPlansApi.update(plan.id, { name, priceCents, interval, trialDays, status });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await subscriptionPlansApi.remove(plan.id);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel excluir.');
      setBusy(false);
    }
  };

  return (
    <Card className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nome">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="max-w-xs"
          />
        </Field>
        <Field label="Preco (centavos)">
          <Input
            type="number"
            value={priceCents}
            onChange={(event) => setPriceCents(Number(event.target.value))}
            className="max-w-[140px]"
          />
        </Field>
        <Field label="Intervalo">
          <Select
            value={interval}
            onChange={(event) => setInterval(event.target.value as 'month' | 'year')}
            className="max-w-[120px]"
          >
            {INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dias de trial">
          <Input
            type="number"
            value={trialDays}
            onChange={(event) => setTrialDays(Number(event.target.value))}
            className="max-w-[110px]"
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as PublishStatus)}
            className="max-w-[140px]"
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={onSave} disabled={busy}>
          Salvar
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={busy}>
          Excluir
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        R$ {centsToDisplay(plan.priceCents)}/{plan.interval === 'month' ? 'mes' : 'ano'}
        {plan.gatewayPriceId ? ` - gateway: ${plan.gatewayPriceId}` : ''}
      </p>
      <ErrorText message={error} />
    </Card>
  );
}

export default function PlanosPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans-admin'],
    queryFn: () => subscriptionPlansApi.list({ limit: 100 }),
  });

  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['subscription-plans-admin'] });

  const onCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      await subscriptionPlansApi.create({ name, priceCents, interval });
      setName('');
      setPriceCents(0);
      invalidate();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Nao foi possivel criar o plano.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageTitle>Planos de assinatura</PageTitle>

      <Card className="mt-4 max-w-md">
        <p className="mb-2 text-sm font-semibold text-slate-800">Novo plano</p>
        <Field label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Preco (centavos)">
          <Input
            type="number"
            value={priceCents}
            onChange={(event) => setPriceCents(Number(event.target.value))}
          />
        </Field>
        <Field label="Intervalo">
          <Select
            value={interval}
            onChange={(event) => setInterval(event.target.value as 'month' | 'year')}
          >
            {INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <ErrorText message={createError} />
        <Button onClick={onCreate} disabled={creating || !name || priceCents <= 0}>
          Criar
        </Button>
      </Card>

      <div className="mt-2">
        {isLoading ? (
          <LoadingState />
        ) : (
          data?.items.map((plan) => <PlanCard key={plan.id} plan={plan} onSaved={invalidate} />)
        )}
        {data?.items.length === 0 && <Badge>Nenhum plano cadastrado ainda.</Badge>}
      </div>
    </div>
  );
}
