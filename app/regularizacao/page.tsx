'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeCheck, Copy, ExternalLink, Loader2, ShieldCheck, WalletCards } from 'lucide-react';
import { InfinitePayReadinessPanel } from '../../components/billing/InfinitePayReadinessPanel';
import { BillingPortalShell } from '../../components/billing/BillingPortalShell';
import { BillingReturnButton } from '../../components/billing/BillingReturnButton';
import { BILLING_PORTAL_TABS, type BillingPortalTab } from '../../lib/billing/billingPortalTabs';

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
  const [showManualMethods, setShowManualMethods] = useState(false);
  const [activeTab, setActiveTab] = useState<BillingPortalTab>('overview');
  const currentTab = BILLING_PORTAL_TABS.find((tab) => tab.id === activeTab) || BILLING_PORTAL_TABS[0];

  useEffect(() => {
    // Manual options are legacy and optional. Do not fetch private billing settings
    // on every visit to My Subscription or on a Pix return URL.
    if (!showManualMethods) return;

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
  }, [showManualMethods]);

  const copyPix = async () => {
    if (!info?.pixKey) return;
    await navigator.clipboard.writeText(info.pixKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <BillingPortalShell activeTab={activeTab} onTabChange={setActiveTab}>
    <main data-testid="billing-light-content" className="space-y-5 text-slate-800">
      <div className="w-full">
        <header className="overflow-hidden rounded-[1.65rem] border border-[#dfe7f1] bg-white shadow-[0_14px_44px_rgba(15,40,70,0.055)]">
          <div className="flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[#0a6556]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.17em]">EMPROVEX / Área do cliente</span>
              </div>
              <h1 className="mt-3 text-[28px] font-black tracking-tight text-[#142338] sm:text-[34px]">
                {currentTab.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                {currentTab.description}. Consulte informações do seu setor com segurança,
                sem misturar os dados e as ações das outras abas.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-100 bg-[#f0faf6] p-4 text-[#14644d]">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              <div>
                <p className="text-xs font-extrabold">Ambiente protegido</p>
                <p className="mt-1 max-w-52 text-[11px] leading-snug text-emerald-800/75">
                  Dados comerciais restritos ao setor autenticado.
                </p>
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#0b755d] via-[#168d78] to-[#c7dedd]" />
        </header>

        <div
          id="billing-active-panel"
          role="tabpanel"
          aria-labelledby={`billing-tab-${activeTab}`}
          data-testid="billing-active-panel"
          data-tab={activeTab}
          tabIndex={0}
        >
          <InfinitePayReadinessPanel activeTab={activeTab} onNavigate={setActiveTab} />

          {activeTab === 'help' && (
            <section data-testid="billing-help-content" className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#dfe8f0] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Como acompanhar minha assinatura?</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Na aba Minha assinatura você encontra a situação comercial do seu setor.
                  No Histórico financeiro aparecem somente as competências registradas,
                  com seus valores, vencimentos e estados. A ausência de registros não comprova pagamento.
                </p>
                <button type="button" className="mt-4 text-sm font-extrabold text-[#0a755d] hover:underline"
                  onClick={() => setActiveTab('history')}>
                  Consultar histórico financeiro
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-[#dfe8f0] bg-white p-6">
                  <h3 className="font-extrabold text-slate-900">Paguei, mas ainda aparece pendente</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Não pague novamente a mesma cobrança. Confira o comprovante no seu banco
                    e o recebimento na InfinitePay. O retorno do checkout não substitui a
                    confirmação do pagamento pelo servidor.
                  </p>
                </article>
                <article className="rounded-2xl border border-[#dfe8f0] bg-white p-6">
                  <h3 className="font-extrabold text-slate-900">Minha conta está isenta ou em teste</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    A isenção cadastrada permanece válida. O período de teste e seus prazos
                    são mostrados somente quando constam da conta do setor.
                    Não realize Pix sem uma cobrança individual emitida.
                  </p>
                </article>
                <article className="rounded-2xl border border-[#dfe8f0] bg-white p-6">
                  <h3 className="font-extrabold text-slate-900">Preciso de um comprovante</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Consulte o histórico da sua conta e os comprovantes do aplicativo bancário.
                    Esta versão não disponibiliza emissão automática de recibos fiscais.
                  </p>
                </article>
                <article className="rounded-2xl border border-[#dfe8f0] bg-white p-6">
                  <h3 className="font-extrabold text-slate-900">Onde encontro atendimento?</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Utilize o canal oficial de suporte informado no cadastro do EMPROVEX.
                    Nenhum contato não configurado será apresentado como oficial.
                  </p>
                </article>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-xs leading-relaxed text-[#17624e]">
                Os dados da assinatura são restritos ao workspace autenticado. Nunca forneça senhas,
                códigos de autenticação ou sua API Key em solicitações de suporte.
              </div>
            </section>
          )}

        {activeTab === 'payments' && (
          <>
        <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-xs leading-relaxed text-emerald-900">
          Nenhum dado de cartão, CVV ou credencial de pagamento é solicitado pelo EMPROVEX.
          Pagamentos autorizados são processados no ambiente externo do provedor, e o retorno
          ao site não comprova a baixa de uma competência sem validação pelo servidor.
        </p>
        <section id="formas-pagamento" data-testid="manual-payment-options" className="scroll-mt-24 mt-5 rounded-2xl border border-[#e2e8f1] bg-white p-5 shadow-[0_12px_36px_rgba(15,40,70,0.04)] sm:p-6">
          <button
            type="button"
            data-testid="manual-payment-options-toggle"
            aria-expanded={showManualMethods}
            onClick={() => setShowManualMethods((open) => !open)}
            className="text-sm font-extrabold text-[#0e6454] underline-offset-4 hover:underline"
          >
            {showManualMethods ? 'Ocultar formas antigas de regularização' : 'Consultar formas antigas de regularização'}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Consulta opcional aos meios manuais anteriores à InfinitePay. Não realize transferências
            com valores ou referências genéricas sem identificar sua cobrança individual.
          </p>
        </section>

        {showManualMethods && error && (
          <section data-testid="manual-payment-config-unavailable" role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-extrabold">Meios manuais de regularização indisponíveis</p>
            <p className="mt-2 leading-relaxed">
              Não foi possível consultar as instruções antigas de pagamento neste ambiente.
              Isso não altera a situação da sua assinatura exibida acima.
              Não faça um Pix usando dados antigos ou sem uma cobrança individual identificada.
            </p>
            <p className="mt-2 text-xs text-amber-900/65" data-testid="manual-payment-error-detail">
              Detalhe da consulta: {error}
            </p>
          </section>
        )}

        {showManualMethods && !info && !error && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0c725e]" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-500">Carregando instruções de regularização…</p>
          </section>
        )}

        {showManualMethods && info && (
          <>
            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoCard label="Plano" value={info.planName} />
              <InfoCard label="Condição" value="Preço definido individualmente na competência" />
              <InfoCard label="Vencimento" value={`${info.dueBusinessDay}º dia útil · ${info.gracePeriodDays} dias de tolerância`} />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.75rem] border border-[#e2e8f1] bg-white p-6">
                <div className="flex items-center gap-2 text-[#0b735f]">
                  <WalletCards className="h-5 w-5" aria-hidden="true" />
                  <h2 className="font-extrabold text-slate-900">Link de Pagamento</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  O pagamento será concluído no site externo configurado pela administração.
                </p>
                {info.paymentLinkUrl ? (
                  <a
                    href={info.paymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#076c56] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#0a8b71]"
                  >
                    Abrir Link de Pagamento
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Link de Pagamento ainda não configurado. Utilize o Pix ou o canal de suporte abaixo.
                  </p>
                )}
              </div>

              <div className="rounded-[1.75rem] border border-[#e2e8f1] bg-white p-6">
                <div className="flex items-center gap-2 text-[#0b735f]">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  <h2 className="font-extrabold text-slate-900">Pix</h2>
                </div>
                {info.pixKey ? (
                  <>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      {PIX_KEY_LABEL[info.pixKeyType] || 'Chave Pix'}
                    </p>
                    <div className="mt-2 break-all rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800">
                      {info.pixKey}
                    </div>
                    {info.pixRecipientName && (
                      <p className="mt-2 text-xs text-slate-400">Favorecido: {info.pixRecipientName}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyPix()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-[#08705b]"
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

            <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-6">
              <h2 className="font-extrabold text-slate-900">Precisa de ajuda?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {info.supportContact
                  ? <>Fale com o suporte pelo canal: <strong className="text-slate-800">{info.supportContact}</strong>.</>
                  : 'Utilize o canal de atendimento que foi fornecido no seu cadastro.'}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Esta página é apenas informativa e permanece separada do processamento financeiro do EMPROVEX.
              </p>
            </section>
          </>
        )}

          </>
        )}
        </div>

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500">
          <BillingReturnButton className="font-bold text-[#0b735f] hover:text-[#064c3f]">Voltar ao EMPROVEX</BillingReturnButton>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-800">Termos de Serviço</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacidade</Link>
          </div>
        </footer>
      </div>
    </main>
    </BillingPortalShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
