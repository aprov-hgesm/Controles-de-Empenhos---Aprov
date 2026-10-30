'use client';

export interface BillingPeriodTimeline {
  billingPeriodPolicy?: string;
  initialActivationPending?: boolean;
  periodStartsAt?: string | null;
  periodEndsAt?: string | null;
  nextRenewalAt?: string | null;
  renewalGraceUntil?: string | null;
  reason?: string;
  referenceMonth?: string;
}

function dateBR(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

export function BillingAnniversaryCard({ period }: { period: BillingPeriodTimeline | null }) {
  if (!period) return null;
  if (period.billingPeriodPolicy !== 'payment_anniversary_v2') {
    return (
      <section data-testid="billing-legacy-period" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Datas da assinatura</h3>
        <p className="mt-1 text-xs text-slate-600">
          Esta contratação mantém as datas e condições anteriormente registradas.
          A nova política de aniversário não altera retroativamente períodos já contratados.
        </p>
      </section>
    );
  }

  if (period.initialActivationPending) {
    return (
      <section data-testid="billing-first-payment-pending" className="mt-4 rounded-xl border border-sky-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Quando começa meu primeiro mês?</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">
          Após o encerramento do teste gratuito, o primeiro mês pago começa somente quando a
          InfinitePay confirmar a mensalidade integral. Se a mensalidade estiver dividida,
          o início será a confirmação da última cota. A partir dessa data, o EMPROVEX fixa
          sua renovação mensal; não são perdidos dias enquanto a primeira cobrança está pendente.
          A primeira mensalidade não recebe os dez dias de tolerância de renovação.
        </p>
      </section>
    );
  }

  if (!period.periodStartsAt || !period.periodEndsAt) return null;
  return (
    <section data-testid="billing-anniversary-period" className="mt-4 rounded-2xl border border-sky-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900">Período de uso e renovação</h3>
        <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800">
          Aniversário mensal
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><p className="text-[11px] font-semibold text-slate-500">Início do período</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{dateBR(period.periodStartsAt)}</p></div>
        <div><p className="text-[11px] font-semibold text-slate-500">Término do período</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{dateBR(period.periodEndsAt)}</p></div>
        <div><p className="text-[11px] font-semibold text-slate-500">
          {period.reason === 'paid' ? 'Próxima renovação' : 'Renovação desta competência'}
          </p><p className="mt-1 text-sm font-bold text-slate-900">{dateBR(period.nextRenewalAt)}</p></div>
      </div>
      {period.renewalGraceUntil && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Renovação pendente: o acesso pode permanecer ativo até {dateBR(period.renewalGraceUntil)}
          durante a tolerância de 10 dias corridos, se a mensalidade anterior estiver quitada.
          Pagar durante a tolerância não altera a data de aniversário.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Cada mensalidade cobre um mês de calendário, não 30 dias fixos.
        Os pagamentos da mesma mensalidade — inclusive cotas compartilhadas — não geram
        datas de renovação diferentes para integrantes do mesmo setor.
      </p>
    </section>
  );
}
