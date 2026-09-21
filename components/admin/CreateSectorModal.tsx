'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, KeyRound, Loader2, Mail, X } from 'lucide-react';

import { suggestWorkspaceId, type CreateSectorWorkspaceInput } from '../../lib/platformAdminStore';
import { MIN_SECTOR_PASSWORD_LENGTH } from '../../lib/sectorProvisioning';

interface CreateSectorModalProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (input: CreateSectorWorkspaceInput) => Promise<void>;
}

const INITIAL_FORM: CreateSectorWorkspaceInput = {
  workspaceId: '',
  workspaceName: '',
  ug: '',
  authorizedEmail: '',
  initialPassword: '',
  organizationName: '',
  organizationShortName: '',
  sectionName: 'Seção de Aprovisionamento',
  grantTrial: true,
};

export function CreateSectorModal({ open, creating, onClose, onCreate }: CreateSectorModalProps) {
  const [form, setForm] = useState<CreateSectorWorkspaceInput>(INITIAL_FORM);
  const [workspaceIdTouched, setWorkspaceIdTouched] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setWorkspaceIdTouched(false);
      setConfirmPassword('');
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

    if (
      !form.workspaceName.trim()
      || !form.ug.trim()
      || !form.authorizedEmail.trim()
      || !form.initialPassword
      || !form.organizationName.trim()
      || !form.sectionName.trim()
    ) {
      setError('Preencha os campos obrigatórios do setor.');
      return;
    }

    if (form.initialPassword.length < MIN_SECTOR_PASSWORD_LENGTH) {
      setError(`A senha inicial deve possuir pelo menos ${MIN_SECTOR_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (form.initialPassword !== confirmPassword) {
      setError('A confirmação da senha inicial não confere.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020817]/85 p-4 backdrop-blur-xl sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sector-title"
        aria-describedby="create-sector-description"
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[1.75rem] border border-white/[0.08] bg-[#071225] shadow-[0_30px_100px_rgba(0,8,28,0.58)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#071225]/95 px-5 py-5 backdrop-blur-2xl sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-300">
              <Building2 className="w-4 h-4" />
              Novo workspace operacional
            </div>
            <h2 id="create-sector-title" className="mt-2 text-xl font-extrabold text-white">Cadastrar novo setor</h2>
            <p id="create-sector-description" className="mt-1 text-xs leading-relaxed text-slate-400">
              O setor será provisionado com identidade Firebase própria. O Gmail informado será o e-mail de acesso e, posteriormente, deverá ser o mesmo usado na conexão do Google Drive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-2 text-slate-400 transition hover:border-blue-300/15 hover:bg-blue-400/[0.07] hover:text-white disabled:opacity-50"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <Field label="UG da OM" required hint="6 dígitos; identidade da unidade.">
              <input
                inputMode="numeric"
                value={form.ug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ug: event.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
                placeholder="160416"
                maxLength={6}
                className={`${inputClass} font-mono tracking-[0.12em]`}
              />
            </Field>
          </div>

          <Field
            label="E-mail de acesso (Gmail)"
            required
            hint="Será também a identidade obrigatória do Google Drive."
          >
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                autoComplete="email"
                value={form.authorizedEmail}
                onChange={(event) => setForm((current) => ({ ...current, authorizedEmail: event.target.value }))}
                placeholder="aprovisionamento.unidadeb@gmail.com"
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Senha inicial"
              required
              hint={`Mínimo de ${MIN_SECTOR_PASSWORD_LENGTH} caracteres.`}
            >
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.initialPassword}
                  onChange={(event) => setForm((current) => ({ ...current, initialPassword: event.target.value }))}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Confirmar senha inicial" required>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>
          </div>

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

          <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.055] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold text-violet-100">Período de teste</p>
                <p className="mt-1 text-[11px] leading-relaxed text-violet-100/70">
                  Concede 30 dias de acesso em modo de observação comercial. Durante os testes atuais, o status de cobrança não bloqueia o usuário.
                </p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 text-[11px] font-bold text-violet-100">
                <input
                  type="checkbox"
                  checked={form.grantTrial}
                  onChange={(event) => setForm((current) => ({ ...current, grantTrial: event.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950/40"
                />
                Conceder
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs leading-relaxed text-slate-300">
            O sistema padroniza automaticamente o local como <strong>Setor de Aprovisionamento - [SIGLA]</strong> e o responsável como <strong>Chefe do Aprovisionamento</strong>.
          </div>

          <div className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3 text-xs leading-relaxed text-blue-100">
            O usuário Firebase, o workspace e a conta operacional serão provisionados de forma coordenada no servidor. A UG será vinculada à identidade da Organização Militar e reutilizada automaticamente nos fluxos operacionais. A senha não é gravada no Firestore. O Google Drive permanece desconectado até a etapa específica de onboarding.
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

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950/30 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/10';

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
