'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

interface SharePart {
  number: number; name: string; amountCents: number;
  status: 'open' | 'paid'; checkoutUrl?: string; checkoutState?: string;
}
interface ShareInfo {
  count: number; amountCents: number; partAmountCents: number; feeCents: number;
  totalCents: number; paidCount?: number; parts: SharePart[];
}
interface ShareState {
  enabled: boolean; eligible: boolean; amountCents: number;
  referenceMonth: string | null; cycleStatus?: string | null; shared: ShareInfo | null;
}
function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
function isProviderUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (['infinitepay.io','infinitepay.com.br'].includes(url.hostname)
      || url.hostname.endsWith('.infinitepay.io') || url.hostname.endsWith('.infinitepay.com.br'));
  } catch { return false; }
}
async function api(action: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Entre novamente no EMPROVEX para consultar a assinatura.');
  const token = await user.getIdToken();
  const response = await fetch('/api/billing/portal?' + action, {
    method: payload ? 'POST' : 'GET', cache: 'no-store',
    headers: { authorization: 'Bearer ' + token, ...(payload ? { 'content-type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.code === 'string' ? data.code : 'Consulta temporariamente indisponível.');
  return data;
}

/** Only the payment is shared. Workspace, login and subscription stay unchanged. */
export function SharedBillingPanel({ workspaceId, onConfiguredChange, refreshToken = 0 }: {
  workspaceId: string; onConfiguredChange: (configured: boolean) => void; refreshToken?: number;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const data = await api('view=shared') as unknown as ShareState;
    setState(data); onConfiguredChange(Boolean(data.shared));
  }, [onConfiguredChange]);
  useEffect(() => {
    let active = true;
    setLoading(true); setState(null); onConfiguredChange(false);
    void api('view=shared').then(data => {
      if (!active) return;
      const value = data as unknown as ShareState;
      setState(value); onConfiguredChange(Boolean(value.shared));
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'Falha na consulta do rateio.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, refreshToken, onConfiguredChange]);

  const changeCount = (value: number) => {
    setCount(value);
    setNames(current => Array.from({ length: value }, (_, i) => current[i] || ''));
    setConsent(false);
  };
  const quotedCents = state?.amountCents || 0;
  const partCents = Math.ceil(quotedCents / count);
  const totalCents = partCents * count;
  const feeCents = totalCents - quotedCents;

  const configure = async () => {
    if (!consent || !state?.eligible || busy || names.some(n => n.trim().length < 2)) return;
    setBusy(true); setError('');
    try {
      await api('action=configure-shared', { participantNames: names, acceptDivisionFee: true });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível configurar.');
    } finally { setBusy(false); }
  };
  const createLink = async (number: number) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await api('action=shared-checkout', { number, confirmRealPayment: true });
      if (result.status === 'pending_review') {
        setError('Este pedido está em conferência. Não tente gerar outra cobrança: procure o suporte se o link não aparecer.');
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o link.');
    } finally { setBusy(false); }
  };

  if (loading) return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      Consultando possibilidade de mensalidade compartilhada...
    </section>
  );
  if (!state || (!state.enabled && !state.shared)) return null;

  return (
    <section data-testid="billing-shared-payment" className="mt-5 rounded-2xl border border-sky-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold text-slate-900">Mensalidade compartilhada</h3>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-800">Opcional • Mesma conta do setor</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Divida apenas o pagamento entre os integrantes do aprovisionamento. Não serão criados novos perfis, acessos ou workspaces.
        Todos os pagamentos serão recebidos na mesma conta EMPROVEX.
      </p>

      {state.shared ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-slate-900">
            Competência {state.referenceMonth} • {money(state.shared.partAmountCents)} por integrante
          </p>
          <p className="text-xs text-slate-600">
            Mensalidade {money(state.shared.amountCents)} + taxa de divisão por arredondamento {money(state.shared.feeCents)}
            {' '}= {money(state.shared.totalCents)} em {state.shared.count} cotas iguais.
          </p>
          <p className="text-xs font-semibold text-sky-800">
            {state.shared.paidCount || 0} de {state.shared.count} cotas verificadas.
            A competência só é quitada após a confirmação de todas as cotas.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: ((state.shared.paidCount || 0) / state.shared.count * 100) + '%' }} />
          </div>
          {state.shared.parts.map(part => (
            <div key={part.number} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{part.name}</p>
                <p className="text-xs text-slate-600">
                  Cota {part.number}: {money(part.amountCents)}
                  {' • '}{part.status === 'paid' ? 'Pagamento confirmado' : 'Pendente'}
                </p>
              </div>
              {part.status === 'paid' ? (
                <span className="text-xs font-bold text-emerald-800">Pago</span>
              ) : part.checkoutUrl && isProviderUrl(part.checkoutUrl) ? (
                <div className="flex flex-wrap gap-2">
                  <a href={part.checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Abrir link de pagamento</a>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(part.checkoutUrl!)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800">
                    Copiar link
                  </button>
                </div>
              ) : part.checkoutState === 'dispatching' ? (
                <span className="text-xs text-amber-800">Em conferência com a InfinitePay</span>
              ) : (
                <button type="button" onClick={() => void createLink(part.number)} disabled={busy || !state.enabled}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                  Gerar link desta cota
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => void refresh()} disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800">
            Atualizar pagamentos
          </button>
          {state.cycleStatus === 'paid' && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            Mensalidade compartilhada integralmente quitada.
          </p>}
        </div>
      ) : state.eligible && state.enabled ? (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-slate-900" htmlFor="shared-count">Quantidade de participantes</label>
          <select id="shared-count" value={count} onChange={event => changeCount(Number(event.target.value))}
            className="w-full max-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
            {Array.from({ length: 19 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} participantes</option>)}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            {names.map((name,i) => (
              <label key={i} className="block text-xs font-bold text-slate-700">
                Identificação do integrante {i+1}
                <input type="text" maxLength={60} value={name}
                  placeholder="Ex.: 3º Sgt Sodre"
                  onChange={event => { const value = event.target.value;
                    setNames(current => current.map((old,j) => j === i ? value : old));
                    setConsent(false);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"/>
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs text-slate-800">
            <p className="font-extrabold text-lg text-slate-900">{money(partCents)} por integrante</p>
            <p className="mt-1">Mensalidade {money(quotedCents)} + taxa de divisão {money(feeCents)}
              {' '}= total de {money(totalCents)}.</p>
            <p className="mt-2">Todos os valores são iguais, com arredondamento de centavos para cima.
              A divisão ficará fixada para esta competência, sem alterar a assinatura ou os acessos.</p>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5"/>
            <span>Concordo com o rateio, com o valor individual de {money(partCents)} e a taxa total de divisão
              {' '}de {money(feeCents)}, conforme os <a href="/terms" target="_blank" rel="noreferrer"
                className="font-bold underline">Termos de Serviço</a>.</span>
          </label>
          <button type="button" onClick={() => void configure()} disabled={busy || !consent || names.some(n => n.trim().length < 2)}
            className="rounded-xl bg-emerald-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
            {busy ? 'Configurando...' : 'Confirmar divisão da mensalidade'}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-amber-800">
          A divisão não está disponível para esta competência. Um checkout integral pode já ter sido emitido,
          o pagamento pode ter sido concluído ou o setor ainda está em período gratuito.
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-rose-800">{error}</p>}
    </section>
  );
}
