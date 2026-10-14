'use client';

import React from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import type { CronogramaEmailConfirmation } from '../hooks/useCronogramaActions';

interface CronogramaEmailDialogProps {
  draft: CronogramaEmailConfirmation | null;
  isSending: boolean;
  saveSupplierEmail: boolean;
  onRecipientChange: (value: string) => void;
  onSaveSupplierEmailChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CronogramaEmailDialog({
  draft,
  isSending,
  saveSupplierEmail,
  onRecipientChange,
  onSaveSupplierEmailChange,
  onCancel,
  onConfirm,
}: CronogramaEmailDialogProps) {
  if (!draft) return null;

  const recipient = draft.destinatario.trim().toLowerCase();
  const changedRecipient = recipient !== draft.destinatarioOriginal;
  const recipientIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  const sourceLabel = draft.fonteOriginal === 'local'
    ? 'Cadastro do setor'
    : draft.fonteOriginal === 'global'
      ? 'Pré-cadastro global'
      : 'Ainda não cadastrado';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cronograma-email-title"
        aria-describedby="cronograma-email-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !isSending) onCancel();
        }}
        className="my-8 w-full max-w-lg overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 bg-[#00288e] px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 p-2.5">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 id="cronograma-email-title" className="text-lg font-black">
                Confirmar envio do cronograma
              </h2>
              <p id="cronograma-email-description" className="mt-1 text-xs font-medium text-blue-100">
                Confira o destinatário antes de enviar o PDF oficial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            aria-label="Cancelar envio"
            className="rounded-lg p-1.5 text-blue-100 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (recipientIsValid && !isSending) onConfirm();
          }}
          className="space-y-5 p-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fornecedor</p>
            <p className="mt-1 break-words font-bold text-slate-900">{draft.fornecedor || 'Não identificado'}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nota de Empenho</p>
                <p className="mt-1 break-all text-xs font-semibold text-slate-800">{draft.empenhoId}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Origem do e-mail sugerido</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{sourceLabel}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cronograma-email-remetente" className="block text-xs font-extrabold text-slate-700">
              Remetente (Conta Google do setor)
            </label>
            <input
              id="cronograma-email-remetente"
              type="text"
              value={draft.remetente}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-sm font-semibold text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cronograma-email-destinatario" className="block text-xs font-extrabold text-slate-700">
              E-mail do fornecedor (destinatário)
            </label>
            <input
              id="cronograma-email-destinatario"
              type="email"
              value={draft.destinatario}
              onChange={(event) => onRecipientChange(event.target.value)}
              disabled={isSending}
              autoFocus
              required
              autoComplete="email"
              placeholder="fornecedor@empresa.com.br"
              className="w-full rounded-xl border border-blue-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#00288e] focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
            <p className="text-[11px] text-slate-500">
              Você pode corrigir o endereço apenas para este envio.
            </p>
          </div>

          {changedRecipient && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              {draft.podeSalvarContato ? (
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={saveSupplierEmail}
                    onChange={(event) => onSaveSupplierEmailChange(event.target.checked)}
                    disabled={isSending}
                    className="mt-0.5 h-4 w-4 accent-[#00288e]"
                  />
                  <span>
                    <span className="block text-xs font-extrabold text-slate-800">
                      Salvar este e-mail no cadastro do fornecedor
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                      Após o envio, atualizar o contato deste fornecedor na Central de Fornecedores do setor.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-xs leading-relaxed text-amber-800">
                  É possível enviar para este endereço, mas para salvá-lo na Central de Fornecedores é necessário informar um CNPJ válido no empenho.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs leading-relaxed text-emerald-900">
            <p className="flex items-center gap-2 font-extrabold">
              <ShieldCheck className="h-4 w-4" /> Envio por Gmail
            </p>
            <p className="mt-1">Assunto: {draft.assunto}</p>
            <p className="mt-2 font-extrabold">Anexos obrigatórios (2 PDFs):</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li>Cronograma de Entrega (gerado pelo EMPROVEX)</li>
              <li className="break-all">{draft.notaEmpenhoFilename} (Nota de Empenho cadastrada)</li>
            </ul>
            <p className="mt-2">Os dois documentos serão enviados juntos e o e-mail ficará na pasta Enviados da Conta Google.</p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSending}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSending || !recipientIsValid}
              aria-busy={isSending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00288e] px-5 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#001e6a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSending ? 'Enviando...' : 'Confirmar e enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
