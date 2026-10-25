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

export function InfinitePayReadinessPanel() {
  const { status, context, email } = useSafeWorkspaceBillingContext();
  const { account, loading: billingLoading } = useWorkspaceBillingAccount(context);
  const [returnNotice, setReturnNotice] = useState(false);

  useEffect(() => {
    // The InfinitePay redirect alone is NEVER proof of payment.
    // Sensitive transaction identifiers must not remain in history/referrer URLs
    // while the authenticated server-side reconciliation is not enabled.
    const result = inspectInfinitePayReturn(window.location.href);
    if (result.isReturn) {
      setReturnNotice(true);
      window.history.replaceState(window.history.state, '', result.cleanedPath);
    }
  }, []);

  const workspaceResolved = context.status === 'sector';
  const exempt = account?.status === 'exempt';
  return (
    <div data-testid="infinitepay-regularization-panel" className="mt-5 space-y-4">
      {returnNotice && (
        <div role="status" data-testid="infinitepay-unverified-return" className="rounded-2xl border border-amber-300/25 bg-amber-400/[0.09] p-5">
          <div className="flex items-center gap-2 font-bold text-amber-100">
            <Clock3 className="h-4 w-4" /> Retorno do checkout identificado
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
            Sua volta ao EMPROVEX não confirma o pagamento. A verificação autenticada da InfinitePay e a baixa
            automática ainda estão em homologação. Guarde seu comprovante e não realize outro Pix para o mesmo pedido.
          </p>
        </div>
      )}

      <section className="overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-gradient-to-br from-[#0d2840] via-[#0a1a31] to-[#0b1427] p-5 shadow-[0_18px_70px_rgba(15,118,160,0.09)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-200">
            <CreditCard className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-extrabold text-white">Minha assinatura e pagamentos</h2>
          </div>
          <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-100">
            InfinitePay em homologação
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Acompanhe o seu plano e visualize como funcionará o checkout protegido da InfinitePay.
          Nenhuma cobrança é gerada por este painel.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <UserRound className="h-4 w-4" /> Identidade da sessão
            </div>
            {status === 'loading' && <p className="mt-3 text-sm text-slate-300">Validando identidade e workspace...</p>}
            {status === 'anonymous' && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-amber-100">Entre no EMPROVEX para identificar seu setor.</p>
                <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-cyan-200 hover:text-cyan-100">
                  Ir para o login <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            )}
            {status === 'denied' && (
              <p role="status" data-testid="billing-workspace-validation-error" className="mt-3 text-xs leading-relaxed text-amber-100">
                Não foi possível validar o vínculo com seu setor. Retorne ao início e faça login novamente.
                Nenhuma cobrança será exibida sem autorização.
              </p>
            )}
            {status === 'authenticated' && (
              <>
                <p className="mt-3 break-all text-sm font-bold text-white">{email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {workspaceResolved
                    ? `Workspace validado na sessão: ${context.workspaceName}`
                    : 'Sessão Firebase encontrada. Abra esta aba a partir do EMPROVEX autenticado para vincular o setor.'}
                </p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" data-testid="billing-session-state">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <ShieldCheck className="h-4 w-4" /> Situação comercial
            </div>
            <p className="mt-3 text-base font-extrabold text-white">
              {!workspaceResolved ? (status === 'loading' ? 'Validando acesso...' : 'Sem setor autorizado') : (billingLoading ? 'Consultando conta...' : accountStatus(account?.status))}
            </p>
            {workspaceResolved && !billingLoading && account && (
              <p className="mt-1 text-xs text-slate-400">
                {exempt ? 'Isenção preservada. Nenhum pagamento necessário.' :
                  `Valor atual cadastrado: ${money(account.monthlyPriceCents)}/mês.`}
              </p>
            )}
            {workspaceResolved && !billingLoading && !account && (
              <p className="mt-1 text-xs text-slate-400">
                Nenhum registro comercial acessível para esta sessão. Não é possível calcular cobrança.
              </p>
            )}
            {!workspaceResolved && (
              <p className="mt-1 text-xs text-slate-400">
                Não exibimos boletos ou cobranças sem validar o workspace autorizado.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Etapas do checkout InfinitePay">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <FileCheck2 className="h-5 w-5 text-cyan-200" aria-hidden />
            <p className="mt-2 text-xs font-bold text-white">1. Cobrança individual</p>
            <p className="mt-1 text-xs text-slate-400">Valor e competência confirmados no servidor.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <CreditCard className="h-5 w-5 text-cyan-200" aria-hidden />
            <p className="mt-2 text-xs font-bold text-white">2. Checkout seguro</p>
            <p className="mt-1 text-xs text-slate-400">Pagamento no ambiente da InfinitePay.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <BadgeCheck className="h-5 w-5 text-cyan-200" aria-hidden />
            <p className="mt-2 text-xs font-bold text-white">3. Confirmação</p>
            <p className="mt-1 text-xs text-slate-400">Conciliação pelo servidor, sem confiar apenas no retorno.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-testid="infinitepay-checkout-disabled"
            title="Cobranças reais ainda não foram habilitadas no EMPROVEX."
            className="cursor-not-allowed rounded-xl border border-cyan-300/15 bg-slate-600/40 px-5 py-3 text-sm font-bold text-slate-300"
          >
            <LockKeyhole className="mr-2 inline h-4 w-4" aria-hidden /> Pagar com InfinitePay
          </button>
          <p className="max-w-md text-xs text-slate-400">
            Disponível após certificação de identidade, Firestore e reconciliação.
            Esta tela não utiliza sua API Key e não cria links.
          </p>
        </div>
      </section>


    </div>
  );
}
