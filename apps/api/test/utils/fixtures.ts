import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersService } from '../../src/users/users.service';

export interface RegisteredUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

let counter = 0;

/** Registra um aluno com um e-mail unico por chamada, retornando os tokens ja emitidos. */
export async function registerStudent(
  app: INestApplication,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<RegisteredUser> {
  counter += 1;
  const email = overrides.email ?? `user${counter}@example.com`;
  const password = overrides.password ?? 'SenhaForte123';

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      name: overrides.name ?? `Usuario ${counter}`,
      email,
      password,
    });

  if (response.status !== 201) {
    throw new Error(`Falha ao registrar usuario de teste: ${JSON.stringify(response.body)}`);
  }

  return {
    id: response.body.data.user.id,
    email,
    accessToken: response.body.data.accessToken,
    refreshToken: response.body.data.refreshToken,
  };
}

/**
 * Registra um aluno e imediatamente promove seus papeis via `UsersService.setRoles` (chamado direto
 * no processo de teste, nao via HTTP - nao existe rota de auto-promocao, por design: so um admin ja
 * existente pode promover alguem, ver decisao 40 em docs/ARCHITECTURE.md). O access/refresh token
 * emitido no registro carrega os papeis ANTIGOS (o JWT nao e reemitido); por isso os testes que
 * usam este helper devem logar novamente (`POST /auth/login`) para obter um token com os papeis
 * atualizados, exatamente como um usuario promovido faria em producao.
 */
export async function registerWithRoles(
  app: INestApplication,
  roles: string[],
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<RegisteredUser> {
  const registered = await registerStudent(app, overrides);
  await app.get(UsersService).setRoles(registered.id, roles);

  const password = overrides.password ?? 'SenhaForte123';
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: registered.email, password });

  return {
    id: registered.id,
    email: registered.email,
    accessToken: login.body.data.accessToken,
    refreshToken: login.body.data.refreshToken,
  };
}

export function authHeader(user: RegisteredUser): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}
