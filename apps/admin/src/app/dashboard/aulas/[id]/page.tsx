'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { MaterialType, PublishStatus } from 'shared';
import { HlsVideo } from '../../../../features/player/hls-video';
import { lessonMaterialsApi, lessonsApi, playbackApi } from '../../../../services/api';
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
  Textarea,
} from '../../../../ui/components';

const STATUS_OPTIONS: PublishStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const MATERIAL_TYPES: MaterialType[] = ['PDF', 'CIFRA', 'PARTITURA', 'EXERCICIO'];

export default function AulaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const lessonQuery = useQuery({
    queryKey: ['lesson-admin', id],
    queryFn: () => lessonsApi.get(id),
  });
  const materialsQuery = useQuery({
    queryKey: ['lesson-materials-admin', id],
    queryFn: () => lessonMaterialsApi.list(id),
  });
  const playbackQuery = useQuery({
    queryKey: ['lesson-playback-admin', id],
    queryFn: () => playbackApi.getLessonPlaybackUrl(id),
    enabled: !!lessonQuery.data?.videoRef,
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoProvider, setVideoProvider] = useState('');
  const [videoRef, setVideoRef] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [status, setStatus] = useState<PublishStatus>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inicializa os campos editaveis a partir da aula carregada (uma vez por id), ajustando o
  // estado durante a renderizacao em vez de useEffect - mesmo padrao de
  // usuarios/[id]/page.tsx, evita o re-render em cascata do set-state-in-effect.
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  if (lessonQuery.data && initializedFor !== lessonQuery.data.id) {
    setInitializedFor(lessonQuery.data.id);
    setTitle(lessonQuery.data.title);
    setDescription(lessonQuery.data.description ?? '');
    setVideoProvider(lessonQuery.data.videoProvider ?? '');
    setVideoRef(lessonQuery.data.videoRef ?? '');
    setDurationSeconds(lessonQuery.data.durationSeconds);
    setStatus(lessonQuery.data.status);
  }

  const onSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await lessonsApi.update(id, {
        title,
        description: description || undefined,
        videoProvider: videoProvider || undefined,
        videoRef: videoRef || undefined,
        durationSeconds,
        status,
      });
      void queryClient.invalidateQueries({ queryKey: ['lesson-admin', id] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (lessonQuery.isLoading || !lessonQuery.data) {
    return <LoadingState />;
  }

  return (
    <div className="max-w-2xl">
      <PageTitle>{lessonQuery.data.title}</PageTitle>

      <Card className="mt-4">
        <Field label="Titulo">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Descricao">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provedor de video">
            <Input
              value={videoProvider}
              onChange={(event) => setVideoProvider(event.target.value)}
              placeholder="mux, aws-ivs, youtube..."
            />
          </Field>
          <Field label="Referencia do video">
            <Input value={videoRef} onChange={(event) => setVideoRef(event.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duracao (segundos)">
            <Input
              type="number"
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Number(event.target.value))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as PublishStatus)}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <ErrorText message={error} />
        <Button onClick={onSave} disabled={saving}>
          Salvar
        </Button>
      </Card>

      {lessonQuery.data.videoRef && (
        <>
          <SectionTitle>Preview do video</SectionTitle>
          {playbackQuery.data ? (
            <HlsVideo src={playbackQuery.data.url} className="mt-2 w-full rounded-lg bg-black" />
          ) : playbackQuery.isError ? (
            <ErrorText
              message={
                playbackQuery.error instanceof ApiError
                  ? playbackQuery.error.message
                  : 'Video indisponivel.'
              }
            />
          ) : (
            <LoadingState />
          )}
        </>
      )}

      <SectionTitle>Materiais</SectionTitle>
      <MaterialsManager lessonId={id} materials={materialsQuery.data?.items ?? []} />
    </div>
  );
}

function MaterialsManager({
  lessonId,
  materials,
}: {
  lessonId: string;
  materials: { id: string; type: MaterialType; title: string; storageKey: string }[];
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MaterialType>('PDF');
  const [title, setTitle] = useState('');
  const [storageKey, setStorageKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['lesson-materials-admin', lessonId] });

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      await lessonMaterialsApi.create(lessonId, { type, title, storageKey });
      setTitle('');
      setStorageKey('');
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel adicionar o material.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (materialId: string) => {
    setBusy(true);
    try {
      await lessonMaterialsApi.remove(materialId);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel excluir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-2">
      <ul className="flex flex-col gap-1">
        {materials.map((material) => (
          <li key={material.id} className="flex items-center justify-between text-sm">
            <span>
              <Badge>{material.type}</Badge> {material.title}{' '}
              <span className="text-slate-400">({material.storageKey})</span>
            </span>
            <Button variant="danger" onClick={() => onDelete(material.id)} disabled={busy}>
              Excluir
            </Button>
          </li>
        ))}
        {materials.length === 0 && <p className="text-xs text-slate-400">Nenhum material ainda.</p>}
      </ul>

      <div className="mt-3 grid grid-cols-4 items-end gap-2">
        <Select value={type} onChange={(event) => setType(event.target.value as MaterialType)}>
          {MATERIAL_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Titulo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          placeholder="storage key"
          value={storageKey}
          onChange={(event) => setStorageKey(event.target.value)}
        />
        <Button onClick={onCreate} disabled={busy || !title || !storageKey}>
          Adicionar
        </Button>
      </div>
      <ErrorText message={error} />
    </Card>
  );
}
