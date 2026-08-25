export interface NoteFrequency {
  note: string;
  frequency: number;
}

/** Afinacao padrao de violao/guitarra (6 cordas), conforme a secao 12 do prompt-mestre. */
export const STANDARD_GUITAR_TUNING: readonly NoteFrequency[] = [
  { note: 'E2', frequency: 82.41 },
  { note: 'A2', frequency: 110.0 },
  { note: 'D3', frequency: 146.83 },
  { note: 'G3', frequency: 196.0 },
  { note: 'B3', frequency: 246.94 },
  { note: 'E4', frequency: 329.63 },
];

/** Tolerancia de "afinado": +-5 cents (secao 12 do prompt-mestre). */
export const TUNE_TOLERANCE_CENTS = 5;

export interface NoteMatch {
  note: string;
  targetFrequency: number;
  /** Desvio em cents: positivo = agudo (sharp), negativo = grave (flat). */
  cents: number;
  inTune: boolean;
}

/** `1200 * log2(f / f_alvo)` - cents de desvio entre uma frequencia medida e uma referencia. */
export function centsDeviation(frequency: number, targetFrequency: number): number {
  return 1200 * Math.log2(frequency / targetFrequency);
}

/**
 * Encontra a nota-alvo mais proxima (menor |cents|) dentro de um conjunto de afinacoes-alvo.
 * Generico o suficiente para outros instrumentos alem do violao/guitarra (a mesma estrategia da
 * secao 6 do prompt-mestre para o catalogo: nao travar a um unico caso).
 */
export function matchNearestNote(
  frequency: number,
  tuning: readonly NoteFrequency[] = STANDARD_GUITAR_TUNING,
): NoteMatch {
  if (tuning.length === 0) {
    throw new RangeError('tuning nao pode ser vazio.');
  }

  let best: NoteMatch | null = null;
  for (const target of tuning) {
    const cents = centsDeviation(frequency, target.frequency);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) {
      best = {
        note: target.note,
        targetFrequency: target.frequency,
        cents,
        inTune: Math.abs(cents) <= TUNE_TOLERANCE_CENTS,
      };
    }
  }

  return best as NoteMatch;
}
