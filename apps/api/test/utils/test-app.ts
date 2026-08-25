import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * Bootstrap de teste que espelha os pipes/filtros/interceptor globais de `src/main.ts` (mesmo
 * envelope de resposta `{success,data|error}`, mesma validacao de DTO) - so omite helmet/CORS/
 * Swagger, que nao afetam o comportamento testado aqui. Os guards globais (Jwt/Roles/Throttler) ja
 * vem do proprio `AppModule` (registrados via `APP_GUARD`), sem overrides aqui.
 *
 * O rate limiting de `POST /auth/register` (5/60s) fica desativado automaticamente quando
 * `NODE_ENV=test` (ja setado por `test/setup-env.ts`/CI) via `AppThrottlerGuard` - ver
 * `src/common/guards/app-throttler.guard.ts`. `Test.createTestingModule(...).overrideGuard(...)`
 * foi tentado antes e nao teve efeito (achado real via CI); a correcao deterministica ficou no
 * proprio guard, nao no bootstrap de teste.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();
  return app;
}
