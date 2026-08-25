import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Subclasse fina do ThrottlerGuard padrao que so desativa o rate limiting quando
 * NODE_ENV=test - achado real da FASE 13/14 CI: os testes de integracao (test/*.e2e-spec.ts)
 * registram varios usuarios por arquivo, estourando o throttle de POST /auth/register (5/60s,
 * limite deliberado de seguranca da FASE 3) bem antes dos 60s. `Test.createTestingModule(...)
 * .overrideGuard(ThrottlerGuard)` (tentativa anterior, ver historico) nao teve efeito - a causa
 * exata nao foi isolada, mas o resultado (throttle continuou ativo nos testes) foi confirmado via
 * CI real. Esta subclasse resolve de forma deterministica, sem depender de mecanica de override de
 * testing do NestJS: em qualquer ambiente que NAO seja `test`, o comportamento e identico ao
 * ThrottlerGuard original (dev/staging/producao continuam protegidos).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
