'use client';

import { useState } from 'react';
import type { NeReview } from '../../../lib/company/documents/model';

type Preview = {
  extracted: NeReview;
  sourceSha256: string;
  warnings: string[];
  requiresHumanConfirmation: boolean;
  persisted: false;
};
type Props = {
  getIdToken: () => Promise<string>;
  onConfirmed?: (documentId: string) => void;
};

/** Component isolated for W4 integration; never imports military hooks or Firebase client SDK. */
export function CompanyNeReview({ getIdToken, onConfirmed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [review, setReview] = useState<NeReview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  async function importNe() {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/company/documents/import-ne', {
        method: 'POST', headers: { Authorization: 'Bearer ' + await getIdToken() },
        body, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.code || 'Falha ao interpretar a NE');
      setPreview(data.result as Preview);
      setReview((data.result as Preview).extracted);
      setConfirmed(false);
      setIdempotencyKey(crypto.randomUUID());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler o PDF.');
    } finally { setBusy(false); }
  }

  async function confirmNe() {
    if (!file || !preview || !review || !confirmed) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('sourceSha256', preview.sourceSha256);
      body.set('review', JSON.stringify(review));
      body.set('confirmed', 'true');
      const response = await fetch('/api/company/documents/confirm-ne', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + await getIdToken(), 'Idempotency-Key': idempotencyKey },
        body, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.code || 'Falha ao confirmar a NE');
      setMessage('Nota de Empenho revisada e documento empresarial armazenado.');
      onConfirmed?.(data.result.document.id as string);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o documento.');
    } finally { setBusy(false); }
  }

  const patch = <K extends keyof NeReview>(field: K, value: NeReview[K]) =>
    setReview((current) => current ? { ...current, [field]: value } : null);

  return (
    <section aria-label="Importação empresarial de Nota de Empenho" className="space-y-5 rounded-2xl border border-slate-200 p-5">
      <h2 className="text-lg font-semibold">Nota de Empenho — importação assistida</h2>
      <p className="text-sm text-slate-600">Extrações são sugestões. Confira e confirme cada campo antes do armazenamento. Nenhum pedido de OM é criado automaticamente.</p>
      <div className="space-y-2">
        <label htmlFor="empresa-ne-pdf" className="block text-sm font-medium">PDF textual da NE (até 12 MB)</label>
        <input id="empresa-ne-pdf" type="file" accept="application/pdf,.pdf"
          onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setReview(null); setConfirmed(false); setMessage(''); }}
          className="block w-full text-sm" />
        <button type="button" onClick={importNe} disabled={!file || busy}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Processando…' : 'Ler PDF para revisão'}
        </button>
      </div>
      {preview && review && (
        <div className="space-y-4">
          <h3 className="font-semibold">Conferência humana obrigatória</h3>
          {preview.warnings.length > 0 && <div role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {preview.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Número da NE
              <input className="mt-1 w-full rounded border p-2" value={review.neNumber}
                onChange={e => patch('neNumber', e.target.value)} />
            </label>
            <label className="text-sm">UG do cliente (atributo, não permissão)
              <input className="mt-1 w-full rounded border p-2" value={review.buyerUg || ''}
                onChange={e => patch('buyerUg', e.target.value || null)} />
            </label>
            <label className="text-sm">Fornecedor identificado
              <input className="mt-1 w-full rounded border p-2" value={review.supplier}
                onChange={e => patch('supplier', e.target.value)} />
            </label>
            <label className="text-sm">CNPJ
              <input className="mt-1 w-full rounded border p-2" value={review.supplierCnpj}
                onChange={e => patch('supplierCnpj', e.target.value)} />
            </label>
            <label className="text-sm">Emissão (dd/mm/aaaa)
              <input className="mt-1 w-full rounded border p-2" value={review.issueDate}
                onChange={e => patch('issueDate', e.target.value)} />
            </label>
            <label className="text-sm">Valor total (R$)
              <input className="mt-1 w-full rounded border p-2" inputMode="decimal"
                value={(review.totalCents / 100).toFixed(2)}
                onChange={e => {
                  const n = Number(e.target.value.replace(',', '.'));
                  if (Number.isFinite(n) && n >= 0) patch('totalCents', Math.round(n * 100));
                }} />
            </label>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium">Itens extraídos ({review.items.length})</h4>
            {review.items.map((line, index) => (
              <fieldset key={line.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
                {(['description','quantity','unit'] as const).map(key => (
                  <label key={key} className="text-xs">{key === 'description' ? 'Descrição' : key === 'quantity' ? 'Quantidade' : 'Unidade'}
                    <input className="mt-1 w-full rounded border p-2 text-sm" value={line[key]}
                      onChange={e => {
                        const next = [...review.items]; next[index] = { ...line, [key]: e.target.value };
                        patch('items', next);
                      }} />
                  </label>
                ))}
                <label className="text-xs">Preço unitário (centavos)
                  <input type="number" min={0} step={1} className="mt-1 w-full rounded border p-2 text-sm" value={line.unitPriceCents}
                    onChange={e => {
                      const next = [...review.items]; next[index] = { ...line, unitPriceCents: Number(e.target.value) };
                      patch('items', next);
                    }} />
                </label>
                <label className="text-xs">Total do item (centavos)
                  <input type="number" min={0} step={1} className="mt-1 w-full rounded border p-2 text-sm" value={line.totalCents}
                    onChange={e => {
                      const next = [...review.items]; next[index] = { ...line, totalCents: Number(e.target.value) };
                      patch('items', next);
                    }} />
                </label>
              </fieldset>
            ))}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            Conferi manualmente os campos e itens acima. Autorizo armazenar este PDF na empresa atual.
          </label>
          <button type="button" disabled={!confirmed || busy} onClick={confirmNe}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Confirmar e armazenar
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
