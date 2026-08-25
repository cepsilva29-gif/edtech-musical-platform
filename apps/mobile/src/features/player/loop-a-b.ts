/**
 * Loop A-B (docs/00-primeira-entrega.md, secao 10): inteiramente client-side, nao depende do
 * backend. Marca pointA/pointB em estado local; a cada evento de progresso do player
 * (`timeUpdate` no expo-video), `computeSeekTarget` decide se e hora de voltar para o ponto A.
 * Precisao limitada pela granularidade do evento do player - limite conhecido e aceito, nao bug
 * (mesma ressalva ja documentada para a web na FASE 7/secao 10 do prompt-mestre).
 */
export interface LoopABState {
  pointA: number | null;
  pointB: number | null;
}

export const EMPTY_LOOP_AB: LoopABState = { pointA: null, pointB: null };

export function setPointA(state: LoopABState, time: number): LoopABState {
  // Se B ja existe e A ficaria depois de B, descarta B (loop invalido).
  const pointB = state.pointB !== null && time >= state.pointB ? null : state.pointB;
  return { pointA: time, pointB };
}

export function setPointB(state: LoopABState, time: number): LoopABState {
  if (state.pointA === null || time <= state.pointA) {
    // B precisa vir depois de A; ignora um B invalido em vez de criar um loop quebrado.
    return state;
  }
  return { ...state, pointB: time };
}

export function clearLoop(): LoopABState {
  return EMPTY_LOOP_AB;
}

export function isLoopActive(state: LoopABState): boolean {
  return state.pointA !== null && state.pointB !== null;
}

/** Chamar a cada `timeUpdate`. Retorna o tempo para o qual dar seek, ou null se nao for a hora. */
export function computeSeekTarget(state: LoopABState, currentTime: number): number | null {
  if (state.pointA === null || state.pointB === null) {
    return null;
  }
  return currentTime >= state.pointB ? state.pointA : null;
}
