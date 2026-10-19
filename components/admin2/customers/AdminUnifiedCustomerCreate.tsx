'use client';

import { useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, CircleAlert, Clock3, KeyRound, Loader2, Plus, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { type UnifiedCustomerOnboardingInput, createPreviewOnboarding, ADMIN2_INITIAL_TRIAL_DAYS } from '../../../lib/admin2/customers/unifiedCustomerOnboarding';
import type { UnifiedPreviewRecord } from '../../../lib/admin2/customers/unifiedCustomerOnboarding';
import styles from '../shell/AdminCommandPreview.module.css';
import { deriveNewWorkspaceId } from '../../../lib/admin2/customers/customerDirectoryUx';
import { readCustomerWorkspacePage } from '../../../lib/admin2/customers/customerWorkspaceDirectory';

const EMPTY: UnifiedCustomerOnboardingInput = {
  sector: {
    workspaceId: '', workspaceName: '', ug: '', authorizedEmail: '', initialPassword: '',
    organizationName: '', organizationShortName: '', sectionName: 'Aprovisionamento',
    grantTrial: true,
  },
  commercial: {
    displayName: '', contactName: '', contactEmail: '', contactPhone: '',
    relationshipNotes: '', relationshipStatus: 'active',
  },
};

interface Props {
  existingPreviewIds: string[];
  existingPreviewUgs: string[];
  onPreviewCreated: (record: UnifiedPreviewRecord) => void;
  onManage: () => void;
  onDirectory: () => void;
}

export function AdminUnifiedCustomerCreate({ existingPreviewIds, existingPreviewUgs, onPreviewCreated, onManage, onDirectory }: Props) {
  const [input, setInput] = useState<UnifiedCustomerOnboardingInput>(EMPTY);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<UnifiedPreviewRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const setSector = (field: keyof UnifiedCustomerOnboardingInput['sector'], value: string) => {
    setInput(current => ({ ...current, sector: { ...current.sector, [field]: value } }));
  };
  const setCommercial = (field: keyof UnifiedCustomerOnboardingInput['commercial'], value: string) => {
    setInput(current => ({ ...current, commercial: { ...current.commercial, [field]: value } }));
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Fase local segura: nunca chamar o provisionamento real nem Auth.signUp.
      // Preview gera os três documentos coerentes, mas não grava nenhum deles.
      const workspaceId = deriveNewWorkspaceId(input.sector.ug);
      const preview = createPreviewOnboarding({
        ...input,
        sector: { ...input.sector, workspaceId },
      });
      if (existingPreviewIds.includes(preview.workspace.id) || existingPreviewUgs.includes(preview.workspace.ug || '')) {
        throw new Error('Esta UG já possui um workspace de teste nesta sessão.');
      }
      // Checagem de duplicidade pontual no diretório real: uma leitura por envio,
      // nunca a cada tecla. A UG já possui índice de unicidade no provisionamento.
      const existing = await readCustomerWorkspacePage({ field: 'ug', term: preview.workspace.ug || '' }, null);
      if (existing.rows.length) {
        throw new Error('Esta UG já possui workspace cadastrado. Procure-o no diretório.');
      }
      onPreviewCreated(preview);
      setCreated(preview);
      setInput(EMPTY); // Descarta a credencial inicial sem guardar em estado de gestão.
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível validar o cadastro unificado.');
    } finally {
      setBusy(false);
    }
  };
  if (created) {
    return <section className={styles.sectionCard + ' space-y-5 p-6'} data-testid="admin2-unified-preview-result">
      <div className="flex items-center gap-3 text-emerald-700">
        <CheckCircle2 className="h-8 w-8" />
        <div><h2 className="text-lg font-black">Simulação de cadastro concluída</h2>
          <p className="text-xs text-[#657b98]">Nenhum workspace ou usuário Firebase foi criado de verdade.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Cliente comercial', created.commercialCustomer.displayName],
          ['Setor / UG', created.workspace.name + ' · ' + created.workspace.ug],
          ['Assinatura', 'Trial de 30 dias'],
        ].map(([title,value]) => <div key={title} className="rounded-xl border border-[#d5e3f4] bg-[#f7faff] p-4">
          <p className="text-[11px] text-[#6982a3]">{title}</p><p className="mt-2 break-words text-[13px] font-bold text-[#18365c]">{value}</p>
        </div>)}
      </div>
      <p className="text-[11px] text-[#64809f]">Trial de {ADMIN2_INITIAL_TRIAL_DAYS} dias · Plano Completo R$ 70/mês após conversão administrativa · Sem cobrança automática.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onDirectory} data-testid="admin2-see-preview-directory"
          className="rounded-xl bg-[#19519b] px-5 py-3 text-xs font-bold text-white">Ver no diretório de workspaces</button>
        <button type="button" onClick={onManage} className="rounded-xl border border-[#c6d9ee] bg-white px-5 py-3 text-xs font-bold text-[#275a98]">Abrir Gestão do cliente</button>
        <button type="button" onClick={() => { setCreated(null); setInput(EMPTY); }} className="rounded-xl border border-[#c6d9ee] bg-white px-5 py-3 text-xs font-bold text-[#275a98]">Novo cadastro</button>
      </div>
    </section>;
  }

  return (
    <section className={styles.sectionCard + ' space-y-5 p-5 sm:p-7'} data-testid="admin2-unified-create">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={styles.sectionEyebrow + ' font-mono'}>ONBOARDING / CLIENTE + WORKSPACE</p>
          <h2 className="mt-2 text-[19px] font-black text-[#18365a]">Cadastrar cliente e workspace</h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[#647c9b]">Um workspace corresponde a um cliente comercial, com assinatura independente. O trial padrão será de 30 dias.</p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">Trial padrão · 30 dias</span>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-5 text-amber-800">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <p><strong>Prévia sem gravação:</strong> este formulário simula os registros de cliente, workspace e trial somente na memória desta página. Não cria credenciais nem contas reais. Use dados fictícios; a persistência somente será habilitada após homologação e aprovação específica.</p>
      </div>
      <form onSubmit={save} className="space-y-5">
        <fieldset className="rounded-2xl border border-[#dce7f5] bg-white p-4 sm:p-5">
          <legend className="px-2 text-xs font-extrabold text-[#25588e]"><Building2 className="mr-2 inline h-4 w-4" /> 1. Identificação do setor</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ['workspaceName','Nome do workspace','Aprovisionamento da unidade','text',120],
              ['ug','UG da OM','Seis dígitos','text',6],
              ['organizationName','Organização Militar','Nome completo da OM','text',160],
              ['organizationShortName','Sigla da OM','Opcional','text',30],
              ['sectionName','Seção / Setor','Aprovisionamento','text',120],
              ['authorizedEmail','E-mail da conta operacional','setor@exemplo.com','email',160],
              ['initialPassword','Senha inicial do setor (simulada)','Mínimo de oito caracteres','password',128],
            ] as const).map(([key,title,placeholder,type,max]) => (
              <label key={key} className="space-y-1.5 text-[11px] font-bold text-[#355579]">
                <span>{title}</span>
                <input required={key!=='organizationShortName'} type={type} maxLength={max} autoComplete="off"
                  className={styles.demoInput + ' h-11 w-full px-3 text-xs'}
                  value={input.sector[key] || ''} placeholder={placeholder}
                  onChange={e => setSector(key,e.target.value)} />
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#7489a2]">O código interno do workspace será gerado automaticamente a partir da UG. Não é necessário criar outro identificador.</p>
        </fieldset>
        <fieldset className="rounded-2xl border border-[#dce7f5] bg-white p-4 sm:p-5">
          <legend className="px-2 text-xs font-extrabold text-[#25588e]"><UserRound className="mr-2 inline h-4 w-4" /> 2. Relacionamento comercial</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ['displayName','Nome comercial do cliente','Ex.: Aprovisionamento da OM'],
              ['contactName','Nome do responsável','Contato comercial'],
              ['contactEmail','E-mail de contato','contato@exemplo.com'],
              ['contactPhone','Telefone','Opcional'],
            ] as const).map(([key,title,placeholder])=>(
              <label key={key} className="space-y-1.5 text-[11px] font-bold text-[#355579]">
                <span>{title}</span>
                <input required={key==='displayName'} maxLength={key==='contactPhone'?30:120}
                  type={key==='contactEmail'?'email':'text'} className={styles.demoInput + ' h-11 w-full px-3 text-xs'} value={input.commercial[key]}
                  onChange={e=>setCommercial(key,e.target.value)} placeholder={placeholder} />
              </label>
            ))}
          </div>
          <label className="mt-4 block space-y-2 text-[11px] font-bold text-[#355579]">
            <span>Observações de relacionamento (não incluir dados sigilosos)</span>
            <textarea rows={3} maxLength={1000} className={styles.demoInput + ' w-full p-3 text-xs'}
              value={input.commercial.relationshipNotes}
              onChange={e=>setCommercial('relationshipNotes',e.target.value)} />
          </label>
        </fieldset>
        <div className="rounded-2xl border border-[#c8ddf3] bg-[#eff6ff] p-4">
          <p className="flex items-center gap-2 text-xs font-black text-[#1c508e]"><WalletCards className="h-4 w-4" /> 3. Assinatura inicial</p>
          <p className="mt-2 text-[12px] text-[#3d658f]">Trial automático de <strong>30 dias</strong> · Plano Completo <strong>R$ 70/mês</strong> · Pagamento não exigido durante o teste.</p>
          <p className="mt-1 text-[11px] text-[#6683a3]">VIP, prorrogações, situação comercial e pagamentos serão gerenciados depois, na aba Gestão do cliente.</p>
        </div>
        {error && <p role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><CircleAlert className="h-4 w-4 shrink-0"/>{error}</p>}
        <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#174c98] px-6 text-xs font-bold text-white disabled:opacity-50">
          {busy?<Loader2 className="h-4 w-4 animate-spin" />:<Plus className="h-4 w-4" />}
          Simular cadastro + workspace + trial
        </button>
      </form>
    </section>
  );
}
