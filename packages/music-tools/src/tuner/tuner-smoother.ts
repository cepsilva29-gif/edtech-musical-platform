/**
 * Media movel das ultimas N leituras de cents, para evitar "pisca-pisca" da indicacao visual do
 * afinador entre leituras individuais ruidosas (secao 12 do prompt-mestre).
 */
export class TunerSmoother {
  private readonly readings: number[] = [];

  constructor(private readonly windowSize = 5) {
    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new RangeError('windowSize deve ser um inteiro >= 1.');
    }
  }

  /** Adiciona uma leitura e retorna a media movel resultante. */
  push(cents: number): number {
    this.readings.push(cents);
    if (this.readings.length > this.windowSize) {
      this.readings.shift();
    }
    return this.average();
  }

  average(): number {
    if (this.readings.length === 0) {
      return 0;
    }
    return this.readings.reduce((sum, value) => sum + value, 0) / this.readings.length;
  }

  reset(): void {
    this.readings.length = 0;
  }
}
