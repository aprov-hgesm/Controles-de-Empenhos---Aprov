'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import {
  suggestWorkspaceId,
  type CreateSectorWorkspaceInput,
} from '../../lib/platformAdminStore';
import { MIN_SECTOR_PASSWORD_LENGTH } from '../../lib/sectorProvisioning';

interface AdminCreateSectorPanelProps {
  creating: boolean;
  disabled?: boolean;
  onCreate: (input: CreateSectorWorkspaceInput) => Promise<void>;
  onCreated?: () => void;
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

const inputClass =
  'min-h-11 w-full rounded-xl border border-white/[0.09] bg-black/20 px-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-blue-300/35 focus:bg-blue-400/[0.035] focus:ring-2 focus:ring-blue-300/10 disabled:cursor-not-allowed disabled:opacity-50';

export function AdminCreateSectorPanel({
  creating,
  disabled = false,
  onCreate,
  onCreated,
}: AdminCreateSectorPanelProps) {
  const [form, setForm] = useState<CreateSectorWorkspaceInput>(INITIAL_FORM);
  const [workspaceIdTouched, setWorkspaceIdTouched] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const suggestedId = useMemo(
    () => suggestWorkspaceId(form.workspaceName),
    [form.workspaceName]
  );

  useEffect(() => {
    if (!workspaceIdTouched) {
      setForm((current) => ({ ...current, workspaceId: suggestedId }));
    }
  }, [suggestedId, workspaceIdTouched]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setWorkspaceIdTouched(false);
    setConfirmPassword('');
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCompleted(false);

    if (
      !form.workspaceName.trim()
      || !form.workspaceId.trim()
      || !form.ug.trim()
      || !form.authorizedEmail.trim()
      || !form.initialPassword
      || !form.organizationName.trim()
      || !form.sectionName.trim()
    ) {
      setError('Preencha todos os campos obrigatórios do setor.');
      return;
    }

    if (form.ug.trim().length !== 6) {
      setError('A UG deve possuir exatamente 6 dígitos.');
      return;
    }

    if (form.initialPassword.length < MIN_SECTOR_PASSWORD_LENGTH) {
      setError(
        'A senha inicial deve possuir pelo menos '
          + MIN_SECTOR_PASSWORD_LENGTH
          + ' caracteres.'
      );
      return;
    }

    if (form.initialPassword !== confirmPassword) {
      setError('A confirmação da senha inicial não confere.');
      return;
    }

    try {
      await onCreate(form);
      setCompleted(true);
      resetForm();
      onCreated?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível cadastrar o setor.'
      );
    }
  };

  return (
    <section
      data-testid="admin-create-sector-panel"
      className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/65 shadow-[0_22px_70px_rgba(0,8,28,0.20)] backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.08] px-5 py-5 sm:px-7">
        <div className="mb-2 inline-flex items-center gap-2 font-mono text-[8px] font-bold uppercase tracking-[0.20em] text-blue-200/70">
          <Building2 className="h-4 w-4" />
          Provisionamento administrativo
        </div>
        <h3 className="text-xl font-extrabold text-white">Cadastrar novo setor</h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
          Crie a identidade operacional da Organização Militar, vincule a UG e
          prepare o acesso inicial. O Gmail informado também será a identidade
          esperada para a conexão do Google Drive do setor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-7">
        {disabled && (
          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100">
            O diretório administrativo ainda não está disponível para gravação.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-300/15 bg-rose-400/[0.06] px-4 py-3 text-xs leading-relaxed text-rose-100">
            {error}
          </div>
        )}

        {completed && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
            <div>
              <p className="text-xs font-extrabold text-emerald-100">
                Provisionamento concluído
              </p>
              <p className="mt-1 text-[11px] text-emerald-100/70">
                A identidade Firebase, o workspace e a UG foram encaminhados
                pelo fluxo administrativo existente.
              </p>
            </div>
          </div>
        )}

        <fieldset disabled={disabled || creating} className="space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-blue-300/15 bg-blue-400/[0.06] text-[10px] font-black text-blue-100">
                1
              </span>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Identificação da Organização Militar
                </h4>
                <p className="text-[10px] text-slate-500">
                  Informações institucionais e identidade da UG.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome do setor" required>
                <input
                  value={form.workspaceName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workspaceName: event.target.value,
                    }))
                  }
                  placeholder="Aprovisionamento HGeSM"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Identificador"
                required
                hint="Gerado automaticamente; pode ser ajustado."
              >
                <input
                  value={form.workspaceId}
                  onChange={(event) => {
                    setWorkspaceIdTouched(true);
                    setForm((current) => ({
                      ...current,
                      workspaceId: event.target.value.toLowerCase(),
                    }));
                  }}
                  placeholder="hgesm-aprov"
                  className={inputClass + ' font-mono'}
                />
              </Field>

              <Field
                label="UG da OM"
                required
                hint="Código de 6 dígitos da unidade."
              >
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={form.ug}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ug: event.target.value.replace(/\D/g, '').slice(0, 6),
                    }))
                  }
                  placeholder="160416"
                  className={inputClass + ' font-mono tracking-[0.12em]'}
                />
              </Field>

              <Field label="Organização Militar" required>
                <input
                  value={form.organizationName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizationName: event.target.value,
                    }))
                  }
                  placeholder="Hospital Geral de Santa Maria"
                  className={inputClass}
                />
              </Field>

              <Field label="Sigla da OM">
                <input
                  value={form.organizationShortName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizationShortName: event.target.value,
                    }))
                  }
                  placeholder="HGeSM"
                  className={inputClass}
                />
              </Field>

              <Field label="Nome da seção" required>
                <input
                  value={form.sectionName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sectionName: event.target.value,
                    }))
                  }
                  placeholder="Seção de Aprovisionamento"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-400/[0.06] text-[10px] font-black text-cyan-100">
                2
              </span>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  Credenciais de acesso
                </h4>
                <p className="text-[10px] text-slate-500">
                  Identidade inicial do operador responsável pelo setor.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="E-mail de acesso (Gmail)"
                required
                hint="Deverá coincidir com a conta usada no Google Drive."
              >
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.authorizedEmail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        authorizedEmail: event.target.value,
                      }))
                    }
                    placeholder="aprovisionamento.unidade@gmail.com"
                    className={inputClass + ' pl-10'}
                  />
                </div>
              </Field>

              <div className="hidden sm:block" />

              <Field
                label="Senha inicial"
                required
                hint={'Mínimo de ' + MIN_SECTOR_PASSWORD_LENGTH + ' caracteres.'}
              >
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.initialPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        initialPassword: event.target.value,
                      }))
                    }
                    className={inputClass + ' pl-10'}
                  />
                </div>
              </Field>

              <Field label="Confirmar senha inicial" required>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={inputClass + ' pl-10'}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.05] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold text-violet-100">
                  Período de teste
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-violet-100/70">
                  Conceda 30 dias de trial completo. Durante a fase atual, o billing permanece em OBSERVE e nunca bloqueia o acesso operacional.
                </p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 text-[11px] font-bold text-violet-100">
                <input
                  type="checkbox"
                  checked={form.grantTrial}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      grantTrial: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-white/20 bg-slate-950/40"
                />
                Conceder
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-300/12 bg-blue-400/[0.04] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
              <div>
                <p className="text-xs font-extrabold text-white">
                  Revisão e provisionamento
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  O fluxo existente cria a identidade Firebase no servidor e
                  vincula UID, workspace e UG antes do primeiro acesso. Nenhuma
                  regra de isolamento ou provisionamento foi alterada por esta
                  nova interface.
                </p>
              </div>
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={creating}
            onClick={resetForm}
            className="min-h-11 rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 text-xs font-bold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            Limpar formulário
          </button>

          <button
            type="submit"
            disabled={disabled || creating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-600 px-5 text-xs font-extrabold text-white shadow-lg shadow-blue-950/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            Criar setor e provisionar acesso
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  required,
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
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-extrabold text-slate-300">
        {label}
        {required && <span className="text-blue-300">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[9px] leading-relaxed text-slate-600">
          {hint}
        </span>
      )}
    </label>
  );
}
