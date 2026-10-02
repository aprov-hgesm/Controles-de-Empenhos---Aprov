'use client';

import { useState, type ReactNode } from 'react';
import { ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';

import { useLegalAcceptance } from '../../hooks/useLegalAcceptance';
import type { LegalAcceptanceIdentity } from '../../lib/legalAcceptance';
import { CURRENT_LEGAL_BUNDLE } from '../../lib/legalVersions';

interface LegalAcceptanceGateProps {
  identity: LegalAcceptanceIdentity;
  children: ReactNode;
}

export function LegalAcceptanceGate({
  identity,
  children,
}: LegalAcceptanceGateProps) {
  const { status, error, accepted, accept, refresh } = useLegalAcceptance(identity);
  const [confirmed, setConfirmed] = useState(false);

  if (accepted) {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-800">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#00288e]" />
          Verificando os documentos legais vigentes…
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-800">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-lg">
          <h1 className="text-xl font-black text-slate-950">Não foi possível verificar o aceite</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O EMPROVEX não conseguiu confirmar a versão legal desta sessão. Nenhum aceite foi presumido.
          </p>
          {error ? (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 rounded-xl bg-[#00288e] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#001e6a]"
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  const saving = status === 'saving';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f4f7fb] via-white to-[#eef3fb] px-5 py-10 text-slate-800">
      <section
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9"
        aria-labelledby="legal-acceptance-title"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#00288e]">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 id="legal-acceptance-title" className="mt-5 text-2xl font-black tracking-tight text-slate-950">
          Termos e Privacidade
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Antes de continuar, consulte os documentos vigentes do EMPROVEX. Este aceite registra a utilização
          contratual do serviço e não significa que todo tratamento de dados pessoais dependa de consentimento.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-extrabold text-[#00288e] transition hover:bg-blue-50"
          >
            Abrir Termos de Serviço
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-extrabold text-[#00288e] transition hover:bg-blue-50"
          >
            Abrir Política de Privacidade
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#00288e]"
          />
          <span className="text-sm font-semibold leading-6 text-slate-700">
            Li e aceito os Termos de Serviço e a Política de Privacidade.
          </span>
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!confirmed || saving}
          onClick={() => {
            void accept().catch(() => undefined);
          }}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00288e] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#001e6a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Registrando aceite…' : 'Aceitar e continuar'}
        </button>

        <p className="mt-4 text-center text-[11px] font-semibold text-slate-400">
          Pacote legal {CURRENT_LEGAL_BUNDLE.legalBundleVersion}
        </p>
      </section>
    </main>
  );
}
