import { randomUUID } from 'node:crypto';
import type {
  AuthResult,
  CheckoutResult,
  Course,
  CourseModule,
  CurrentSubscription,
  Lesson,
  LessonPlaybackUrl,
  PaginatedResult,
  SubscriptionPlan,
} from 'shared';
import { apiRequest, apiRequestRaw } from './api-client';

/**
 * Os 8 fluxos principais da plataforma (docs/00-primeira-entrega.md, secao 14): cadastro -> login
 * -> assinatura -> acesso ao curso -> reproducao -> progresso -> conclusao -> cancelamento. Roda
 * inteiramente por HTTP contra um `apps/api` real (ver README deste pacote para como subir um) -
 * nao importa nada de `apps/api/src`, so os contratos publicos de `packages/shared`.
 *
 * Depende dos dados do seed (`npm run prisma:seed` em apps/api - ver `apps/api/prisma/seed.ts`):
 * o plano "[DEV] Plano Mensal" e o curso "[DEV] Violão para iniciantes" (com aulas com video
 * associado). O ALUNO usado aqui e sempre um novo cadastro com e-mail aleatorio - nao o
 * aluno.dev@example.com do seed, que ja nasce com assinatura ACTIVE (o seed existe para dar dados
 * de catalogo a explorar manualmente, nao para servir de fixture "em branco" a estes testes).
 */

const SEEDED_PLAN_NAME = '[DEV] Plano Mensal';
const SEEDED_COURSE_SLUG = 'violao-para-iniciantes';

describe('Fluxo completo do aluno (E2E cross-app)', () => {
  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'SenhaForte123';

  let accessToken: string;
  let planId: string;
  let lessonId: string;
  let lessonDurationSeconds: number;

  it('1. cadastro: registra um novo aluno e ja recebe um par de tokens', async () => {
    const result = await apiRequest<AuthResult>('/auth/register', {
      method: 'POST',
      body: { name: 'Aluno E2E', email, password },
    });

    expect(result.user.roles).toEqual(['student']);
    accessToken = result.accessToken;
  });

  it('2. login: autentica de novo com as mesmas credenciais', async () => {
    const result = await apiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    expect(result.user.email).toBe(email);
    accessToken = result.accessToken;
  });

  it('3. assinatura: assina o plano publicado pelo seed (aprovacao instantanea via gateway fake)', async () => {
    const plans = await apiRequest<PaginatedResult<SubscriptionPlan>>('/subscription-plans', {
      accessToken,
    });
    const plan = plans.items.find((item) => item.name === SEEDED_PLAN_NAME);
    if (!plan) {
      throw new Error(
        `Plano seedado "${SEEDED_PLAN_NAME}" nao encontrado - rode "npm run prisma:seed" em apps/api antes deste teste.`,
      );
    }
    planId = plan.id;

    const checkout = await apiRequest<CheckoutResult>('/subscriptions/checkout', {
      method: 'POST',
      accessToken,
      body: { planId },
    });
    expect(checkout.subscriptionId).toEqual(expect.any(String));

    const mine = await apiRequest<CurrentSubscription>('/subscriptions/me', { accessToken });
    expect(mine?.status).toBe('ACTIVE');
  });

  it('4. acesso ao curso: navega instrumento -> curso -> modulo -> aula do exemplo do seed', async () => {
    const course = await apiRequest<Course>(`/courses/slug/${SEEDED_COURSE_SLUG}`, { accessToken });
    expect(course.status).toBe('PUBLISHED');

    const modules = await apiRequest<PaginatedResult<CourseModule>>(
      `/courses/${course.id}/modules`,
      { accessToken },
    );
    expect(modules.items.length).toBeGreaterThan(0);

    const lessons = await apiRequest<PaginatedResult<Lesson>>(
      `/modules/${modules.items[0].id}/lessons`,
      { accessToken },
    );
    expect(lessons.items.length).toBeGreaterThan(0);

    lessonId = lessons.items[0].id;
    lessonDurationSeconds = lessons.items[0].durationSeconds;
  });

  it('5. reproducao: resolve a URL de playback da aula (exige a assinatura do passo 3)', async () => {
    const playback = await apiRequest<LessonPlaybackUrl>(`/lessons/${lessonId}/playback`, {
      accessToken,
    });
    expect(playback.url).toEqual(expect.any(String));
  });

  it('6. progresso: reporta segundos assistidos, refletidos na consulta de progresso', async () => {
    const watchedSeconds = Math.floor(lessonDurationSeconds * 0.5);
    await apiRequest(`/lessons/${lessonId}/progress`, {
      method: 'PUT',
      accessToken,
      body: { watchedSeconds, lastPositionSeconds: watchedSeconds },
    });

    const progress = await apiRequest<{ watchedSeconds: number; isCompleted: boolean }>(
      `/lessons/${lessonId}/progress`,
      { accessToken },
    );
    expect(progress.watchedSeconds).toBe(watchedSeconds);
    expect(progress.isCompleted).toBe(false);
  });

  it('7. conclusao: marca a aula como concluida explicitamente', async () => {
    const completed = await apiRequest<{ isCompleted: boolean; completedAt: string | null }>(
      `/lessons/${lessonId}/progress/complete`,
      { method: 'POST', accessToken },
    );
    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toEqual(expect.any(String));
  });

  it('8. cancelamento: cancela a assinatura e perde acesso a reproducao', async () => {
    const cancel = await apiRequest<{ requested: true }>('/subscriptions/cancel', {
      method: 'POST',
      accessToken,
    });
    expect(cancel.requested).toBe(true);

    const mine = await apiRequest<CurrentSubscription>('/subscriptions/me', { accessToken });
    expect(mine?.status).toBe('CANCELED');

    const blockedPlayback = await apiRequestRaw(`/lessons/${lessonId}/playback`, { accessToken });
    expect(blockedPlayback.status).toBe(403);
  });
});
