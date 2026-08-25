import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  // `credentials: true` fica de fora de proposito: nenhum cliente (apps/admin/apps/mobile) usa
  // cookie para autenticacao (JWT vai no header Authorization - decisoes 8/32/41), entao nao ha
  // credential de fato cruzando origem. Mantido junto de CORS_ORIGIN='*' (default de
  // desenvolvimento) violaria a propria especificacao de CORS (Access-Control-Allow-Credentials
  // nao pode ser combinado com Access-Control-Allow-Origin: *) - achado da auditoria final (FASE
  // 14), corrigido removendo a opcao nao usada em vez de restringir CORS_ORIGIN.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Plataforma EdTech Musical - API')
      .setDescription('Documentacao da API REST (/api/v1). Swagger desabilitado em producao.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
