import { Test } from '@nestjs/testing';

/**
 * So resolve o grafo de DI (sem conectar no Postgres - Test.compile() nao dispara onModuleInit).
 * Pega erros de "provider nao encontrado"/import faltando entre os modulos novos desta fase.
 */
describe('AppModule (DI wiring smoke test)', () => {
  it('compiles the whole module graph', async () => {
    process.env.PORT = '3000';
    process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/edtech_musical';
    process.env.JWT_SECRET ??= 'smoke-test-secret';
    process.env.JWT_REFRESH_SECRET ??= 'smoke-test-refresh-secret';

    const { AppModule } = await import('./app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
