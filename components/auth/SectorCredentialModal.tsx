'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';

import {
  MAX_SECTOR_PASSWORD_LENGTH,
  MIN_SECTOR_PASSWORD_LENGTH,
} from '../../lib/sectorProvisioning';

interface SectorCredentialModalProps {
  open: boolean;
  email: string;
  saving: boolean;
  onClose: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function SectorCredentialModal({
  open,
  email,
  saving,
  onClose,
  onChangePassword,
}: SectorCredentialModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswords(false);
      setError(null);
      setMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!currentPassword) {
      setError('Informe sua senha atual para confirmar a alteração.');
      return;
    }

    if (
      newPassword.length < MIN_SECTOR_PASSWORD_LENGTH
      || newPassword.length > MAX_SECTOR_PASSWORD_LENGTH
    ) {
      setError(
        `A nova senha deve possuir entre ${MIN_SECTOR_PASSWORD_LENGTH} e ${MAX_SECTOR_PASSWORD_LENGTH} caracteres.`
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Senha alterada com sucesso.');
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : 'Não foi possível alterar a senha agora.'
      );
    }
  };

  const inputClass =
    'h-11 w-full rounded-xl border border-white/10 bg-slate-950/35 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020817]/85 p-4 backdrop-blur-xl">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sector-credential-title"
        className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#071225] shadow-[0_30px_100px_rgba(0,8,28,0.58)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-blue-300">
              <ShieldCheck className="h-4 w-4" />
              Minha conta
            </div>
            <h2 id="sector-credential-title" className="mt-2 text-xl font-extrabold text-white">
              Alterar senha de acesso
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-2 text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
          <div className="rounded-2xl border border-blue-300/[0.12] bg-blue-400/[0.05] px-4 py-3 text-[11px] leading-5 text-blue-100/85">
            A alteração usa diretamente o Firebase Authentication. O EMPROVEX não grava sua senha no Firestore nem em registros de auditoria.
          </div>

          {message && (
            <div role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3.5 py-2.5 text-xs text-emerald-100">
              {message}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-rose-300/15 bg-rose-400/[0.07] px-3.5 py-2.5 text-xs leading-5 text-rose-100">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">Senha atual</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                data-testid="sector-current-password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={saving}
                className={`${inputClass} pl-10 pr-11`}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
              <span>Nova senha</span>
              <span className="text-[10px] font-medium text-slate-500">
                {MIN_SECTOR_PASSWORD_LENGTH}–{MAX_SECTOR_PASSWORD_LENGTH} caracteres
              </span>
            </span>
            <input
              data-testid="sector-new-password"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">Confirmar nova senha</span>
            <input
              data-testid="sector-confirm-password"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              className={inputClass}
            />
          </label>

          <button
            type="button"
            onClick={() => setShowPasswords((current) => !current)}
            className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 transition hover:text-slate-200"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
          </button>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              Fechar
            </button>
            <button
              data-testid="sector-change-password-submit"
              type="submit"
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Alterando…' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
