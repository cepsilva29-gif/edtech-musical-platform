import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerStudent, registerWithRoles } from './utils/fixtures';
import { resetDatabase } from './utils/reset-database';
import { createTestApp } from './utils/test-app';

describe('Progresso e playback: gate de assinatura + monotonicidade (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  /** Monta instrumento -> curso -> modulo -> aula, tudo PUBLISHED, com video associado. */
  async function createPublishedLesson(adminToken: string, teacherToken: string) {
    const instrument = await request(server())
      .post('/api/v1/instruments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cordas', status: 'PUBLISHED' });

    const course = await request(server())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        instrumentId: instrument.body.data.id,
        title: 'Violao para iniciantes',
        level: 'INICIANTE',
        status: 'PUBLISHED',
      });

    const courseModule = await request(server())
      .post(`/api/v1/courses/${course.body.data.id}/modules`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Modulo 1', status: 'PUBLISHED' });

    const lesson = await request(server())
      .post(`/api/v1/modules/${courseModule.body.data.id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Aula 1',
        videoProvider: 'fake',
        videoRef: 'ref-1',
        durationSeconds: 100,
        status: 'PUBLISHED',
      });

    return lesson.body.data.id as string;
  }

  async function subscribeStudent(adminToken: string, student: { accessToken: string }) {
    const plan = await request(server())
      .post('/api/v1/subscription-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Plano Mensal', priceCents: 4990, interval: 'month', status: 'PUBLISHED' });

    await request(server())
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ planId: plan.body.data.id })
      .expect(200);
  }

  it('bloqueia progresso e playback (403) sem assinatura ativa; libera apos checkout', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const teacher = await registerWithRoles(app, ['teacher']);
    const student = await registerStudent(app);
    const lessonId = await createPublishedLesson(admin.accessToken, teacher.accessToken);

    const blockedProgress = await request(server())
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(...authHeader(student))
      .send({ watchedSeconds: 10, lastPositionSeconds: 10 });
    expect(blockedProgress.status).toBe(403);

    const blockedPlayback = await request(server())
      .get(`/api/v1/lessons/${lessonId}/playback`)
      .set(...authHeader(student));
    expect(blockedPlayback.status).toBe(403);

    await subscribeStudent(admin.accessToken, student);

    const allowedPlayback = await request(server())
      .get(`/api/v1/lessons/${lessonId}/playback`)
      .set(...authHeader(student));
    expect(allowedPlayback.status).toBe(200);
    expect(allowedPlayback.body.data.url).toEqual(expect.any(String));
  });

  it('progresso e monotonico e conclui automaticamente ao atingir 90% do watched', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const teacher = await registerWithRoles(app, ['teacher']);
    const student = await registerStudent(app);
    const lessonId = await createPublishedLesson(admin.accessToken, teacher.accessToken);
    await subscribeStudent(admin.accessToken, student);

    const first = await request(server())
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(...authHeader(student))
      .send({ watchedSeconds: 50, lastPositionSeconds: 50 });
    expect(first.body.data).toMatchObject({ watchedSeconds: 50, isCompleted: false });

    const completing = await request(server())
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(...authHeader(student))
      .send({ watchedSeconds: 95, lastPositionSeconds: 95 });
    expect(completing.body.data).toMatchObject({ watchedSeconds: 95, isCompleted: true });
    expect(completing.body.data.completedAt).not.toBeNull();

    // regressao: reportar um watchedSeconds MENOR nao deve diminuir o valor persistido (metrica
    // monotonica - decisao 19 em docs/ARCHITECTURE.md), embora lastPositionSeconds sempre reflita
    // a ultima posicao reportada (posicao do player, nao progresso cumulativo).
    const regressed = await request(server())
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(...authHeader(student))
      .send({ watchedSeconds: 10, lastPositionSeconds: 10 });
    expect(regressed.body.data).toMatchObject({
      watchedSeconds: 95,
      lastPositionSeconds: 10,
      isCompleted: true,
    });
  });

  it('professor dono e admin acessam progresso/playback sem assinatura (gate ignora quem gerencia)', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const teacher = await registerWithRoles(app, ['teacher']);
    const lessonId = await createPublishedLesson(admin.accessToken, teacher.accessToken);

    const teacherProgress = await request(server())
      .put(`/api/v1/lessons/${lessonId}/progress`)
      .set(...authHeader(teacher))
      .send({ watchedSeconds: 5, lastPositionSeconds: 5 });
    expect(teacherProgress.status).toBe(200);

    const adminPlayback = await request(server())
      .get(`/api/v1/lessons/${lessonId}/playback`)
      .set(...authHeader(admin));
    expect(adminPlayback.status).toBe(200);
  });
});
