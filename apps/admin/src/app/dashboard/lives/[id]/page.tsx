'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { HlsVideo } from '../../../../features/player/hls-video';
import { liveSessionsApi } from '../../../../services/api';
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
  Textarea,
} from '../../../../ui/components';

function statusTone(status: string) {
  if (status === 'LIVE') return 'green' as const;
  if (status === 'CANCELED') return 'red' as const;
  if (status === 'FINISHED') return 'slate' as const;
  return 'amber' as const;
}

export default function LiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const liveQuery = useQuery({
    queryKey: ['live-admin', id],
    queryFn: () => liveSessionsApi.get(id),
  });
  const playbackQuery = useQuery({
    queryKey: ['live-playback-admin', id],
    queryFn: () => liveSessionsApi.getPlaybackUrl(id),
    enabled: liveQuery.data?.status === 'LIVE' || liveQuery.data?.status === 'FINISHED',
    retry: false,
  });

  const [title, setTitle] = useState(liveQuery.data?.title ?? '');
  const [description, setDescription] = useState(liveQuery.data?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['live-admin', id] });

  const onSave = async () => {
    setError(null);
    setBusy(true);
    try {
      await liveSessionsApi.update(id, {
        title: title || undefined,
        description: description || undefined,
      });
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar.');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel executar a acao.');
    } finally {
      setBusy(false);
    }
  };

  if (liveQuery.isLoading || !liveQuery.data) {
    return <LoadingState />;
  }

  const live = liveQuery.data;

  return (
    <div className="max-w-2xl">
      <PageTitle>{live.title}</PageTitle>
      <Badge tone={statusTone(live.status)}>{live.status}</Badge>

      <Card className="mt-4">
        <Field label="Titulo">
          <Input value={title || live.title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Descricao">
          <Textarea
            value={description || live.description || ''}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>
        <p className="mb-3 text-xs text-slate-400">
          Agendada para {new Date(live.scheduledAt).toLocaleString('pt-BR')}
        </p>
        <ErrorText message={error} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={busy}>
            Salvar
          </Button>
          {live.status === 'SCHEDULED' && (
            <>
              <Button onClick={() => runAction(() => liveSessionsApi.goLive(id))} disabled={busy}>
                Iniciar (go live)
              </Button>
              <Button
                variant="danger"
                onClick={() => runAction(() => liveSessionsApi.cancel(id))}
                disabled={busy}
              >
                Cancelar
              </Button>
            </>
          )}
          {live.status === 'LIVE' && (
            <Button
              variant="danger"
              onClick={() => runAction(() => liveSessionsApi.end(id))}
              disabled={busy}
            >
              Encerrar
            </Button>
          )}
        </div>
      </Card>

      {(live.status === 'LIVE' || live.status === 'FINISHED') && (
        <>
          <SectionTitle>Preview</SectionTitle>
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
    </div>
  );
}
