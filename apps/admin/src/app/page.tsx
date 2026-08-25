'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from '../ui/components';
import { useAuth } from '../state/auth-context';

export default function RootPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  return <LoadingState />;
}
