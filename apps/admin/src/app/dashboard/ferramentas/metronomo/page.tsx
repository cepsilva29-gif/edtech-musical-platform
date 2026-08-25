'use client';

import { useMetronomeWeb } from '../../../../features/metronome/use-metronome-web';
import { Button, Card, Field, Input, Muted, PageTitle } from '../../../../ui/components';

export default function MetronomoPage() {
  const metronome = useMetronomeWeb();

  return (
    <div className="max-w-md">
      <PageTitle>Metronomo</PageTitle>
      <Muted>
        Motor compartilhado com o app mobile (packages/music-tools), agendado via Web Audio API.
      </Muted>

      <Card className="mt-4">
        <Field label={`BPM: ${metronome.state.bpm}`}>
          <Input
            type="range"
            min={40}
            max={240}
            value={metronome.state.bpm}
            onChange={(event) => metronome.setBpm(Number(event.target.value))}
          />
        </Field>

        <Field label="Tempos por compasso">
          <Input
            type="number"
            min={1}
            max={12}
            value={metronome.state.timeSignature.beatsPerBar}
            onChange={(event) => metronome.setBeatsPerBar(Number(event.target.value))}
          />
        </Field>

        <Field label="Subdivisao">
          <Input
            type="number"
            min={1}
            max={4}
            value={metronome.state.subdivision}
            onChange={(event) => metronome.setSubdivision(Number(event.target.value))}
          />
        </Field>

        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={metronome.state.accentFirstBeat}
            onChange={(event) => metronome.setAccentFirstBeat(event.target.checked)}
          />
          Acentuar primeiro tempo
        </label>

        <div className="flex items-center gap-3">
          {metronome.isRunning ? (
            <Button variant="danger" onClick={metronome.stop}>
              Parar
            </Button>
          ) : (
            <Button onClick={metronome.start}>Iniciar</Button>
          )}
          <div className="flex gap-1">
            {Array.from({ length: metronome.state.timeSignature.beatsPerBar }).map((_, index) => (
              <span
                key={index}
                className={`h-4 w-4 rounded-full border ${
                  metronome.currentBeat === index
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 bg-white'
                }`}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
