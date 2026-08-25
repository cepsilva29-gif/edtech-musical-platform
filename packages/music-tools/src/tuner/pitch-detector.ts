export interface PitchDetectionOptions {
  /** Limiar absoluto do YIN para aceitar um lag como candidato (menor = mais exigente). */
  threshold?: number;
  /** RMS minimo do buffer para tentar detectar (sinal fraco demais e ignorado). */
  minRms?: number;
  /** Confianca minima (1 - cmnd[lag]) para aceitar a leitura como valida, nao ambigua. */
  minConfidence?: number;
}

export interface PitchDetectionResult {
  frequency: number;
  /** 0-1: quao "limpa"/periodica foi a leitura segundo o YIN. */
  confidence: number;
}

const DEFAULT_THRESHOLD = 0.15;
const DEFAULT_MIN_RMS = 0.01;
const DEFAULT_MIN_CONFIDENCE = 0.5;

function computeRms(buffer: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / buffer.length);
}

/** Passo 1-2 do YIN: funcao de diferenca quadratica, normalizada pela media cumulativa. */
function cumulativeMeanNormalizedDifference(buffer: Float32Array, maxLag: number): Float32Array {
  const difference = new Float32Array(maxLag);
  for (let lag = 1; lag < maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < maxLag; i += 1) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  const cmnd = new Float32Array(maxLag);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let lag = 1; lag < maxLag; lag += 1) {
    runningSum += difference[lag];
    cmnd[lag] = runningSum === 0 ? 1 : (difference[lag] * lag) / runningSum;
  }

  return cmnd;
}

/** Passo 3 do YIN: primeiro minimo local abaixo do limiar absoluto. -1 se nenhum for encontrado. */
function findAbsoluteThresholdLag(cmnd: Float32Array, threshold: number): number {
  for (let lag = 2; lag < cmnd.length - 1; lag += 1) {
    if (cmnd[lag] < threshold) {
      let bestLag = lag;
      while (bestLag + 1 < cmnd.length && cmnd[bestLag + 1] < cmnd[bestLag]) {
        bestLag += 1;
      }
      return bestLag;
    }
  }
  return -1;
}

/** Passo 4 do YIN: interpolacao parabolica em torno do lag escolhido, para sub-precisao de amostra. */
function parabolicInterpolation(cmnd: Float32Array, lag: number): number {
  if (lag <= 0 || lag >= cmnd.length - 1) {
    return lag;
  }
  const before = cmnd[lag - 1];
  const at = cmnd[lag];
  const after = cmnd[lag + 1];
  const denominator = before + after - 2 * at;
  if (denominator === 0) {
    return lag;
  }
  return lag + (before - after) / (2 * denominator);
}

/**
 * Deteccao de pitch por autocorrelacao (algoritmo YIN), sobre um buffer monofonico ja capturado -
 * nao depende de getUserMedia/Web Audio API, so de um Float32Array (secao 12 do prompt-mestre).
 * Aplica gate de amplitude (RMS minimo) e score de confianca antes de aceitar uma leitura, para
 * evitar "pisca-pisca" com sinal fraco ou ambiguo.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  options: PitchDetectionOptions = {},
): PitchDetectionResult | null {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const minRms = options.minRms ?? DEFAULT_MIN_RMS;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  if (computeRms(buffer) < minRms) {
    return null;
  }

  const maxLag = Math.floor(buffer.length / 2);
  if (maxLag < 2) {
    return null;
  }

  const cmnd = cumulativeMeanNormalizedDifference(buffer, maxLag);
  const lag = findAbsoluteThresholdLag(cmnd, threshold);
  if (lag === -1) {
    return null;
  }

  const confidence = 1 - cmnd[lag];
  if (confidence < minConfidence) {
    return null;
  }

  const interpolatedLag = parabolicInterpolation(cmnd, lag);
  if (interpolatedLag <= 0) {
    return null;
  }

  return { frequency: sampleRate / interpolatedLag, confidence };
}
