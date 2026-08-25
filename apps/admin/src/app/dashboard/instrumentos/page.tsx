'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Instrument, PublishStatus } from 'shared';
import { instrumentsApi } from '../../../services/api';
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
  Table,
} from '../../../ui/components';

const STATUS_OPTIONS: PublishStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

function statusTone(status: PublishStatus) {
  if (status === 'PUBLISHED') return 'green' as const;
  if (status === 'ARCHIVED') return 'slate' as const;
  return 'amber' as const;
}

function InstrumentRow({ instrument, onSaved }: { instrument: Instrument; onSaved: () => void }) {
  const [name, setName] = useState(instrument.name);
  const [status, setStatus] = useState<PublishStatus>(instrument.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      await instrumentsApi.update(instrument.id, { name, status });
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
      await instrumentsApi.remove(instrument.id);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel excluir.');
      setBusy(false);
    }
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </td>
      <td className="px-4 py-2 text-slate-500">{instrument.slug}</td>
      <td className="px-4 py-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value as PublishStatus)}>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={busy}>
            Salvar
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            Excluir
          </Button>
        </div>
        <ErrorText message={error} />
      </td>
    </tr>
  );
}

export default function InstrumentosPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['instruments-admin'],
    queryFn: () => instrumentsApi.list({ limit: 100 }),
  });

  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['instruments-admin'] });

  const onCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      await instrumentsApi.create({ name });
      setName('');
      invalidate();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Nao foi possivel criar.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageTitle>Instrumentos</PageTitle>

      <Card className="mt-4 max-w-md">
        <p className="mb-2 text-sm font-semibold text-slate-800">Novo instrumento</p>
        <Field label="Nome">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Cordas"
          />
        </Field>
        <ErrorText message={createError} />
        <Button onClick={onCreate} disabled={creating || !name}>
          Criar
        </Button>
      </Card>

      <div className="mt-6">
        {isLoading ? (
          <LoadingState />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Nome</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Slug</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">
                  Status <Badge tone={statusTone('PUBLISHED')}>PUBLISHED = visivel a alunos</Badge>
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((instrument) => (
                <InstrumentRow key={instrument.id} instrument={instrument} onSaved={invalidate} />
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
