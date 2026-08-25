import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * Bootstrap de teste que espelha os pipes/filtros/interceptor globais de `src/main.ts` (mesmo
 * envelope de resposta `{success,data|error}`, mesma validacao de DTO) - so omite helmet/CORS/
 * Swagger, que nao afetam o comportamento testado aqui. Os guards globais (Throttler/Jwt/Roles) ja
 * vem do proprio `AppModule` (registrados via `APP_GUARD`), entao nao precisam ser reaplicados.
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
