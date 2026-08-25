'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { usersApi } from '../../../services/api';
import { Badge, Input, LoadingState, PageTitle, Table } from '../../../ui/components';

export default function UsuariosPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search }],
    queryFn: () => usersApi.list({ limit: 50, search: search || undefined }),
  });

  return (
    <div>
      <PageTitle>Usuarios</PageTitle>
      <div className="mt-4 max-w-sm">
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <LoadingState />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Nome</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">E-mail</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Papeis</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/usuarios/${user.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{user.email}</td>
                  <td className="px-4 py-2">
                    {user.roles.map((role) => (
                      <Badge key={role} tone="slate">
                        {role}
                      </Badge>
                    ))}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      tone={
                        user.status === 'ACTIVE'
                          ? 'green'
                          : user.status === 'BLOCKED'
                            ? 'red'
                            : 'amber'
                      }
                    >
                      {user.status}
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
