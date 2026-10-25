'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCheck, CircleAlert, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';

export interface PilotReturnParams {
  orderNsu: string;
  transactionNsu: string;
  slug: string;
}

interface PilotAvailability {
  pilot?: { enabled: boolean; amountCents: number };
  history?: {
    available: boolean;
    cycles: Array<{ referenceMonth: string; amountCents: number; dueDate: string; status: string }>;
  };
}
type CheckoutInfo = {
  mode: string;
  orderNsu: string;
  checkoutUrl: string;
  amountCents: number;
  settlesSubscription: false;
};
type VerifyInfo = { verified: boolean; code: string; settlesSubscription: false };

async function authenticatedPortalFetch(path: string, options?: { body?: Record<string, unknown> }) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) throw new Error('Faça login novamente para continuar.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: options ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options ? { body: JSON.stringify(options.body || {}) } : {}),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Operação indisponível (' + (data.code || response.status) + ').');
  return data;
}

export function InfinitePayPilotPanel({
  authorizedWorkspace, returnParams,
}: {
  authorizedWorkspace: boolean;
  returnParams: PilotReturnParams | null;
}) {
  const [available, setAvailable] = useState(false);
  const [history, setHistory] = useState<PilotAvailability['history'] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [verify, setVerify] = useState<VerifyInfo | null>(null);
  const [error, setError] = useState('');
  const verifiedKeyRef = useRef('');

  useEffect(() => {
    if (!authorizedWorkspace) {
      setAvailable(false);
      setHistory(null);
      setCheckout(null);
      return;
    }
    let active = true;
    void authenticatedPortalFetch('/api/billing/portal')
      .then((result: PilotAvailability) => {
        if (active) {
          setAvailable(result.pilot?.enabled === true && result.pilot.amountCents === 100);
          setHistory(result.history || { available: false, cycles: [] });
        }
      })
      .catch(() => {
        if (active) {
          setAvailable(false);
          setHistory({ available: false, cycles: [] });
        }
      });
    return () => { active = false; };
  }, [authorizedWorkspace]);

  useEffect(() => {
    if (!available || !authorizedWorkspace || !returnParams) return;
    const marker = [returnParams.orderNsu, returnParams.transactionNsu, returnParams.slug].join('|');
    if (verifiedKeyRef.current === marker) return;
    verifiedKeyRef.current = marker;
    void authenticatedPortalFetch('/api/billing/portal?action=verify-pilot', {
      body: {
        orderNsu: returnParams.orderNsu,
        transactionNsu: returnParams.transactionNsu,
        slug: returnParams.slug,
      },
    })
      .then((result: VerifyInfo) => {
        setVerify(result);
        if (!result.verified) setError('O retorno ainda não foi confirmado pela InfinitePay.');
      })
      .catch(() => {
        setError('Não foi possível confirmar este retorno como Pix do piloto. Consulte o registro da InfinitePay; não pague novamente.');
      });
  }, [available, authorizedWorkspace, returnParams]);

  const createPilotCheckout = async () => {
    if (!confirmed || busy || checkout || !available) return;
    setBusy(true);
    setError('');
    try {
      const result = await authenticatedPortalFetch('/api/billing/portal?action=create-pilot', {
        body: { confirmRealPix: true, amountCents: 100 },
      }) as CheckoutInfo;
      const url = new URL(result.checkoutUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'infinitepay.io'
        || url.hostname.endsWith('.infinitepay.io')
        || url.hostname === 'infinitepay.com.br'
        || url.hostname.endsWith('.infinitepay.com.br'))) {
        throw new Error('Link externo não reconhecido; a cobrança não foi exibida.');
      }
      setCheckout(result);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Não foi possível criar o checkout.');
    } finally {
      setBusy(false);
    }
  };

  if (!authorizedWorkspace) return null;

  return (
    <>
      {history && (
        <section id="historico-financeiro" data-testid="billing-cycle-history" className="scroll-mt-24 mt-5 rounded-2xl border border-[#e2e8f1] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">Histórico de competências</h3>
            <span className="text-[10px] text-slate-500">Até 24 registros materializados</span>
          </div>
          {!history.available ? (
            <p className="mt-3 text-xs text-slate-500">
              O histórico financeiro não está disponível neste ambiente. Isso não altera a situação da sua conta.
            </p>
          ) : history.cycles.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Nenhuma competência faturável para apresentar neste histórico.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {history.cycles.map((cycle) => (
                <div key={cycle.referenceMonth}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#f9fbfd] px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{cycle.referenceMonth}</p>
                    <p className="text-[11px] text-slate-500">
                      {cycle.dueDate ? 'Vencimento: ' + cycle.dueDate.split('-').reverse().join('/') : 'Vencimento não definido'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cycle.amountCents / 100)}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-600">
                      {cycle.status === 'paid' ? 'Pago' : cycle.status === 'waived' ? 'Dispensado' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            Apenas registros efetivamente emitidos. Nenhuma cobrança é criada por esta consulta.
          </p>
        </section>
      )}
      {available && (
    <section data-testid="infinitepay-real-pilot" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-amber-900">
        <ShieldCheck className="h-5 w-5" aria-hidden />
        <h3 className="text-sm font-black">Laboratório de Pix real · conta autorizada</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Teste técnico opcional de <strong>R$ 1,00</strong> pelo checkout oficial InfinitePay.
        É um pagamento verdadeiro, sujeito às condições do provedor, mas <strong>não é mensalidade</strong>,
        não remove isenções e não altera sua assinatura. Não repita o pagamento de um pedido já pago.
      </p>

      {!checkout && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-slate-200">
          <input
            type="checkbox"
            data-testid="infinitepay-pilot-consent"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-400"
          />
          Entendo que isto gerará um link REAL de R$ 1,00 e confirmarei recebedor e valor antes de pagar.
        </label>
      )}

      {!checkout && (
        <button
          type="button"
          data-testid="infinitepay-pilot-create"
          disabled={!confirmed || busy}
          onClick={() => void createPilotCheckout()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-xs font-black text-slate-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Gerar link de teste Pix · R$ 1,00
        </button>
      )}

      {checkout && (
        <div data-testid="infinitepay-pilot-link-ready" className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-bold text-amber-900">Link criado para o teste de R$ 1,00</p>
          <p className="mt-1 text-xs text-slate-600">Confira o favorecido e o valor no checkout. Não pague duas vezes.</p>
          <a href={checkout.checkoutUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-xs font-black text-slate-900"
            data-testid="infinitepay-pilot-open">
            Abrir pagamento na InfinitePay <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {verify?.verified && (
        <div role="status" data-testid="infinitepay-pilot-verified" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          <CheckCheck className="h-5 w-5 shrink-0" aria-hidden />
          Pix técnico confirmado pela API da InfinitePay. Sua assinatura não foi alterada.
        </div>
      )}
      {error && (
        <div role="status" className="mt-4 flex items-start gap-2 text-xs text-amber-900">
          <CircleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </section>
      )}
    </>
  );
}
