import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

function createContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createReflector(requiredRoles: string[] | undefined): Reflector {
  return { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows access when the route has no @Roles() requirement', () => {
    const guard = new RolesGuard(createReflector(undefined));

    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('denies access when the user is missing the required role', () => {
    const guard = new RolesGuard(createReflector(['admin']));
    const user: AuthenticatedUser = { id: '1', email: 'aluno@example.com', roles: ['student'] };

    expect(guard.canActivate(createContext(user))).toBe(false);
  });

  it('denies access when there is no authenticated user on the request', () => {
    const guard = new RolesGuard(createReflector(['admin']));

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('allows access when the user has one of the required roles', () => {
    const guard = new RolesGuard(createReflector(['admin', 'teacher']));
    const user: AuthenticatedUser = { id: '1', email: 'prof@example.com', roles: ['teacher'] };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });
});
