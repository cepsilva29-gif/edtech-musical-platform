import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '../state/providers';

export const metadata: Metadata = {
  title: 'EdTech Musical - Painel administrativo',
  description: 'Painel administrativo/professor da Plataforma EdTech Musical.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
