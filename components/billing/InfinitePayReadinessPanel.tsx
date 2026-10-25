'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowUpRight, BadgeCheck, CircleAlert, Clock3, CreditCard,
  FileCheck2, LockKeyhole, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';

import { auth } from '../../lib/firebase';
import { resolveWorkspaceContext, type ResolvedWorkspaceContext } from '../../lib/workspaceContext';
import { resolveBillingWorkspaceContext } from '../../lib/billing/resolveBillingWorkspaceContext';
import { useWorkspaceBillingAccount } from '../../hooks/useWorkspaceBillingAccount';
import { inspectInfinitePayReturn } from '../../lib/billing/infinitepayReturnStatus.mjs';

const PRICING = [
  { months: '1º ao 3º', cents: 2990 },
  { months: '4º ao 6º', cents: 3990 },
  { months: '7º ao 9º', cents: 4990 },
  { months: '10º ao 12º', cents: 5990 },
  { months: '13º em diante', cents: 6990 },
] as const;

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
  // Local, display-only preview for the exempt test workspace.
  // This state never updates billingAccount, an invoice, Firestore, or provider checkout.
  const [simulateFirstMonth, setSimulateFirstMonth] = useState(false);

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
  const showLocalSimulation = process.env.NODE_ENV === 'development' && workspaceResolved && exempt;
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

        {showLocalSimulation && (
          <div className="mt-4 rounded-xl border border-violet-300/25 bg-violet-400/[0.07] p-4" data-testid="billing-local-demo">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-violet-100">Laboratório local · conta de teste isenta</p>
                <p className="mt-1 text-xs text-slate-300">
                  Apenas para visualizar a jornada de um novo assinante, sem alterar sua conta real.
                </p>
              </div>
              <button
                type="button"
                data-testid="billing-local-demo-toggle"
                aria-pressed={simulateFirstMonth}
                onClick={() => setSimulateFirstMonth((active) => !active)}
                className="rounded-lg border border-violet-300/30 bg-violet-200/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-200/20"
              >
                {simulateFirstMonth ? 'Encerrar simulação' : 'Simular novo assinante'}
              </button>
            </div>
            {simulateFirstMonth && (
              <div role="status" data-testid="billing-local-demo-result" className="mt-4 rounded-xl border border-white/10 bg-[#0b172b]/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">Simulação visual — não é uma cobrança</p>
                <p className="mt-2 text-xl font-black text-white">{money(2990)} <span className="text-xs font-semibold text-slate-300">/ mês · meses 1–3</span></p>
                <p className="mt-1 text-xs text-slate-300">
                  Primeiro ciclo após os 30 dias gratuitos. Nenhuma competência, checkout ou pagamento foi criado.
                  A conta real continua <strong>isenta</strong>.
                </p>
              </div>
            )}
          </div>
        )}

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

      <section className="rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-200" aria-hidden />
          <h2 className="text-sm font-extrabold text-white">Escalonamento previsto para novos clientes</h2>
          <span className="rounded-full bg-blue-400/[0.10] px-2.5 py-1 text-[10px] font-bold text-blue-100">Proposta R1</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Cada novo cliente começa na primeira faixa após o teste gratuito de 30 dias.
          A tabela não reprecifica contas existentes, isenções ou competências já emitidas.
          Não é uma oferta ativa enquanto a integração estiver em homologação.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PRICING.map((tier) => (
            <div key={tier.months} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
              <p className="text-[10px] font-semibold text-slate-400">{tier.months}</p>
              <p className="mt-2 text-base font-black text-white">{money(tier.cents)}</p>
              <p className="text-[10px] text-slate-500">por mês</p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Para o cliente atual, somente os valores do contrato e das competências efetivamente registradas serão exigíveis.
        </p>
      </section>
    </div>
  );
}
