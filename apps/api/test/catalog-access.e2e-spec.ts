import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerStudent, registerWithRoles } from './utils/fixtures';
import { resetDatabase } from './utils/reset-database';
import { createTestApp } from './utils/test-app';

describe('Catalogo: visibilidade e propriedade (integration)', () => {
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

  it('so admin cria instrumentos; aluno recebe 403', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const student = await registerStudent(app);

    const asStudent = await request(server())
      .post('/api/v1/instruments')
      .set(...authHeader(student))
      .send({ name: 'Cordas' });
    expect(asStudent.status).toBe(403);

    const asAdmin = await request(server())
      .post('/api/v1/instruments')
      .set(...authHeader(admin))
      .send({ name: 'Cordas' });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.status).toBe('DRAFT');
  });

  it('um instrumento DRAFT fica invisivel (404) para aluno, mas visivel para admin', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const student = await registerStudent(app);

    const created = await request(server())
      .post('/api/v1/instruments')
      .set(...authHeader(admin))
      .send({ name: 'Bateria' });
    const instrumentId = created.body.data.id as string;

    const studentSees = await request(server())
      .get(`/api/v1/instruments/${instrumentId}`)
      .set(...authHeader(student));
    expect(studentSees.status).toBe(404);

    const adminSees = await request(server())
      .get(`/api/v1/instruments/${instrumentId}`)
      .set(...authHeader(admin));
    expect(adminSees.status).toBe(200);

    await request(server())
      .patch(`/api/v1/instruments/${instrumentId}`)
      .set(...authHeader(admin))
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const studentSeesAfterPublish = await request(server())
      .get(`/api/v1/instruments/${instrumentId}`)
      .set(...authHeader(student));
    expect(studentSeesAfterPublish.status).toBe(200);
  });

  it('professor gerencia a arvore completa (curso -> modulo -> aula) do proprio curso', async () => {
    const admin = await registerWithRoles(app, ['admin']);
    const teacher = await registerWithRoles(app, ['teacher']);
    const otherTeacher = await registerWithRoles(app, ['teacher']);

    const instrument = await request(server())
      .post('/api/v1/instruments')
      .set(...authHeader(admin))
      .send({ name: 'Teclado', status: 'PUBLISHED' });
    const instrumentId = instrument.body.data.id as string;

    const course = await request(server())
      .post('/api/v1/courses')
      .set(...authHeader(teacher))
      .send({ instrumentId, title: 'Piano para iniciantes', level: 'INICIANTE' });
    expect(course.status).toBe(201);
    const courseId = course.body.data.id as string;

    // outro professor (nao dono) nao pode alterar o curso
    const forbiddenUpdate = await request(server())
      .patch(`/api/v1/courses/${courseId}`)
      .set(...authHeader(otherTeacher))
      .send({ title: 'Tentativa invasora' });
    expect(forbiddenUpdate.status).toBe(403);

    const module = await request(server())
      .post(`/api/v1/courses/${courseId}/modules`)
      .set(...authHeader(teacher))
      .send({ title: 'Modulo 1' });
    expect(module.status).toBe(201);
    const moduleId = module.body.data.id as string;

    const lesson = await request(server())
      .post(`/api/v1/modules/${moduleId}/lessons`)
      .set(...authHeader(teacher))
      .send({ title: 'Aula 1', videoProvider: 'fake', videoRef: 'ref-1' });
    expect(lesson.status).toBe(201);

    // curso ainda DRAFT: aluno nao ve nada na listagem publica
    const student = await registerStudent(app);
    const publicList = await request(server())
      .get('/api/v1/courses')
      .set(...authHeader(student));
    expect(publicList.body.data.items).toHaveLength(0);

    // publica curso/modulo/aula em cadeia (visibilidade exige a cadeia toda publicada)
    await request(server())
      .patch(`/api/v1/courses/${courseId}`)
      .set(...authHeader(teacher))
      .send({ status: 'PUBLISHED' })
      .expect(200);
    await request(server())
      .patch(`/api/v1/course-modules/${moduleId}`)
      .set(...authHeader(teacher))
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const listAfterCoursePublish = await request(server())
      .get('/api/v1/courses')
      .set(...authHeader(student));
    expect(listAfterCoursePublish.body.data.items).toHaveLength(1);
  });
});
