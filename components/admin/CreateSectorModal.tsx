'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Mail, X } from 'lucide-react';

import { suggestWorkspaceId, type CreateSectorWorkspaceInput } from '../../lib/platformAdminStore';

interface CreateSectorModalProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (input: CreateSectorWorkspaceInput) => Promise<void>;
}

const INITIAL_FORM: CreateSectorWorkspaceInput = {
  workspaceId: '',
  workspaceName: '',
  authorizedEmail: '',
  organizationName: '',
  organizationShortName: '',
  sectionName: 'Seção de Aprovisionamento',
  defaultDeliveryLocation: '',
  defaultResponsibleRole: '',
};

export function CreateSectorModal({ open, creating, onClose, onCreate }: CreateSectorModalProps) {
  const [form, setForm] = useState<CreateSectorWorkspaceInput>(INITIAL_FORM);
  const [workspaceIdTouched, setWorkspaceIdTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setWorkspaceIdTouched(false);
      setError(null);
    }
  }, [open]);

  const suggestedId = useMemo(() => suggestWorkspaceId(form.workspaceName), [form.workspaceName]);

  useEffect(() => {
    if (!workspaceIdTouched) {
      setForm((current) => ({ ...current, workspaceId: suggestedId }));
    }
  }, [suggestedId, workspaceIdTouched]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.workspaceName.trim() || !form.authorizedEmail.trim() || !form.organizationName.trim() || !form.sectionName.trim()) {
      setError('Preencha os campos obrigatórios do setor.');
      return;
    }

    try {
      await onCreate(form);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível cadastrar o setor.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1730] shadow-2xl shadow-black/40">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b1730]/95 backdrop-blur-xl px-5 sm:px-7 py-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-300">
              <Building2 className="w-4 h-4" />
              Novo workspace operacional
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-white">Cadastrar novo setor</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              O setor será provisionado em workspace próprio e a conta Google informada ficará autorizada para o primeiro acesso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome do setor" required>
              <input
                value={form.workspaceName}
                onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))}
                placeholder="Aprovisionamento Unidade B"
                className={inputClass}
              />
            </Field>

            <Field label="Identificador" required hint="Gerado automaticamente; pode ser ajustado.">
              <input
                value={form.workspaceId}
                onChange={(event) => {
                  setWorkspaceIdTouched(true);
                  setForm((current) => ({ ...current, workspaceId: event.target.value.toLowerCase() }));
                }}
                placeholder="unidade-b"
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>

          <Field label="Conta Google autorizada" required>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={form.authorizedEmail}
                onChange={(event) => setForm((current) => ({ ...current, authorizedEmail: event.target.value }))}
                placeholder="aprovisionamento.unidadeb@gmail.com"
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
            <Field label="Nome institucional" required>
              <input
                value={form.organizationName}
                onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
                placeholder="Nome da organização/unidade"
                className={inputClass}
              />
            </Field>
            <Field label="Sigla">
              <input
                value={form.organizationShortName || ''}
                onChange={(event) => setForm((current) => ({ ...current, organizationShortName: event.target.value }))}
                placeholder="OM"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Nome da seção" required>
            <input
              value={form.sectionName}
              onChange={(event) => setForm((current) => ({ ...current, sectionName: event.target.value }))}
              className={inputClass}
            />
          </Field>

          <details className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
            <summary className="cursor-pointer text-xs font-bold text-slate-300">Configurações institucionais opcionais</summary>
            <div className="mt-4 space-y-4">
              <Field label="Local padrão de entrega">
                <input
                  value={form.defaultDeliveryLocation || ''}
                  onChange={(event) => setForm((current) => ({ ...current, defaultDeliveryLocation: event.target.value }))}
                  placeholder="Ex.: Almoxarifado / Seção de Aprovisionamento"
                  className={inputClass}
                />
              </Field>
              <Field label="Cargo/função padrão do responsável">
                <input
                  value={form.defaultResponsibleRole || ''}
                  onChange={(event) => setForm((current) => ({ ...current, defaultResponsibleRole: event.target.value }))}
                  placeholder="Ex.: Fiscal de Contrato / Aprovisionamento"
                  className={inputClass}
                />
              </Field>
            </div>
          </details>

          <div className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3 text-xs leading-relaxed text-blue-100">
            A criação não concede acesso aos dados de outros setores. O workspace nasce com contador próprio de Termos de Recebimento e configura seu Google Drive no primeiro acesso.
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Criando setor…' : 'Criar setor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/10';

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-300">
          {label}{required && <span className="text-blue-300"> *</span>}
        </span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
