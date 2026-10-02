'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeCheck, Copy, ExternalLink, Loader2, ShieldCheck, WalletCards } from 'lucide-react';

interface RegularizationInfo {
  planName: string;
  monthlyPriceCents: number;
  currency: 'BRL';
  dueBusinessDay: number;
  gracePeriodDays: number;
  paymentLinkUrl: string;
  pixKey: string;
  pixKeyType: string;
  pixRecipientName: string;
  supportContact: string;
}

function money(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const PIX_KEY_LABEL: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave aleatória',
};

export default function RegularizationPage() {
  const [info, setInfo] = useState<RegularizationInfo | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/billing/regularization', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as RegularizationInfo & { message?: string };
        if (!response.ok) throw new Error(payload.message || 'Não foi possível carregar as instruções.');
        if (active) setInfo(payload);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as instruções.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const copyPix = async () => {
    if (!info?.pixKey) return;
    await navigator.clipboard.writeText(info.pixKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="rounded-[2rem] border border-blue-300/15 bg-[#071225]/90 p-6 shadow-2xl shadow-blue-950/20 sm:p-8">
          <div className="flex items-center gap-2 text-blue-200">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.20em]">EMPROVEX</span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Regularização da assinatura
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            O pagamento é realizado fora do EMPROVEX. Nenhum dado de cartão, CVV ou credencial de pagamento é solicitado nesta página.
            Após o pagamento, a confirmação é feita administrativamente.
          </p>
        </header>

        {error && (
          <section className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-5 text-sm text-amber-100">
            {error}
          </section>
        )}

        {!info && !error && (
          <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#071225]/70 p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-300" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-300">Carregando instruções de regularização…</p>
          </section>
        )}

        {info && (
          <>
            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoCard label="Plano" value={info.planName} />
              <InfoCard label="Mensalidade" value={`${money(info.monthlyPriceCents)} / mês`} />
              <InfoCard label="Vencimento" value={`${info.dueBusinessDay}º dia útil · ${info.gracePeriodDays} dias de tolerância`} />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/75 p-6">
                <div className="flex items-center gap-2 text-blue-200">
                  <WalletCards className="h-5 w-5" aria-hidden="true" />
                  <h2 className="font-extrabold text-white">Link de Pagamento</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  O pagamento será concluído no site externo configurado pela administração.
                </p>
                {info.paymentLinkUrl ? (
                  <a
                    href={info.paymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-500"
                  >
                    Abrir Link de Pagamento
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                    Link de Pagamento ainda não configurado. Utilize o Pix ou o canal de suporte abaixo.
                  </p>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/75 p-6">
                <div className="flex items-center gap-2 text-emerald-200">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  <h2 className="font-extrabold text-white">Pix</h2>
                </div>
                {info.pixKey ? (
                  <>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      {PIX_KEY_LABEL[info.pixKeyType] || 'Chave Pix'}
                    </p>
                    <div className="mt-2 break-all rounded-xl border border-white/[0.08] bg-slate-950/30 p-4 font-mono text-sm text-slate-100">
                      {info.pixKey}
                    </div>
                    {info.pixRecipientName && (
                      <p className="mt-2 text-xs text-slate-400">Favorecido: {info.pixRecipientName}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyPix()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-4 py-2.5 text-sm font-extrabold text-emerald-100"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      {copied ? 'Chave copiada' : 'Copiar chave Pix'}
                    </button>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">Pix ainda não configurado pela administração.</p>
                )}
              </div>
            </section>

            <section className="mt-5 rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/75 p-6">
              <h2 className="font-extrabold text-white">Precisa de ajuda?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {info.supportContact
                  ? <>Fale com o suporte pelo canal: <strong className="text-slate-200">{info.supportContact}</strong>.</>
                  : 'Utilize o canal de atendimento que foi fornecido no seu cadastro.'}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Esta página é apenas informativa e permanece separada do processamento financeiro do EMPROVEX.
              </p>
            </section>
          </>
        )}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <Link href="/" className="font-bold text-blue-300 hover:text-blue-200">Voltar ao EMPROVEX</Link>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-300">Termos de Serviço</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacidade</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#071225]/70 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-extrabold text-white">{value}</p>
    </div>
  );
}
