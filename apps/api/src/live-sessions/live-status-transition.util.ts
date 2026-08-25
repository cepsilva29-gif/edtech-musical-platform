import { ConflictException } from '@nestjs/common';
import { LiveStatus } from '@prisma/client';

/**
 * Maquina de estados scheduled -> live -> finished | canceled (secao 9 do prompt-mestre). Nenhuma
 * outra transicao e permitida - em particular, uma live ja live/finished/canceled nao pode ser
 * reaberta ou redirecionada.
 */
const ALLOWED_TRANSITIONS: Record<LiveStatus, LiveStatus[]> = {
  [LiveStatus.SCHEDULED]: [LiveStatus.LIVE, LiveStatus.CANCELED],
  [LiveStatus.LIVE]: [LiveStatus.FINISHED],
  [LiveStatus.FINISHED]: [],
  [LiveStatus.CANCELED]: [],
};

export function isValidLiveStatusTransition(from: LiveStatus, to: LiveStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidLiveStatusTransition(from: LiveStatus, to: LiveStatus): void {
  if (!isValidLiveStatusTransition(from, to)) {
    throw new ConflictException(`Nao e possivel mudar o status da live de ${from} para ${to}.`);
  }
}
