'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CourseModule, PublishStatus } from 'shared';
import { courseModulesApi, coursesApi, lessonsApi } from '../../../../services/api';
import { ApiError } from '../../../../services/api-client';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  LoadingState,
  PageTitle,
  SectionTitle,
  Select,
} from '../../../../ui/components';

const STATUS_OPTIONS: PublishStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

function LessonList({ courseModule }: { courseModule: CourseModule }) {
  const queryClient = useQueryClient();
  const lessonsQuery = useQuery({
    queryKey: ['lessons', courseModule.id],
    queryFn: () => lessonsApi.list(courseModule.id, { limit: 100 }),
  });

  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['lessons', courseModule.id] });

  const onCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      await lessonsApi.create(courseModule.id, { title });
      setTitle('');
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel criar a aula.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ml-4 mt-2 border-l border-slate-200 pl-4">
      {lessonsQuery.isLoading ? (
        <LoadingState />
      ) : (
        <ul className="flex flex-col gap-1">
          {lessonsQuery.data?.items.map((lesson) => (
            <li key={lesson.id} className="flex items-center justify-between text-sm">
              <Link
                href={`/dashboard/aulas/${lesson.id}`}
                className="text-blue-600 hover:underline"
              >
                {lesson.title}
              </Link>
              <Badge tone={lesson.status === 'PUBLISHED' ? 'green' : 'amber'}>
                {lesson.status}
              </Badge>
            </li>
          ))}
          {lessonsQuery.data?.items.length === 0 && <Muted>Nenhuma aula ainda.</Muted>}
        </ul>
      )}
      <div className="mt-2 flex items-end gap-2">
        <Input
          placeholder="Titulo da nova aula"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button onClick={onCreate} disabled={creating || !title}>
          Adicionar
        </Button>
      </div>
      <ErrorText message={error} />
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-400">{children}</p>;
}

function ModuleSection({
  courseModule,
  onChanged,
}: {
  courseModule: CourseModule;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(courseModule.title);
  const [status, setStatus] = useState<PublishStatus>(courseModule.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      await courseModulesApi.update(courseModule.id, { title, status });
      onChanged();
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
      await courseModulesApi.remove(courseModule.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel excluir.');
      setBusy(false);
    }
  };

  return (
    <Card className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs text-slate-400"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="max-w-xs"
        />
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
        <Button onClick={onSave} disabled={busy}>
          Salvar
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={busy}>
          Excluir modulo
        </Button>
      </div>
      <ErrorText message={error} />
      {expanded && <LessonList courseModule={courseModule} />}
    </Card>
  );
}

export default function CursoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const courseQuery = useQuery({ queryKey: ['course', id], queryFn: () => coursesApi.get(id) });
  const modulesQuery = useQuery({
    queryKey: ['course-modules', id],
    queryFn: () => courseModulesApi.list(id, { limit: 100 }),
  });

  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [creatingModule, setCreatingModule] = useState(false);

  const invalidateModules = () =>
    void queryClient.invalidateQueries({ queryKey: ['course-modules', id] });

  const onCreateModule = async () => {
    setModuleError(null);
    setCreatingModule(true);
    try {
      await courseModulesApi.create(id, { title: newModuleTitle });
      setNewModuleTitle('');
      invalidateModules();
    } catch (err) {
      setModuleError(err instanceof ApiError ? err.message : 'Nao foi possivel criar o modulo.');
    } finally {
      setCreatingModule(false);
    }
  };

  if (courseQuery.isLoading || !courseQuery.data) {
    return <LoadingState />;
  }

  return (
    <div className="max-w-3xl">
      <PageTitle>{courseQuery.data.title}</PageTitle>
      <p className="text-sm text-slate-500">
        {courseQuery.data.instrument.name} - {courseQuery.data.level}
      </p>

      <SectionTitle>Modulos e aulas</SectionTitle>
      {modulesQuery.isLoading ? (
        <LoadingState />
      ) : (
        modulesQuery.data?.items.map((courseModule) => (
          <ModuleSection
            key={courseModule.id}
            courseModule={courseModule}
            onChanged={invalidateModules}
          />
        ))
      )}

      <Card className="mt-3">
        <div className="flex items-end gap-2">
          <Field label="Novo modulo">
            <Input
              value={newModuleTitle}
              onChange={(event) => setNewModuleTitle(event.target.value)}
            />
          </Field>
          <Button onClick={onCreateModule} disabled={creatingModule || !newModuleTitle}>
            Adicionar modulo
          </Button>
        </div>
        <ErrorText message={moduleError} />
      </Card>
    </div>
  );
}
