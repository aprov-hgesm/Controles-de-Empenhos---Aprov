'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowUpRight, BadgeCheck, Clock3, CreditCard,
  FileCheck2, LockKeyhole, ShieldCheck, UserRound,
} from 'lucide-react';

import { auth } from '../../lib/firebase';
import { resolveWorkspaceContext, type ResolvedWorkspaceContext } from '../../lib/workspaceContext';
import { resolveBillingWorkspaceContext } from '../../lib/billing/resolveBillingWorkspaceContext';
import { useWorkspaceBillingAccount } from '../../hooks/useWorkspaceBillingAccount';
import { inspectInfinitePayReturn } from '../../lib/billing/infinitepayReturnStatus.mjs';
import { InfinitePayPilotPanel, type PilotReturnParams } from './InfinitePayPilotPanel';
import type { BillingPortalTab } from '../../lib/billing/billingPortalTabs';

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL', style: 'currency',
  }).format(cents / 100);
}

function accountStatus(value: string | undefined) {
  switch (value) {
    case 'trial': return 'Período de teste';
    case 'active': return 'Acesso ativo';
    case 'pending': return 'Regularização pendente';
    case 'exempt': return 'Isento de cobrança';
    case 'suspended': return 'Acesso suspenso';
    case 'canceled': return 'Assinatura cancelada';
    default: return 'Não disponível';
  }
}

function useSafeWorkspaceBillingContext() {
  const [status, setStatus] = useState<'loading' | 'anonymous' | 'authenticated' | 'denied'>('loading');
  const [context, setContext] = useState<ResolvedWorkspaceContext>(() => resolveWorkspaceContext(null));
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const currentRequest = ++requestId;
      setContext(resolveWorkspaceContext(null));
      setEmail(user?.email || null);
      if (!user || !user.email) {
        setStatus('anonymous');
        return;
      }

      setStatus('loading');
      // Works after full reload/HMR: reads this user's directory entry and its
      // matching workspace. This cannot create a session, change billing, or
      // select another customer's workspace from the URL.
      void resolveBillingWorkspaceContext(user)
        .then((verifiedContext) => {
          if (!active || currentRequest !== requestId) return;
          setContext(verifiedContext);
          setStatus('authenticated');
        })
        .catch((error: unknown) => {
          if (!active || currentRequest !== requestId) return;
          console.warn(
            'Consulta segura do workspace comercial não concluída.',
            error instanceof Error ? error.message : 'erro desconhecido'
          );
          setContext(resolveWorkspaceContext(null));
          setStatus('denied');
        });
    });

    return () => {
      active = false;
      requestId += 1;
      unsubscribe();
    };
  }, []);

  return { status, context, email };
}

export function InfinitePayReadinessPanel({
  activeTab, onNavigate,
}: {
  activeTab: BillingPortalTab;
  onNavigate: (tab: BillingPortalTab) => void;
}) {
  const { status, context, email } = useSafeWorkspaceBillingContext();
  const { account, loading: billingLoading } = useWorkspaceBillingAccount(context);
  const [returnNotice, setReturnNotice] = useState(false);
  const [returnParams, setReturnParams] = useState<PilotReturnParams | null>(null);

  useEffect(() => {
    // The InfinitePay redirect alone is NEVER proof of payment.
    // Sensitive transaction identifiers must not remain in history/referrer URLs
    // while the authenticated server-side reconciliation is not enabled.
    const result = inspectInfinitePayReturn(window.location.href);
    if (result.isReturn) {
      // Capture opaque checkout references in ephemeral component memory only,
      // then clear the address bar. They are NOT proof of payment.
      const current = new URL(window.location.href);
      const orderNsu = current.searchParams.get('order_nsu');
      const transactionNsu = current.searchParams.get('transaction_nsu');
      const slug = current.searchParams.get('slug');
      if (orderNsu && transactionNsu && slug) {
        setReturnParams({ orderNsu, transactionNsu, slug });
      }
      setReturnNotice(true);
      onNavigate('payments');
      window.history.replaceState(window.history.state, '', result.cleanedPath);
    }
  }, [onNavigate]);

  const workspaceResolved = context.status === 'sector';
  const exempt = account?.status === 'exempt';
  return (
    <div data-testid="infinitepay-regularization-panel" className="mt-5 space-y-5">
      {returnNotice && activeTab === 'payments' && (
        <div role="status" data-testid="infinitepay-unverified-return" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <Clock3 className="h-4 w-4" /> Retorno do checkout identificado
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/80">
            Sua volta ao EMPROVEX não confirma pagamento. Quando o retorno pertencer ao piloto autorizado,
            a validação pela API aparecerá abaixo. Outros pagamentos precisam de conciliação administrativa.
            Não repita o Pix do mesmo pedido.
          </p>
        </div>
      )}

      {activeTab === 'overview' && (
      <section className="overflow-hidden rounded-[1.65rem] border border-[#dfe8f0] bg-gradient-to-br from-white via-white to-[#f3faf7] p-5 shadow-[0_16px_45px_rgba(15,40,70,0.055)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[#0b725d]">
            <CreditCard className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-extrabold text-[#13263a]">Minha assinatura e pagamentos</h2>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
            Plano Completo
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Acompanhe o plano contratado e a situação comercial do seu setor.
          Somente as condições registradas na sua conta são consideradas nesta consulta.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[#dce8e7] bg-white/90 p-5 shadow-[0_6px_20px_rgba(30,60,70,0.03)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <UserRound className="h-4 w-4" /> Identidade da sessão
            </div>
            {status === 'loading' && <p className="mt-3 text-sm text-slate-600">Validando identidade e workspace...</p>}
            {status === 'anonymous' && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-amber-900">Entre no EMPROVEX para identificar seu setor.</p>
                <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-[#0b725d] hover:text-cyan-100">
                  Ir para o login <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )}
            {status === 'denied' && (
              <p role="status" data-testid="billing-workspace-validation-error" className="mt-3 text-xs leading-relaxed text-amber-900">
                Não foi possível validar o vínculo com seu setor. Retorne ao início e faça login novamente.
                Nenhuma cobrança será exibida sem autorização.
              </p>
            )}
            {status === 'authenticated' && (
              <>
                <p className="mt-3 break-all text-sm font-bold text-[#13263a]">{email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {workspaceResolved
                    ? `Workspace validado na sessão: ${context.workspaceName}`
                    : 'Sessão Firebase encontrada. Abra esta aba a partir do EMPROVEX autenticado para vincular o setor.'}
                </p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-[#dce8e7] bg-white/90 p-5 shadow-[0_6px_20px_rgba(30,60,70,0.03)]" data-testid="billing-session-state">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4" /> Situação comercial
            </div>
            <p className="mt-3 text-base font-extrabold text-[#13263a]">
              {!workspaceResolved ? (status === 'loading' ? 'Validando acesso...' : 'Sem setor autorizado') : (billingLoading ? 'Consultando conta...' : accountStatus(account?.status))}
            </p>
            {workspaceResolved && !billingLoading && account && (
              <p className="mt-1 text-xs text-slate-500">
                {exempt ? 'Isenção preservada. Nenhum pagamento necessário.' :
                  `Valor atual cadastrado: ${money(account.monthlyPriceCents)}/mês.`}
              </p>
            )}
            {workspaceResolved && !billingLoading && !account && (
              <p className="mt-1 text-xs text-slate-500">
                Nenhum registro comercial acessível para esta sessão. Não é possível calcular cobrança.
              </p>
            )}
            {!workspaceResolved && (
              <p className="mt-1 text-xs text-slate-500">
                Não exibimos boletos ou cobranças sem validar o workspace autorizado.
              </p>
            )}
          </div>
        </div>

        {workspaceResolved && !billingLoading && account?.status === 'trial' && account.trialEndsAt && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-extrabold">Período de teste</p>
            <p className="mt-1">
              Prazo cadastrado até {account.trialEndsAt.slice(0, 10).split('-').reverse().join('/')}.
              Não há cobrança por esta consulta.
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3" aria-label="Acessos da assinatura">
          <button type="button" onClick={() => onNavigate('history')}
            data-testid="billing-overview-history"
            className="rounded-xl border border-[#dce8e7] bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm">
            <span className="text-xs font-extrabold text-[#0b725d]">Histórico financeiro</span>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Competências emitidas, valores, vencimentos e situação de cada registro.</p>
          </button>
          <button type="button" onClick={() => onNavigate('payments')}
            data-testid="billing-overview-payments"
            className="rounded-xl border border-[#dce8e7] bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm">
            <span className="text-xs font-extrabold text-[#0b725d]">Formas de pagamento</span>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Orientações para pagar com segurança e verificar um pagamento.</p>
          </button>
          <button type="button" onClick={() => onNavigate('help')}
            data-testid="billing-overview-help"
            className="rounded-xl border border-[#dce8e7] bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm">
            <span className="text-xs font-extrabold text-[#0b725d]">Ajuda e orientações</span>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Entenda isenções, registros pendentes e como obter suporte.</p>
          </button>
        </div>
      </section>
      )}

      <InfinitePayPilotPanel
        authorizedWorkspace={workspaceResolved && status === 'authenticated'}
        workspaceId={workspaceResolved ? context.workspaceId : null}
        returnParams={returnParams}
        activeTab={activeTab}
      />

      {activeTab === 'history' && !workspaceResolved && (
        <div data-testid="billing-history-unauthorized" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {status === 'loading' ? 'Validando sua sessão para consultar o histórico...' :
            'Entre novamente com sua conta de setor para consultar os registros financeiros.'}
        </div>
      )}

      {activeTab === 'payments' && (
      <section data-testid="billing-payment-journey" className="mt-5 rounded-[1.65rem] border border-[#dfe8f0] bg-white p-5 shadow-[0_12px_35px_rgba(15,40,70,0.04)] sm:p-7">
        <div>
          <h2 className="text-lg font-extrabold text-[#13263a]">Como funciona a confirmação de pagamento</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Confira a competência e o valor efetivamente emitidos antes de abrir o checkout.
            Não há pagamento automático de mensalidades habilitado nesta etapa.
          </p>
        </div>


        <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Etapas do checkout InfinitePay">
          <div className="rounded-xl border border-[#e2eaf0] bg-white p-4 transition-colors hover:border-[#c6ded7]">
            <FileCheck2 className="h-5 w-5 text-[#0b725d]" aria-hidden />
            <p className="mt-2 text-xs font-bold text-[#13263a]">1. Cobrança individual</p>
            <p className="mt-1 text-xs text-slate-500">Valor e competência confirmados no servidor.</p>
          </div>
          <div className="rounded-xl border border-[#e2eaf0] bg-white p-4 transition-colors hover:border-[#c6ded7]">
            <CreditCard className="h-5 w-5 text-[#0b725d]" aria-hidden />
            <p className="mt-2 text-xs font-bold text-[#13263a]">2. Checkout seguro</p>
            <p className="mt-1 text-xs text-slate-500">Pagamento no ambiente da InfinitePay.</p>
          </div>
          <div className="rounded-xl border border-[#e2eaf0] bg-white p-4 transition-colors hover:border-[#c6ded7]">
            <BadgeCheck className="h-5 w-5 text-[#0b725d]" aria-hidden />
            <p className="mt-2 text-xs font-bold text-[#13263a]">3. Confirmação</p>
            <p className="mt-1 text-xs text-slate-500">Conciliação pelo servidor, sem confiar apenas no retorno.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-testid="infinitepay-checkout-disabled"
            title="Cobranças reais ainda não foram habilitadas no EMPROVEX."
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-500"
          >
            <LockKeyhole className="mr-2 inline h-4 w-4" aria-hidden /> Pagar com InfinitePay
          </button>
          <p className="max-w-md text-xs text-slate-500">
            Disponível após certificação de identidade, Firestore e reconciliação.
            Esta tela não utiliza sua API Key e não cria links.
          </p>
        </div>
      </section>
      )}

    </div>
  );
}
