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
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [verify, setVerify] = useState<VerifyInfo | null>(null);
  const [error, setError] = useState('');
  const verifiedKeyRef = useRef('');

  useEffect(() => {
    if (!authorizedWorkspace) {
      setAvailable(false);
      setCheckout(null);
      return;
    }
    let active = true;
    void authenticatedPortalFetch('/api/billing/portal')
      .then((result: PilotAvailability) => {
        if (active) setAvailable(result.pilot?.enabled === true && result.pilot.amountCents === 100);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => { active = false; };
  }, [authorizedWorkspace]);

  useEffect(() => {
    if (!available || !authorizedWorkspace || !returnParams) return;
    const marker = [returnParams.orderNsu, returnParams.transactionNsu, returnParams.slug].join('|');
    if (verifiedKeyRef.current === marker) return;
    verifiedKeyRef.current = marker;
    void authenticatedPortalFetch('/api/billing/pilot-verify', {
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
      const result = await authenticatedPortalFetch('/api/billing/pilot-checkout', {
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

  if (!authorizedWorkspace || !available) return null;

  return (
    <section data-testid="infinitepay-real-pilot" className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5">
      <div className="flex items-center gap-2 text-amber-100">
        <ShieldCheck className="h-5 w-5" aria-hidden />
        <h3 className="text-sm font-black">Laboratório de Pix real · conta autorizada</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
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
        <div data-testid="infinitepay-pilot-link-ready" className="mt-4 rounded-xl border border-amber-100/15 bg-slate-950/40 p-4">
          <p className="text-xs font-bold text-amber-100">Link criado para o teste de R$ 1,00</p>
          <p className="mt-1 text-xs text-slate-300">Confira o favorecido e o valor no checkout. Não pague duas vezes.</p>
          <a href={checkout.checkoutUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-3 text-xs font-black text-slate-900"
            data-testid="infinitepay-pilot-open">
            Abrir pagamento na InfinitePay <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {verify?.verified && (
        <div role="status" data-testid="infinitepay-pilot-verified" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200/25 bg-emerald-400/[0.12] p-3 text-xs font-bold text-emerald-100">
          <CheckCheck className="h-5 w-5 shrink-0" aria-hidden />
          Pix técnico confirmado pela API da InfinitePay. Sua assinatura não foi alterada.
        </div>
      )}
      {error && (
        <div role="status" className="mt-4 flex items-start gap-2 text-xs text-amber-100">
          <CircleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </section>
  );
}
