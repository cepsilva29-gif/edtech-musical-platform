import { CanActivate, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

const noopGuard: CanActivate = { canActivate: () => true };

/**
 * Bootstrap de teste que espelha os pipes/filtros/interceptor globais de `src/main.ts` (mesmo
 * envelope de resposta `{success,data|error}`, mesma validacao de DTO) - so omite helmet/CORS/
 * Swagger, que nao afetam o comportamento testado aqui. Os guards globais Jwt/Roles vem do proprio
 * `AppModule` (registrados via `APP_GUARD`) sem alteracao - so o `ThrottlerGuard` e substituido por
 * um no-op.
 *
 * `ThrottlerGuard` desativado de proposito (achado real: primeira execucao do CI estourou o
 * throttle de `POST /auth/register`, 5/60s - cada arquivo de teste registra varios usuarios por
 * `it()`, o que o limite de producao nunca foi desenhado para suportar). O limite em si ja e
 * uma regra de seguranca deliberada e nao e o que estes testes de integracao existem para
 * verificar - eles testam o comportamento das rotas, nao o throttler (uma dependencia de
 * terceiros). Ver decisao correspondente em docs/ARCHITECTURE.md.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue(noopGuard)
    .compile();
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
