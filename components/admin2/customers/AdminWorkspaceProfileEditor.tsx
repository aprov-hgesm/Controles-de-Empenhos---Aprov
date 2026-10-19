'use client';

import { useState, type FormEvent } from 'react';
import { Building2, LockKeyhole, Save, ShieldCheck, X } from 'lucide-react';
import type { UpdateSectorWorkspaceInput } from '../../../lib/platformAdminStore';
import type { CustomerWorkspaceRecord } from '../../../lib/admin2/customers/customerWorkspaceContract';
import {
  workspaceEditInitialValues, validateWorkspaceProfileEdit,
} from '../../../lib/admin2/customers/workspaceProfileEditContract';
import styles from '../shell/AdminCommandPreview.module.css';

interface Props {
  workspace: CustomerWorkspaceRecord;
  saving: boolean;
  persistentInEmulator: boolean;
  onClose: () => void;
  onSave: (input: UpdateSectorWorkspaceInput) => Promise<void>;
}

export function AdminWorkspaceProfileEditor({ workspace, saving, persistentInEmulator, onClose, onSave }: Props) {
  const [form, setForm] = useState(() => workspaceEditInitialValues(workspace));
  const [error, setError] = useState('');
  const update = (field: keyof UpdateSectorWorkspaceInput, value: string) =>
    setForm(current => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateWorkspaceProfileEdit(workspace, form);
    if (errors.length) { setError(errors.join(' ')); return; }
    setError('');
    try { await onSave(form); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar os metadados.'); }
  };

  return <section className={styles.sectionCard + ' p-5 sm:p-6'} data-testid="admin2-workspace-editor">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#315f9a]">GESTÃO DO WORKSPACE</p>
        <h3 className="mt-2 text-[17px] font-black text-[#173659]">Editar dados institucionais</h3>
        <p className="mt-2 text-[11px] text-[#67809e]">Utiliza as mesmas restrições da Administração atual.</p>
      </div>
      <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar edição" className="rounded-lg border border-[#d1deef] bg-white p-2 text-[#58718e] disabled:opacity-50"><X className="h-4 w-4"/></button>
    </div>
    <div role="note" className="mt-4 flex gap-2 rounded-xl border border-[#cbdff3] bg-[#f0f6ff] p-3 text-[11px] leading-5 text-[#456995]">
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{persistentInEmulator ? 'Alterações persistirão somente no Firebase Emulator, com auditoria do sistema existente.' : 'Simulação local: alterações visíveis apenas nesta sessão, sem gravar no Firebase real.'} ID, e-mail de acesso e UG já cadastrada não podem ser modificados.</span>
    </div>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#d8e4f2] bg-[#f7faff] p-3">
          <span className="block text-[10px] font-bold text-[#7a8da4]">ID imutável</span>
          <span className="mt-1 block break-all font-mono text-[11px] font-bold text-[#234e82]">{workspace.workspaceId}</span>
        </div>
        <div className="rounded-xl border border-[#d8e4f2] bg-[#f7faff] p-3">
          <span className="block text-[10px] font-bold text-[#7a8da4]">E-mail operacional imutável</span>
          <span className="mt-1 block break-all text-[11px] font-bold text-[#234e82]">{workspace.authorizedEmail || 'Não cadastrado'}</span>
        </div>
        <div className="rounded-xl border border-[#d8e4f2] bg-[#f7faff] p-3">
          <span className="block text-[10px] font-bold text-[#7a8da4]">Situação de acesso</span>
          <span className="mt-1 block text-[11px] font-bold text-[#234e82]">{workspace.workspaceStatus === 'active' ? 'Ativo' : 'Desativado'}</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ['workspaceName','Nome do workspace',120],
          ['organizationName','Nome da Organização Militar',160],
          ['organizationShortName','Sigla da OM',30],
          ['sectionName','Nome da seção / setor',120],
        ] as const).map(([key,title,max]) => <label key={key} className="space-y-1.5 text-[11px] font-bold text-[#355779]">
          <span>{title}</span>
          <input className={styles.demoInput + ' h-11 w-full px-3 text-xs'} type="text" value={form[key] || ''} maxLength={max}
            required={key !== 'organizationShortName'} onChange={e => update(key,e.target.value)}/>
        </label>)}
        <label className="space-y-1.5 text-[11px] font-bold text-[#355779]">
          <span>UG da OM</span>
          <input className={styles.demoInput + ' h-11 w-full px-3 font-mono text-xs disabled:bg-[#edf2f8]'} inputMode="numeric"
            value={form.ug} maxLength={6} disabled={Boolean(workspace.ug)}
            onChange={e => update('ug',e.target.value.replace(/\D/g,'').slice(0,6))} required/>
          <span className="text-[10px] font-normal text-[#7187a1]">{workspace.ug ? 'UG existente: imutável por segurança.' : 'Sem UG: permite preenchimento único, após validação.'}</span>
        </label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-[#cdddeb] bg-white px-4 py-2.5 text-[11px] font-bold text-[#516d91]">Cancelar</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#1a519a] px-5 py-2.5 text-[11px] font-bold text-white disabled:opacity-50">
          <Save className="h-4 w-4"/> {saving ? 'Salvando...' : persistentInEmulator ? 'Salvar no Emulator' : 'Simular atualização'}
        </button>
      </div>
    </form>
  </section>;
}
