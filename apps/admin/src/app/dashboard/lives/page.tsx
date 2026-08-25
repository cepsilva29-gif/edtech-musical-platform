'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { instrumentsApi, liveSessionsApi, usersApi } from '../../../services/api';
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

function statusTone(status: string) {
  if (status === 'LIVE') return 'green' as const;
  if (status === 'CANCELED') return 'red' as const;
  if (status === 'FINISHED') return 'slate' as const;
  return 'amber' as const;
}

export default function LivesPage() {
  const queryClient = useQueryClient();

  const livesQuery = useQuery({
    queryKey: ['live-sessions-admin'],
    queryFn: () => liveSessionsApi.list({ limit: 100 }),
  });
  const instrumentsQuery = useQuery({
    queryKey: ['instruments-for-select'],
    queryFn: () => instrumentsApi.list({ limit: 100 }),
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers-for-select'],
    queryFn: () => usersApi.list({ role: 'teacher', limit: 100 }),
  });

  const [title, setTitle] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await liveSessionsApi.create({
        title,
        instrumentId,
        teacherId: teacherId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setTitle('');
      setScheduledAt('');
      void queryClient.invalidateQueries({ queryKey: ['live-sessions-admin'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel criar a live.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageTitle>Lives</PageTitle>

      <Card className="mt-4 max-w-md">
        <p className="mb-2 text-sm font-semibold text-slate-800">Nova live</p>
        <Field label="Titulo">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Instrumento">
          <Select value={instrumentId} onChange={(event) => setInstrumentId(event.target.value)}>
            <option value="">Selecione...</option>
            {instrumentsQuery.data?.items.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Professor (opcional)">
          <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Nenhum</option>
            {teachersQuery.data?.items.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data/hora agendada">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </Field>
        <ErrorText message={error} />
        <Button onClick={onCreate} disabled={creating || !title || !instrumentId || !scheduledAt}>
          Criar
        </Button>
      </Card>

      <div className="mt-6">
        {livesQuery.isLoading ? (
          <LoadingState />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Titulo</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Agendada para</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {livesQuery.data?.items.map((live) => (
                <tr key={live.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/lives/${live.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {live.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(live.scheduledAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone(live.status)}>{live.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
