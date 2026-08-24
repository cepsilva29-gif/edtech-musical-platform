import { BadRequestException, NotFoundException } from '@nestjs/common';
import { resolveErrorBody } from './resolve-error-body';

describe('resolveErrorBody', () => {
  it('extracts the message from a simple HttpException', () => {
    const result = resolveErrorBody(new NotFoundException('Curso nao encontrado.'), false);

    expect(result.message).toBe('Curso nao encontrado.');
  });

  it('joins class-validator array messages into a single string', () => {
    const exception = new BadRequestException({
      message: ['email invalido', 'senha muito curta'],
      error: 'Bad Request',
    });

    const result = resolveErrorBody(exception, false);

    expect(result.message).toBe('email invalido; senha muito curta');
    expect(result.code).toBe('Bad Request');
  });

  it('hides internal error details in production', () => {
    const result = resolveErrorBody(new Error('detalhe sensivel do banco'), true);

    expect(result.message).not.toContain('detalhe sensivel');
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('exposes internal error details outside production', () => {
    const result = resolveErrorBody(new Error('detalhe util para debug'), false);

    expect(result.message).toBe('detalhe util para debug');
  });
});
