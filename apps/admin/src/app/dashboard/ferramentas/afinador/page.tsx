'use client';

import { useTunerWeb } from '../../../../features/tuner/use-tuner-web';
import { Badge, Button, Card, ErrorText, Muted, PageTitle } from '../../../../ui/components';

export default function AfinadorPage() {
  const tuner = useTunerWeb();

  return (
    <div className="max-w-md">
      <PageTitle>Afinador</PageTitle>
      <Muted>
        Deteccao de pitch YIN (packages/music-tools) sobre captura de microfone via getUserMedia.
      </Muted>

      <Card className="mt-4 flex flex-col items-center gap-4 py-10">
        {tuner.listening ? (
          <>
            <p className="text-5xl font-bold text-slate-900">{tuner.note ?? '--'}</p>
            {tuner.hasSignal && tuner.cents !== null ? (
              <>
                <Badge tone={tuner.inTune ? 'green' : 'amber'}>
                  {tuner.inTune ? 'Afinado' : tuner.cents > 0 ? 'Agudo (sharp)' : 'Grave (flat)'}
                </Badge>
                <p className="text-sm text-slate-500">{tuner.cents.toFixed(1)} cents</p>
              </>
            ) : (
              <Muted>Aguardando sinal do microfone...</Muted>
            )}
            <Button variant="danger" onClick={tuner.stop}>
              Parar
            </Button>
          </>
        ) : (
          <Button onClick={() => void tuner.start()}>Iniciar afinador</Button>
        )}
        <ErrorText message={tuner.error} />
      </Card>
    </div>
  );
}
