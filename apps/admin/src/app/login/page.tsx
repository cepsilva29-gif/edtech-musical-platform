'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../services/api-client';
import { useAuth } from '../../state/auth-context';
import { Button, Card, ErrorText, Field, Input, PageTitle } from '../../ui/components';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin.dev@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nao foi possivel entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <PageTitle>Painel administrativo</PageTitle>
        <p className="mb-4 text-sm text-slate-500">Somente professores e administradores.</p>
        <form onSubmit={onSubmit}>
          <Field label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Senha">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
