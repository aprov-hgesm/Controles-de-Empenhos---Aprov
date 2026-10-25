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
import { InfinitePayPilotPanel, type PilotReturnParams } from './InfinitePayPilotPanel';

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
  const [returnParams, setReturnParams] = useState<PilotReturnParams | null>(null);
  // Local, display-only preview for the exempt test workspace.
  // This state never updates billingAccount, an invoice, Firestore, or provider checkout.
  const [simulateFirstMonth, setSimulateFirstMonth] = useState(false);

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
      window.history.replaceState(window.history.state, '', result.cleanedPath);
    }
  }, []);

  const workspaceResolved = context.status === 'sector';
  const exempt = account?.status === 'exempt';
  const showLocalSimulation = process.env.NODE_ENV === 'development' && workspaceResolved && exempt;
  return (
    <div data-testid="infinitepay-regularization-panel" className="mt-5 space-y-5">
      {returnNotice && (
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

      <section className="overflow-hidden rounded-[1.65rem] border border-[#dfe8f0] bg-gradient-to-br from-white via-white to-[#f3faf7] p-5 shadow-[0_16px_45px_rgba(15,40,70,0.055)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-[#0b725d]">
            <CreditCard className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-extrabold text-[#13263a]">Minha assinatura e pagamentos</h2>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
            InfinitePay em homologação
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Acompanhe o seu plano e visualize como funcionará o checkout protegido da InfinitePay.
          Nenhuma cobrança é gerada por este painel.
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

        {showLocalSimulation && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4" data-testid="billing-local-demo">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold text-violet-900">Laboratório local · conta de teste isenta</p>
                <p className="mt-1 text-xs text-slate-600">
                  Apenas para visualizar a jornada de um novo assinante, sem alterar sua conta real.
                </p>
              </div>
              <button
                type="button"
                data-testid="billing-local-demo-toggle"
                aria-pressed={simulateFirstMonth}
                onClick={() => setSimulateFirstMonth((active) => !active)}
                className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100"
              >
                {simulateFirstMonth ? 'Encerrar simulação' : 'Simular novo assinante'}
              </button>
            </div>
            {simulateFirstMonth && (
              <div role="status" data-testid="billing-local-demo-result" className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Simulação visual — não é uma cobrança</p>
                <p className="mt-2 text-xl font-black text-[#13263a]">{money(2990)} <span className="text-xs font-semibold text-slate-600">/ mês · meses 1–3</span></p>
                <p className="mt-1 text-xs text-slate-600">
                  Primeiro ciclo após os 30 dias gratuitos. Nenhuma competência, checkout ou pagamento foi criado.
                  A conta real continua <strong>isenta</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        <InfinitePayPilotPanel authorizedWorkspace={workspaceResolved && status === 'authenticated'} returnParams={returnParams} />

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

      <section id="precos" className="scroll-mt-24 rounded-[1.65rem] border border-[#dfe8f0] bg-white p-5 shadow-[0_12px_38px_rgba(15,40,70,0.04)] sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#236e94]" aria-hidden />
          <h2 className="text-sm font-extrabold text-[#13263a]">Escalonamento previsto para novos clientes</h2>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#275a87]">Proposta R1</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Cada novo cliente começa na primeira faixa após o teste gratuito de 30 dias.
          A tabela não reprecifica contas existentes, isenções ou competências já emitidas.
          Não é uma oferta ativa enquanto a integração estiver em homologação.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PRICING.map((tier) => (
            <div key={tier.months} className="rounded-xl border border-slate-200 bg-[#f9fbfd] px-3 py-4">
              <p className="text-[10px] font-semibold text-slate-500">{tier.months}</p>
              <p className="mt-2 text-base font-black text-[#13263a]">{money(tier.cents)}</p>
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
