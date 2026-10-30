'use client';

import { useState } from 'react';
import { auth } from '../../lib/firebase';
import { HGESM_SECTOR_EMAIL } from '../../lib/hgesmWorkspace';
import type { SectorBillingDecision } from '../../lib/sectorBillingGate';

export function BillingReturnButton({ className, children }: {
  className?: string;
  children: React.ReactNode;
}) {
  const [modal, setModal] = useState(false);
  const [decision, setDecision] = useState<SectorBillingDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = async (path: string, body?: Record<string, unknown>) => {
    const user = auth.currentUser;
    if (!user) { window.location.assign('/central-empenhos'); return null; }
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + token,
        ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.code || 'BILLING_ACCESS_UNAVAILABLE');
    return payload as SectorBillingDecision;
  };
  const tryReturn = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (auth.currentUser?.email?.toLowerCase() === HGESM_SECTOR_EMAIL.toLowerCase()) {
        window.location.assign('/central-empenhos'); return;
      }
      const result = await request('/api/billing/portal?view=access');
      if (!result) return;
      if (result.allowed) { window.location.assign('/central-empenhos'); return; }
      setDecision(result); setModal(true);
    } catch {
      setError('Não foi possível verificar sua assinatura. Você pode consultar os pagamentos ou tentar novamente.');
      setModal(true);
    } finally { setBusy(false); }
  };
  const grantGrace = async () => {
    if (busy || !decision?.canRequestGrace48) return;
    setBusy(true); setError('');
    try {
      const result = await request('/api/billing/portal?action=request-grace48', { confirm: true });
      if (!result?.allowed) throw new Error('Acesso temporário indisponível.');
      window.location.assign('/central-empenhos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível solicitar as 48 horas.');
    } finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => void tryReturn()} disabled={busy} className={className}>
      {busy ? 'Consultando assinatura...' : children}
    </button>
    {modal && (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/75 p-4"
        role="dialog" aria-modal="true" aria-labelledby="billing-return-warning">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-slate-900 shadow-2xl">
          <h2 id="billing-return-warning" className="text-lg font-black">
            {decision ? 'Mensalidade não identificada' : 'Verificação de assinatura indisponível'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {decision
              ? 'O pagamento da mensalidade deste setor ainda não foi identificado. Para continuar utilizando a plataforma, efetue o pagamento na aba Formas de pagamento.'
              : 'Não foi possível consultar o servidor financeiro neste momento. Isso não significa que a mensalidade esteja em atraso. Tente novamente ou consulte o suporte.'}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Se já pagou, evite realizar outro Pix: aguarde a conciliação ou solicite acesso temporário.
          </p>
          {decision?.graceUntil && !decision.canRequestGrace48 && (
            <p className="mt-3 text-xs font-semibold text-amber-800">
              A liberação temporária para esta competência já foi solicitada. Não é possível renovar automaticamente.
              {decision.requestPending ? ' O administrador ainda está verificando o pagamento.' : ''}
            </p>
          )}
          {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
          <div className="mt-5 flex flex-col gap-2">
            {decision?.canRequestGrace48 && (
              <button type="button" disabled={busy}
                onClick={() => void grantGrace()}
                className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                Solicitar acesso temporário de 48 horas
              </button>
            )}
            <button type="button" onClick={() => { setModal(false); window.location.assign('/regularizacao'); }}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800">
              Ir para as formas de pagamento
            </button>
            <button type="button" onClick={() => setModal(false)}
              className="min-h-11 px-4 py-2 text-xs font-semibold text-slate-500">
              Permanecer nesta página
            </button>
          </div>
        </div>
      </div>
    )}
  </>;
}
