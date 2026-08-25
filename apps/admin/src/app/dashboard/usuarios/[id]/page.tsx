'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { UserStatus } from 'shared';
import { usersApi } from '../../../../services/api';
import { ApiError } from '../../../../services/api-client';
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  LoadingState,
  PageTitle,
  Select,
} from '../../../../ui/components';

const ALL_ROLES = ['student', 'teacher', 'admin'];
const ALL_STATUSES: UserStatus[] = ['ACTIVE', 'BLOCKED', 'PENDING_VERIFICATION'];

export default function UsuarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id),
  });

  const [roles, setRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inicializa os campos editaveis a partir do usuario carregado (uma vez por id), ajustando o
  // estado durante a renderizacao em vez de useEffect - evita o re-render em cascata do
  // set-state-in-effect (react-hooks/set-state-in-effect) e continua permitindo que o professor
  // edite os campos livremente depois.
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  if (user && initializedFor !== user.id) {
    setInitializedFor(user.id);
    setRoles(user.roles);
    setStatus(user.status);
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['user', id] });
  };

  const toggleRole = (role: string) => {
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
  };

  const onSaveRoles = async () => {
    setError(null);
    setSaving(true);
    try {
      await usersApi.updateRoles(id, { roles });
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar os papeis.');
    } finally {
      setSaving(false);
    }
  };

  const onSaveStatus = async () => {
    setError(null);
    setSaving(true);
    try {
      await usersApi.updateStatus(id, { status });
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel salvar o status.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return <LoadingState />;
  }

  return (
    <div className="max-w-lg">
      <PageTitle>{user.name}</PageTitle>
      <p className="text-sm text-slate-500">{user.email}</p>

      <Card className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Papeis atuais</p>
        <div className="mb-3 flex gap-1">
          {user.roles.map((role) => (
            <Badge key={role}>{role}</Badge>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}
        </div>
        <Button className="mt-3" onClick={onSaveRoles} disabled={saving}>
          Salvar papeis
        </Button>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Status da conta</p>
        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)}>
            {ALL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant={status === 'BLOCKED' ? 'danger' : 'primary'}
          onClick={onSaveStatus}
          disabled={saving}
        >
          Salvar status
        </Button>
      </Card>

      <ErrorText message={error} />
    </div>
  );
}
