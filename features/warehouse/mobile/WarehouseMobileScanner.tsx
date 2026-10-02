'use client';

import {
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  LoaderCircle,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  buildWarehouseMobileScanEvent,
  createWarehouseMobileCooldownGuard,
  expectedWarehouseMobileScanKind,
  normalizeWarehouseMobileScanValue,
  type WarehouseMobileScanEvent,
  type WarehouseMobileScanKind,
  type WarehouseMobileScannerExpectation,
  type WarehouseMobileScanSource,
} from '../../../lib/warehouse/mobileScanner';

type ScannerStatus = 'idle' | 'loading' | 'ready' | 'success' | 'error';

type IdentifyScan = (
  value: string
) => WarehouseMobileScanKind | Promise<WarehouseMobileScanKind>;

export interface WarehouseMobileScannerProps {
  expectation: WarehouseMobileScannerExpectation;
  identifyScan?: IdentifyScan;
  onScanCandidate?: (event: WarehouseMobileScanEvent) => void;
  onValidatedScan?: (event: WarehouseMobileScanEvent) => void;
  cooldownMs?: number;
  title?: string;
}

function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException
    ? error.name
    : (
      typeof error === 'object'
      && error
      && 'name' in error
      && typeof error.name === 'string'
        ? error.name
        : ''
    );

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permissão de câmera negada. Libere o acesso no navegador ou use a entrada manual.';
  }
  if (
    name === 'NotFoundError'
    || name === 'NotReadableError'
    || name === 'OverconstrainedError'
  ) {
    return 'Nenhuma câmera utilizável foi encontrada. Use a entrada manual ou tente outro dispositivo.';
  }
  return 'Não foi possível iniciar a câmera. Tente novamente ou use a entrada manual.';
}

function emitOptionalScanFeedback() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate?.(35);
    }
  } catch {
    // Feedback tátil é opcional.
  }

  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.06);
    oscillator.addEventListener('ended', () => {
      void context.close();
    }, { once: true });
  } catch {
    // Feedback sonoro é opcional e nunca bloqueia a leitura.
  }
}

export function WarehouseMobileScanner({
  expectation,
  identifyScan,
  onScanCandidate,
  onValidatedScan,
  cooldownMs = 900,
  title = 'Leitor de código',
}: WarehouseMobileScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const cooldownGuardRef = useRef(
    createWarehouseMobileCooldownGuard(cooldownMs)
  );
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [message, setMessage] = useState(
    'A câmera só será ativada quando você solicitar.'
  );
  const [manualValue, setManualValue] = useState('');
  const [lastEvent, setLastEvent] = useState<WarehouseMobileScanEvent | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  useEffect(() => {
    cooldownGuardRef.current = createWarehouseMobileCooldownGuard(cooldownMs);
  }, [cooldownMs]);

  const processCandidate = useCallback(async (
    rawValue: string,
    source: WarehouseMobileScanSource
  ) => {
    const normalized = normalizeWarehouseMobileScanValue(rawValue);
    if (!normalized) {
      setStatus('error');
      setMessage('O código lido é vazio ou inválido.');
      return;
    }

    if (!cooldownGuardRef.current.shouldAccept(normalized)) {
      return;
    }

    let kind: WarehouseMobileScanKind = 'UNKNOWN';
    try {
      kind = identifyScan ? await identifyScan(normalized) : 'UNKNOWN';
    } catch {
      kind = 'UNKNOWN';
    }

    if (!mountedRef.current) return;

    const event = buildWarehouseMobileScanEvent({
      value: normalized,
      kind,
      expectation,
      source,
    });

    setLastEvent(event);
    onScanCandidate?.(event);

    if (!event.accepted) {
      setStatus('error');
      setMessage(
        kind === 'UNKNOWN'
          ? 'Código capturado, mas ainda não identificado pelo resolver operacional.'
          : `Tipo de código incompatível. Esperado: ${expectedWarehouseMobileScanKind(expectation)}.`
      );
      return;
    }

    setStatus('success');
    setMessage('Leitura validada.');
    emitOptionalScanFeedback();
    onValidatedScan?.(event);
  }, [
    expectation,
    identifyScan,
    onScanCandidate,
    onValidatedScan,
  ]);

  const stopCamera = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    cooldownGuardRef.current.reset();
    setStatus('idle');
    setMessage('Câmera encerrada. Você pode ativá-la novamente quando precisar.');
  }, []);

  const startCamera = useCallback(async () => {
    if (status === 'loading' || stopRef.current) return;

    if (
      typeof navigator === 'undefined'
      || !navigator.mediaDevices
      || !navigator.mediaDevices.getUserMedia
      || !videoRef.current
    ) {
      setStatus('error');
      setMessage('Este navegador não oferece acesso compatível à câmera. Use a entrada manual.');
      return;
    }

    setStatus('loading');
    setMessage('Preparando câmera e decoder…');

    try {
      const { startWarehouseMobileDecoder } = await import('./scannerDecoder');
      if (!mountedRef.current || !videoRef.current) return;

      const session = await startWarehouseMobileDecoder({
        videoElement: videoRef.current,
        onDecoded: (value) => {
          void processCandidate(value, 'CAMERA');
        },
      });

      if (!mountedRef.current) {
        session.stop();
        return;
      }

      stopRef.current = () => session.stop();
      setStatus('ready');
      setMessage('Câmera pronta. Aponte para o código.');
    } catch (error) {
      stopRef.current?.();
      stopRef.current = null;
      if (!mountedRef.current) return;
      setStatus('error');
      setMessage(describeCameraError(error));
    }
  }, [processCandidate, status]);

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = manualValue;
    if (!value.trim()) return;
    setManualValue('');
    void processCandidate(value, 'MANUAL');
  };

  const cameraActive = status === 'ready' || status === 'success';

  return (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.38)]"
      aria-label={title}
      data-testid="warehouse-mobile-scanner"
      data-scanner-status={status}
      data-scanner-expectation={expectation}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#00288e]/70">
            Scanner compartilhado
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            {title}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
          {expectation}
        </span>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden bg-slate-950">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          autoPlay
          playsInline
          aria-label="Prévia da câmera para leitura de código"
        />

        {!cameraActive && status !== 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/92 px-8 text-center">
            <div>
              <Camera className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-white">Câmera inativa</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Nenhuma imagem ou vídeo é armazenado.
              </p>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/88">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-300" aria-hidden="true" />
              <p className="mt-3 text-xs font-bold text-slate-200">Ativando leitor…</p>
            </div>
          </div>
        )}

        {cameraActive && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 bg-red-400/90 shadow-[0_0_14px_rgba(248,113,113,0.65)]" />
            <div className="absolute inset-[12%] rounded-2xl border border-white/55" />
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div
          className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-sm ${
            status === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-blue-100 bg-blue-50/70 text-slate-700'
          }`}
          aria-live="polite"
          data-testid="warehouse-mobile-scanner-feedback"
        >
          {status === 'error' ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : status === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-[#00288e]" aria-hidden="true" />
          )}
          <span className="font-semibold leading-5">{message}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={status === 'loading' || Boolean(stopRef.current)}
            className="min-h-12 rounded-2xl bg-[#00288e] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50"
            data-testid="warehouse-mobile-camera-start"
          >
            {status === 'loading' ? 'Ativando…' : 'Ativar câmera'}
          </button>
          <button
            type="button"
            onClick={stopCamera}
            disabled={!stopRef.current}
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-45"
            data-testid="warehouse-mobile-camera-stop"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <CameraOff className="h-4 w-4" aria-hidden="true" />
              Encerrar
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
            ou
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submitManual} className="space-y-2">
          <label
            htmlFor="warehouse-mobile-manual-code"
            className="flex items-center gap-2 text-xs font-black text-slate-700"
          >
            <Keyboard className="h-4 w-4 text-[#00288e]" aria-hidden="true" />
            Entrada manual
          </label>
          <div className="flex gap-2">
            <input
              id="warehouse-mobile-manual-code"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              autoComplete="off"
              inputMode="text"
              className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-900 shadow-inner outline-none"
              placeholder="Digite ou cole o código"
              data-testid="warehouse-mobile-manual-input"
            />
            <button
              type="submit"
              disabled={!manualValue.trim()}
              className="min-h-12 rounded-2xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-45"
              data-testid="warehouse-mobile-manual-submit"
            >
              Ler
            </button>
          </div>
        </form>

        {lastEvent && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
              Última captura
            </p>
            <p className="mt-1 break-all text-sm font-black text-slate-900">
              {lastEvent.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {lastEvent.source} · {lastEvent.kind}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
