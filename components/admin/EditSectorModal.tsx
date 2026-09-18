'use client';

import { useEffect, useState } from 'react';
import { Building2, Loader2, LockKeyhole, X } from 'lucide-react';

import type { UpdateSectorWorkspaceInput } from '../../lib/platformAdminStore';
import type { Workspace } from '../../lib/platformIdentity';

interface EditSectorModalProps {
  workspace: Workspace | null;
  saving: boolean;
  resettingPassword: boolean;
  onClose: () => void;
  onSave: (input: UpdateSectorWorkspaceInput) => Promise<void>;
  onResetPassword: (workspaceId: string, email: string, newPassword: string) => Promise<void>;
}

function formFromWorkspace(workspace: Workspace): UpdateSectorWorkspaceInput {
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    organizationName: workspace.institutionalProfile.organizationName,
    organizationShortName: workspace.institutionalProfile.organizationShortName || '',
    sectionName: workspace.institutionalProfile.sectionName,
  };
}

export function EditSectorModal({
  workspace,
  saving,
  resettingPassword,
  onClose,
  onSave,
  onResetPassword,
}: EditSectorModalProps) {
  const [form, setForm] = useState<UpdateSectorWorkspaceInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(workspace ? formFromWorkspace(workspace) : null);
    setError(null);
    setNewPassword('');
    setConfirmPassword('');
    setCredentialMessage(null);
  }, [workspace]);

  if (!workspace || !form) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (
      !form.workspaceName.trim()
      || !form.organizationName.trim()
      || !form.sectionName.trim()
    ) {
      setError('Preencha os campos obrigatórios do setor.');
      return;
    }

    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível atualizar o setor.');
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setCredentialMessage(null);

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('A nova senha deve possuir entre 8 e 128 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    try {
      await onResetPassword(workspace.id, workspace.authorizedEmail, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setCredentialMessage('Senha redefinida com sucesso. O usuário já pode testar o novo acesso.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Não foi possível redefinir a senha.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1730] shadow-2xl shadow-black/40">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b1730]/95 backdrop-blur-xl px-5 sm:px-7 py-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-300">
              <Building2 className="w-4 h-4" />
              Cadastro institucional
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-white">Editar setor</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Altere somente os dados institucionais. Identidade do workspace e conta Google permanecem protegidas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || resettingPassword}
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
            <ReadOnlyField label="Workspace ID" value={workspace.id} />
            <ReadOnlyField label="Conta Google autorizada" value={workspace.authorizedEmail} />
          </div>

          <div className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3 text-xs leading-relaxed text-blue-100 flex gap-2">
            <LockKeyhole className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Para preservar isolamento, UID e vínculo de armazenamento, workspace ID e e-mail não podem ser alterados neste fluxo.
            </span>
          </div>

          <Field label="Nome do setor" required>
            <input
              value={form.workspaceName}
              onChange={(event) => setForm((current) => current && ({ ...current, workspaceName: event.target.value }))}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome institucional" required>
              <input
                value={form.organizationName}
                onChange={(event) => setForm((current) => current && ({ ...current, organizationName: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Sigla">
              <input
                value={form.organizationShortName || ''}
                onChange={(event) => setForm((current) => current && ({ ...current, organizationShortName: event.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Nome da seção" required>
            <input
              value={form.sectionName}
              onChange={(event) => setForm((current) => current && ({ ...current, sectionName: event.target.value }))}
              className={inputClass}
            />
          </Field>

          <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 text-xs leading-relaxed text-slate-300">
            O local padrão e a função do responsável são definidos automaticamente como <strong>Setor de Aprovisionamento - [SIGLA]</strong> e <strong>Chefe do Aprovisionamento</strong>.
          </div>

          <div className="rounded-2xl border border-blue-400/15 bg-blue-500/[0.05] p-4 space-y-4">
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-300" />
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-blue-200">Credencial de acesso</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Defina uma nova senha para este usuário. A senha atual nunca é exibida nem armazenada no Firestore.
                </p>
              </div>
            </div>

            {credentialMessage && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-200">
                {credentialMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nova senha">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={resettingPassword}
                  className={inputClass}
                />
              </Field>
              <Field label="Confirmar nova senha">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={resettingPassword}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleResetPassword()}
                disabled={resettingPassword || !newPassword || !confirmPassword}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                {resettingPassword ? 'Redefinindo…' : 'Definir / redefinir senha'}
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || resettingPassword}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || resettingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar alterações'}
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
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-300">
        {label}{required && <span className="text-blue-300"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/20 px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</div>
      <div className="mt-1 break-all text-xs font-mono font-bold text-slate-300">{value}</div>
    </div>
  );
}
