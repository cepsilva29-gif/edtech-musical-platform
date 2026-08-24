import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorBody {
  code: string;
  message: string;
}

/**
 * Extraida do filtro global para ser testavel sem precisar montar o contexto HTTP do Nest.
 */
export function resolveErrorBody(exception: unknown, isProduction: boolean): ErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { code: HttpStatus[status] ?? 'ERROR', message: response };
    }

    const body = response as { message?: string | string[]; error?: string };
    const message = Array.isArray(body.message)
      ? body.message.join('; ')
      : (body.message ?? body.error ?? 'Erro inesperado');

    return { code: body.error ?? HttpStatus[status] ?? 'ERROR', message };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: isProduction
      ? 'Erro interno. Tente novamente mais tarde.'
      : exception instanceof Error
        ? exception.message
        : 'Erro desconhecido',
  };
}
