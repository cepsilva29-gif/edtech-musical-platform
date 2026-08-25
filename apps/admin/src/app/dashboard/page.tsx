'use client';

import Link from 'next/link';
import { useAuth } from '../../state/auth-context';
import { Card, PageTitle } from '../../ui/components';

export default function DashboardHomePage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin');

  return (
    <div>
      <PageTitle>Ola, {user?.name}</PageTitle>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAdmin && (
          <Link href="/dashboard/instrumentos">
            <Card className="hover:border-blue-300">
              <p className="font-semibold text-slate-900">Instrumentos</p>
              <p className="text-sm text-slate-500">Catalogo de instrumentos oferecidos.</p>
            </Card>
          </Link>
        )}
        <Link href="/dashboard/cursos">
          <Card className="hover:border-blue-300">
            <p className="font-semibold text-slate-900">Cursos</p>
            <p className="text-sm text-slate-500">Cursos, modulos, aulas e materiais.</p>
          </Card>
        </Link>
        {isAdmin && (
          <Link href="/dashboard/planos">
            <Card className="hover:border-blue-300">
              <p className="font-semibold text-slate-900">Planos de assinatura</p>
              <p className="text-sm text-slate-500">Precos e periodicidade.</p>
            </Card>
          </Link>
        )}
        <Link href="/dashboard/lives">
          <Card className="hover:border-blue-300">
            <p className="font-semibold text-slate-900">Lives</p>
            <p className="text-sm text-slate-500">Agendar, transmitir e encerrar transmissoes.</p>
          </Card>
        </Link>
        {isAdmin && (
          <Link href="/dashboard/usuarios">
            <Card className="hover:border-blue-300">
              <p className="font-semibold text-slate-900">Usuarios</p>
              <p className="text-sm text-slate-500">Papeis (professor/admin) e bloqueio.</p>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
