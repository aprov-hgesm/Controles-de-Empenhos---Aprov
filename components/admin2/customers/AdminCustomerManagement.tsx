'use client';

import { useEffect, useState } from 'react';
import {
  Activity, BadgeCheck, Building2, CalendarClock, CircleAlert,
  CreditCard, FilePenLine, Loader2, LockKeyhole, RefreshCw,
  Search, ShieldCheck, UserRound, WalletCards,
} from 'lucide-react';
import type { BillingAccountStatus } from '../../../lib/billing';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import type { Workspace } from '../../../lib/platformIdentity';
import type { UpdateSectorWorkspaceInput } from '../../../lib/platformAdminStore';
import { updateSectorWorkspaceProfile } from '../../../lib/platformAdminStore';
import { HGESM_SECTOR_EMAIL } from '../../../lib/hgesmWorkspace';
import { previewUpdatedWorkspace } from '../../../lib/admin2/customers/workspaceProfileEditContract';
import { AdminWorkspaceProfileEditor } from './AdminWorkspaceProfileEditor';
import { commercialEmulatorWritesEnabled } from '../../../lib/admin2/customers/commercialCustomerRepository';
import { grantBillingTrial, setBillingCommercialStatus, setBillingExemption } from '../../../lib/platformBillingStore';
import {
  readCustomerBilling, readCustomerWorkspacePage,
} from '../../../lib/admin2/customers/customerWorkspaceDirectory';
import {
  customerBillingLabel, formatCustomerCurrency, formatCustomerDate,
  type CustomerBillingSnapshot, type CustomerWorkspaceRecord,
} from '../../../lib/admin2/customers/customerWorkspaceContract';
import { buildCustomerWorkspaceRecord } from '../../../lib/admin2/customers/customerWorkspaceContract';
import type { UnifiedPreviewRecord } from '../../../lib/admin2/customers/unifiedCustomerOnboarding';
import type { CommercialCustomer } from '../../../lib/admin2/customers/commercialCustomerContract';
import styles from '../shell/AdminCommandPreview.module.css';

interface Props {
  previews: UnifiedPreviewRecord[];
  commercialDrafts: CommercialCustomer[];
  workspaceEdits: Record<string, CustomerWorkspaceRecord>;
  onWorkspaceEdit: (record: CustomerWorkspaceRecord) => void;
  onEditContacts: () => void;
  onView360: (workspace: CustomerWorkspaceRecord) => void;
}

const MANAGEMENT_OPTIONS: Array<{ status: BillingAccountStatus; title: string; description: string }> = [
  { status: 'trial', title: 'Conceder trial (30 dias)', description: 'Novo período de teste, sem cobrança automática' },
  { status: 'active', title: 'Ativar plano pago', description: 'Plano Completo — R$ 70/mês, confirmação manual' },
  { status: 'exempt', title: 'Conceder VIP / Isenção', description: 'Isenção por decisão administrativa' },
  { status: 'pending', title: 'Marcar como pendente', description: 'Pendência comercial, sem bloqueio automático' },
  { status: 'canceled', title: 'Cancelar assinatura', description: 'Situação comercial; não apaga o workspace' },
];

export function AdminCustomerManagement({ previews, commercialDrafts, workspaceEdits, onWorkspaceEdit, onEditContacts, onView360 }: Props) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [selected, setSelected] = useState<CustomerWorkspaceRecord | null>(null);
  const [billing, setBilling] = useState<CustomerBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [override, setOverride] = useState<CustomerBillingSnapshot | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<BillingAccountStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(false);

  const lookup = async (id: string) => {
    const normalized = id.trim().toLowerCase();
    if (!normalized) { setError('Informe o ID do workspace.'); return; }
    setError('');
    setSelected(null);
    setBilling(null);
    setOverride(null);
    setHistory([]);
    setConfirm(null);
    setLoading(true);
    try {
      const local = previews.find(entry => entry.workspace.id === normalized);
      if (local) {
        setSelected(workspaceEdits[normalized] || buildCustomerWorkspaceRecord(local.workspace.id, local.workspace));
        setBilling({
          status: local.billing.status,
          monthlyPriceCents: local.billing.monthlyPriceCents,
          trialEndsAt: local.billing.trialEndsAt,
          paymentRequired: local.billing.paymentRequired,
          exemptionSource: local.billing.exemptionSource || null,
        });
      } else {
        const page = await readCustomerWorkspacePage({ field: 'workspaceId', term: normalized }, null);
        const found = page.rows.find(item => item.workspaceId === normalized);
        if (!found) throw new Error('Workspace não encontrado. Confira o ID informado.');
        const summary = await readCustomerBilling(normalized);
        setSelected(workspaceEdits[normalized] || found);
        setBilling(summary);
      }
      setWorkspaceId(normalized);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o workspace.');
    } finally {
      setLoading(false);
    }
  };

  const saveWorkspace = async (input: UpdateSectorWorkspaceInput) => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const isLocal = previews.some(p => p.workspace.id === selected.workspaceId);
      let updated: CustomerWorkspaceRecord;
      if (commercialEmulatorWritesEnabled && !isLocal) {
        // Motor já existente: transação entre workspace, conta, UG e auditoria.
        // Exclusivamente Firebase Emulator demo-*; nunca grava no projeto real.
        const saved = await updateSectorWorkspaceProfile(input, HGESM_SECTOR_EMAIL);
        updated = buildCustomerWorkspaceRecord(saved.id, saved);
      } else {
        updated = previewUpdatedWorkspace(selected, input, new Date().toISOString());
      }
      setSelected(updated);
      onWorkspaceEdit(updated);
      setHistory(current => ['Dados institucionais atualizados ' +
        (commercialEmulatorWritesEnabled && !isLocal ? 'no Emulator' : 'em simulação local'), ...current]);
      setEditingWorkspace(false);
    } finally {
      setSaving(false);
    }
  };

  const applyManagementChange = async (status: BillingAccountStatus) => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      const isPreview = previews.some(p => p.workspace.id === selected.workspaceId);
      if (commercialEmulatorWritesEnabled && !isPreview) {
        // Dev-only Firebase Emulator. Reaproveita o motor de billing e auditoria
        // existentes, sem segunda regra comercial nem chamada ao servidor real.
        const actor = auth.currentUser?.email;
        if (!actor) throw new Error('A sessão administrativa do Emulator não foi encontrada.');
        const wsSnapshot = await getDoc(doc(db, 'workspaces', selected.workspaceId));
        if (!wsSnapshot.exists()) throw new Error('Workspace não encontrado no Emulator.');
        const workspace = wsSnapshot.data() as Workspace;
        if (workspace.id !== selected.workspaceId) throw new Error('Identidade do workspace inconsistente.');
        if (status === 'trial') {
          await grantBillingTrial(workspace, actor, 30);
        } else if (status === 'exempt') {
          await setBillingExemption(workspace, true, actor);
        } else {
          const current = await readCustomerBilling(workspace.id);
          if (current?.status === 'exempt') await setBillingExemption(workspace, false, actor);
          await setBillingCommercialStatus(workspace, status, actor);
        }
        setBilling(await readCustomerBilling(workspace.id));
        setOverride(null);
        setHistory(current => ['Assinatura atualizada no Firebase Emulator — ' + status, ...current]);
      } else {
        // Localhost comum: simula status em memória e NÃO escreve Firestore real.
        const base = override || billing;
        const now = new Date();
        const trialEndsAt = status === 'trial'
          ? new Date(now.getTime() + 30 * 86400_000).toISOString()
          : base?.trialEndsAt || null;
        setOverride({
          status, trialEndsAt,
          monthlyPriceCents: status === 'exempt' ? 0 : 7000,
          exemptionSource: status === 'exempt' ? 'manual' : null,
          paymentRequired: false,
        });
        const title = MANAGEMENT_OPTIONS.find(action => action.status === status)?.title || status;
        setHistory(current => [new Date().toLocaleTimeString('pt-BR') + ' — ' + title + ' (simulação local)', ...current]);
      }
      setConfirm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha na alteração comercial.');
    } finally {
      setSaving(false);
    }
  };

  const effective = override || billing;
  const commercial = commercialDrafts.find(d => d.workspaceId === selected?.workspaceId);
  const isPreviewWorkspace = previews.some(p => p.workspace.id === selected?.workspaceId);

  return <div className="space-y-4" data-testid="admin2-customer-management">
    <section className={styles.sectionCard + ' p-5 sm:p-6'}>
      <p className={styles.sectionEyebrow + ' font-mono'}>ADMINISTRAÇÃO / GESTÃO DE CLIENTES</p>
      <h2 className="mt-2 text-[19px] font-black text-[#17365a]">Gestão do cliente e assinatura</h2>
      <p className="mt-2 max-w-2xl text-xs leading-6 text-[#637b9a]">Acompanhamento comercial, gestão do plano e acesso operacional em ambientes separados. Cada workspace tem sua assinatura independente.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className={styles.demoInput + ' h-11 min-w-0 flex-1 px-3 text-xs'}
          value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
          aria-label="Pesquisar workspace para administrar" placeholder="ID do workspace existente ou criado na simulação"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(workspaceId); } }} />
        <button type="button" disabled={loading} onClick={() => void lookup(workspaceId)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#18519a] px-5 text-xs font-bold text-white disabled:opacity-50">
          {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>} Localizar
        </button>
      </div>
      {previews.length > 0 && <div className="mt-4">
        <p className="text-[11px] font-bold text-[#5f7898]">Cadastros simulados nesta sessão</p>
        <div className="mt-2 flex flex-wrap gap-2">{previews.map(entry =>
          <button key={entry.workspace.id} type="button" onClick={() => void lookup(entry.workspace.id)}
            className="rounded-xl border border-[#cbdcf1] bg-[#f3f8ff] px-3 py-2 text-[11px] font-bold text-[#2b6099]">
            {entry.workspace.name} · {entry.workspace.id}
          </button>
        )}</div>
      </div>}
      {error && <p role="alert" className="mt-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><CircleAlert className="h-4 w-4 shrink-0"/>{error}</p>}
    </section>
    {selected && <>
      {editingWorkspace && <AdminWorkspaceProfileEditor
        key={selected.workspaceId}
        workspace={selected}
        saving={saving}
        persistentInEmulator={commercialEmulatorWritesEnabled && !isPreviewWorkspace}
        onClose={() => setEditingWorkspace(false)}
        onSave={saveWorkspace}
      />}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-[#fffbef] p-4 text-[11px] leading-6 text-amber-900">
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0"/>
        <p><strong>{commercialEmulatorWritesEnabled && !isPreviewWorkspace ? 'Homologação Firebase Emulator:' : 'Gestão em modo de simulação:'}</strong> {commercialEmulatorWritesEnabled && !isPreviewWorkspace
          ? 'Alterações de assinatura são gravadas SOMENTE no Emulator, com auditoria. Nenhuma mudança na produção.'
          : 'As alterações comerciais são apenas simuladas em memória, sem gravação no Firebase.'} {isPreviewWorkspace ? 'Este workspace também é fictício.' : 'A identificação do workspace foi consultada de forma protegida.'} Credenciais e acesso operacional não são alterados nesta aba.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={styles.sectionCard + ' p-5'}>
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[#1e3d63]"><Building2 className="h-4 w-4"/> Cliente e workspace</h3>
          <dl className="mt-4 space-y-3 text-xs">
            {[
              ['Workspace',selected.name],
              ['ID',selected.workspaceId],
              ['UG',selected.ug || 'Não cadastrada'],
              ['OM',selected.organizationName || 'Não cadastrada'],
              ['Acesso operacional',selected.authorizedEmail || 'Não informado'],
              ['Responsável comercial',commercial?.contactName || 'Não cadastrado'],
              ['E-mail comercial',commercial?.contactEmail || 'Não informado'],
            ].map(([key,val]) => <div key={key} className="flex flex-wrap justify-between gap-3 border-b border-[#e7eef8] pb-2">
              <dt className="font-semibold text-[#7487a0]">{key}</dt><dd className="max-w-[65%] break-all font-bold text-[#20456c]">{val}</dd>
            </div>)}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" data-testid="admin2-edit-workspace" onClick={() => setEditingWorkspace(current => !current)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1d579b] px-3 py-2.5 text-[11px] font-bold text-white">
              <Building2 className="h-4 w-4" /> Editar dados do workspace
            </button>
            <button onClick={onEditContacts} type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#c8d8eb] bg-white px-3 py-2.5 text-[11px] font-bold text-[#265995]">
              <FilePenLine className="h-4 w-4"/> Editar dados comerciais
            </button>
            <button onClick={() => onView360(selected)} type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#c8d8eb] bg-white px-3 py-2.5 text-[11px] font-bold text-[#265995]">
              <Activity className="h-4 w-4"/> Abrir Ficha 360°
            </button>
          </div>
        </section>
        <section className={styles.sectionCard + ' p-5'}>
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[#1e3d63]"><WalletCards className="h-4 w-4"/> Assinatura do workspace</h3>
          <div className="mt-4 rounded-xl border border-[#d5e5f5] bg-[#f0f6ff] p-4">
            <p className="text-[11px] text-[#667f9e]">Situação {override ? 'simulada' : 'registrada'}</p>
            <p className="mt-1 text-lg font-extrabold text-[#245892]">{customerBillingLabel(effective)}</p>
            <p className="mt-2 text-xs text-[#4c6e93]">{effective?formatCustomerCurrency(effective.monthlyPriceCents):'Não configurada'} / mês · Trial até {formatCustomerDate(effective?.trialEndsAt||null)}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {MANAGEMENT_OPTIONS.map(action=><button key={action.status} type="button" onClick={()=>setConfirm(action.status)}
              className="rounded-xl border border-[#d3e1f2] bg-white p-3 text-left text-[11px] text-[#345977] transition hover:bg-[#f3f8ff]">
              <span className="block font-extrabold text-[#245792]">{action.title}</span>
              <span className="mt-1 block leading-4 text-[#7789a0]">{action.description}</span>
            </button>)}
          </div>
          <a href="/admin?tab=assinaturas"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#cbdbea] bg-white px-4 py-2 text-[11px] font-bold text-[#285e9d] hover:bg-[#edf5ff]">
            Abrir painel completo de assinaturas existente
          </a>
          {confirm && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-[#2e5380]" data-testid="admin2-subscription-confirm">
            <p>{commercialEmulatorWritesEnabled && !isPreviewWorkspace ? 'Aplicar no Emulator' : 'Simular'}: <strong>{MANAGEMENT_OPTIONS.find(option=>option.status===confirm)?.title}</strong>?</p>
            <p className="mt-1 text-[11px]">Nunca altera dados produtivos nem o acesso operacional.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={saving} onClick={()=>void applyManagementChange(confirm)} className="rounded-lg bg-[#19529c] px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? 'Aplicando...' : commercialEmulatorWritesEnabled && !isPreviewWorkspace ? 'Confirmar no Emulator' : 'Confirmar simulação'}</button>
              <button type="button" onClick={()=>setConfirm(null)} className="rounded-lg border border-blue-200 bg-white px-4 py-2">Cancelar</button>
            </div>
          </div>}
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={styles.sectionCard + ' p-5'}>
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[#1e3d63]"><LockKeyhole className="h-4 w-4"/> Segurança e acesso do usuário</h3>
          <p className="mt-3 text-xs leading-6 text-[#667d9d]">A conta de autenticação e a assinatura comercial têm controles diferentes. Redefinição de senha, suspensão do acesso operacional e encerramento de sessões exigirão os endpoints administrativos seguros já existentes, confirmação e auditoria. **Nenhuma dessas ações é executada nesta prévia.**</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled type="button" className="rounded-xl border border-[#d9e4f0] bg-[#f5f8fc] px-3 py-3 text-[11px] font-bold text-[#8899ac]">Redefinir senha · indisponível</button>
            <button disabled type="button" className="rounded-xl border border-[#d9e4f0] bg-[#f5f8fc] px-3 py-3 text-[11px] font-bold text-[#8899ac]">Suspender acesso · indisponível</button>
          </div>
        </section>
        <section className={styles.sectionCard + ' p-5'}>
          <h3 className="flex items-center gap-2 text-[13px] font-black text-[#1e3d63]"><CalendarClock className="h-4 w-4"/> Histórico de decisões nesta prévia</h3>
          {history.length === 0?<p className="mt-3 text-xs leading-6 text-[#758ba5]">Nenhuma ação simulada nesta sessão.</p>:
            <ul className="mt-3 space-y-2">{history.map((item,i)=><li key={i} className="rounded-lg bg-[#f0f6ff] px-3 py-2 text-[11px] text-[#3d638e]">{item}</li>)}</ul>}
          <p className="mt-4 text-[10px] leading-5 text-[#7b8da5]">Ações reais deverão gerar eventos na auditoria da plataforma. Este histórico temporário não substitui a trilha oficial.</p>
        </section>
      </div>
    </>}
  </div>;
}
