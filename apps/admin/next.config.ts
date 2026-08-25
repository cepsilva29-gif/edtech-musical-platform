import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera .next/standalone (server + so os node_modules de fato usados) - imagem Docker final fica
  // muito menor do que copiar node_modules inteiro (FASE 13, infra/docker/admin.Dockerfile).
  output: 'standalone',
};

export default nextConfig;
