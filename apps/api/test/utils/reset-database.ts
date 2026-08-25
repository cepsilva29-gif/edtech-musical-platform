import { PrismaClient } from '@prisma/client';

const ROLE_NAMES = ['student', 'teacher', 'admin'] as const;

// Ordem nao importa (TRUNCATE ... CASCADE resolve FKs), mas listada por area para facilitar leitura.
const TABLES = [
  'audit_logs',
  'notifications',
  'payment_webhook_events',
  'payment_invoices',
  'user_subscriptions',
  'subscription_plans',
  'live_sessions',
  'student_progress',
  'lesson_materials',
  'lessons',
  'modules',
  'courses',
  'instruments',
  'verification_tokens',
  'refresh_tokens',
  'role_permissions',
  'permissions',
  'user_roles',
  'roles',
  'users',
];

/**
 * Apaga todos os dados do banco de `DATABASE_URL` e recria os papeis base (student/teacher/admin),
 * exigidos por `UsersService.create` (decisao original da FASE 3 - registro publico so funciona se
 * a role "student" ja existir). Roda uma vez por arquivo de teste (`beforeEach`/`beforeAll`), nunca
 * dentro de um `it()` isolado.
 *
 * Guarda de seguranca: recusa truncar um banco cujo nome nao termine em "_test" - o unico jeito de
 * rodar `npm run test:integration` apontado para o banco de desenvolvimento por engano seria editar
 * manualmente `.env.test.local` para isso, e mesmo assim esta funcao bloquearia. Ver decisao
 * correspondente em docs/ARCHITECTURE.md (FASE 12).
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!/\/[\w-]*_test(\?[^/]*)?$/.test(databaseUrl)) {
    throw new Error(
      `resetDatabase() recusou truncar um banco cujo nome nao termina em "_test": ${databaseUrl}. ` +
        'Configure DATABASE_URL em apps/api/.env.test.local para um banco descartavel de teste.',
    );
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );

  await prisma.role.createMany({ data: ROLE_NAMES.map((name) => ({ name })) });
}
