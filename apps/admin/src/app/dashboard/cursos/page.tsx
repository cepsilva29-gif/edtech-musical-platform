'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { CourseLevel } from 'shared';
import { coursesApi, instrumentsApi } from '../../../services/api';
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

const LEVELS: CourseLevel[] = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'];

export default function CursosPage() {
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ['courses-admin'],
    queryFn: () => coursesApi.list({ limit: 100 }),
  });
  const instrumentsQuery = useQuery({
    queryKey: ['instruments-for-select'],
    queryFn: () => instrumentsApi.list({ limit: 100 }),
  });

  const [title, setTitle] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [level, setLevel] = useState<CourseLevel>('INICIANTE');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await coursesApi.create({ title, instrumentId, level });
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['courses-admin'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel criar o curso.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageTitle>Cursos</PageTitle>

      <Card className="mt-4 max-w-md">
        <p className="mb-2 text-sm font-semibold text-slate-800">Novo curso</p>
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
        <Field label="Nivel">
          <Select value={level} onChange={(event) => setLevel(event.target.value as CourseLevel)}>
            {LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <ErrorText message={error} />
        <Button onClick={onCreate} disabled={creating || !title || !instrumentId}>
          Criar
        </Button>
      </Card>

      <div className="mt-6">
        {coursesQuery.isLoading ? (
          <LoadingState />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Titulo</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Instrumento</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Nivel</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coursesQuery.data?.items.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/cursos/${course.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{course.instrument.name}</td>
                  <td className="px-4 py-2 text-slate-600">{course.level}</td>
                  <td className="px-4 py-2">
                    <Badge tone={course.status === 'PUBLISHED' ? 'green' : 'amber'}>
                      {course.status}
                    </Badge>
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
