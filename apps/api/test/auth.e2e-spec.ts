import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './utils/reset-database';
import { createTestApp } from './utils/test-app';

describe('Auth (integration)', () => {
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

  it('registers a new student, issuing a token pair and the "student" role', async () => {
    const response = await request(server()).post('/api/v1/auth/register').send({
      name: 'Maria Teste',
      email: 'maria@example.com',
      password: 'SenhaForte123',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: 'maria@example.com',
      roles: ['student'],
    });
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects registering the same e-mail twice with a 409', async () => {
    const payload = { name: 'Maria', email: 'duplicada@example.com', password: 'SenhaForte123' };
    await request(server()).post('/api/v1/auth/register').send(payload).expect(201);

    const response = await request(server()).post('/api/v1/auth/register').send(payload);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('rejects a weak password before hitting the database (whitelist validation)', async () => {
    const response = await request(server()).post('/api/v1/auth/register').send({
      name: 'Maria',
      email: 'fraca@example.com',
      password: 'semnumero',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('logs in with correct credentials and rejects an incorrect password', async () => {
    await request(server())
      .post('/api/v1/auth/register')
      .send({ name: 'Joao', email: 'joao@example.com', password: 'SenhaForte123' })
      .expect(201);

    const loginOk = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'joao@example.com', password: 'SenhaForte123' });
    expect(loginOk.status).toBe(200);
    expect(loginOk.body.data.accessToken).toEqual(expect.any(String));

    const loginWrong = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'joao@example.com', password: 'senha-errada-123' });
    expect(loginWrong.status).toBe(401);
    expect(loginWrong.body.success).toBe(false);
  });

  it('rotates the refresh token: the old token stops working after a refresh', async () => {
    const register = await request(server())
      .post('/api/v1/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'SenhaForte123' });
    const originalRefreshToken = register.body.data.refreshToken as string;

    const refreshed = await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(originalRefreshToken);

    const reuseOldToken = await request(server())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(reuseOldToken.status).toBe(401);
  });

  it('logout revokes the refresh token, blocking further refreshes', async () => {
    const register = await request(server())
      .post('/api/v1/auth/register')
      .send({ name: 'Pedro', email: 'pedro@example.com', password: 'SenhaForte123' });
    const refreshToken = register.body.data.refreshToken as string;

    await request(server()).post('/api/v1/auth/logout').send({ refreshToken }).expect(200);

    const afterLogout = await request(server()).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('requires a Bearer token for protected routes and accepts a valid one', async () => {
    const register = await request(server())
      .post('/api/v1/auth/register')
      .send({ name: 'Clara', email: 'clara@example.com', password: 'SenhaForte123' });
    const { accessToken } = register.body.data;

    const withoutToken = await request(server()).get('/api/v1/users/me');
    expect(withoutToken.status).toBe(401);

    const withToken = await request(server())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(withToken.status).toBe(200);
    expect(withToken.body.data.email).toBe('clara@example.com');
  });
});
