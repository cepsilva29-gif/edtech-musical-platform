'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../state/auth-context';
import { Button, LoadingState } from '../../ui/components';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/instrumentos', label: 'Instrumentos', adminOnly: true },
  { href: '/dashboard/cursos', label: 'Cursos' },
  { href: '/dashboard/planos', label: 'Planos', adminOnly: true },
  { href: '/dashboard/lives', label: 'Lives' },
  { href: '/dashboard/usuarios', label: 'Usuarios', adminOnly: true },
  { href: '/dashboard/ferramentas/metronomo', label: 'Metronomo' },
  { href: '/dashboard/ferramentas/afinador', label: 'Afinador' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return <LoadingState />;
  }

  const isStaff = user?.roles.some((role) => role === 'admin' || role === 'teacher');
  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">Acesso restrito</p>
          <p className="mt-2 text-sm text-slate-500">
            Este painel e exclusivo para professores e administradores.
          </p>
          <Button className="mt-4" onClick={() => logout().then(() => router.replace('/login'))}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.roles.includes('admin');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4">
        <p className="mb-4 text-sm font-bold text-slate-900">EdTech Musical</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-600">
            {user?.name} - <span className="text-slate-400">{user?.roles.join(', ')}</span>
          </p>
          <Button variant="secondary" onClick={() => logout().then(() => router.replace('/login'))}>
            Sair
          </Button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
