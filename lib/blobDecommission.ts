'use client';

import type { User } from 'firebase/auth';
import type { Empenho, Invoice } from './types';

export interface BlobCleanupCandidate {
  kind: 'empenho' | 'invoice';
  empenhoId: string;
  invoiceId?: string;
  pathname: string;
  label: string;
}

export interface BlobCleanupProgress {
  processed: number;
  total: number;
  deleted: number;
  alreadyMissing: number;
  failed: number;
  currentLabel: string;
}

export interface BlobCleanupResult {
  total: number;
  deleted: number;
  alreadyMissing: number;
  failed: number;
  failures: string[];
}

function isMigratedDriveDocument(document: any): boolean {
  return Boolean(
    document &&
    typeof document === 'object' &&
    document.storage?.provider === 'google-drive' &&
    document.storage?.status === 'active' &&
    typeof document.storage?.objectKey === 'string' &&
    document.storage.objectKey.trim() &&
    typeof document.storage?.workspaceId === 'string' &&
    /^[a-f0-9]{64}$/i.test(String(document.storage?.sha256 || ''))
  );
}

function isLegacyEmpenhoPathname(pathname: unknown, empenhoId: string): pathname is string {
  return typeof pathname === 'string' &&
    pathname.startsWith(`empenhos/${empenhoId.trim().toUpperCase()}/`) &&
    pathname.endsWith('.pdf') &&
    !pathname.includes('..') &&
    !pathname.includes('\\');
}

function isLegacyInvoicePathname(pathname: unknown, empenhoId: string, invoiceId: string): pathname is string {
  return typeof pathname === 'string' &&
    pathname.startsWith(`notas-fiscais/${empenhoId.trim().toUpperCase()}/${invoiceId.trim().toUpperCase()}/`) &&
    pathname.endsWith('.pdf') &&
    !pathname.includes('..') &&
    !pathname.includes('\\');
}

function uniqueByPathname<T extends { pathname?: string }>(documents: T[]): T[] {
  const map = new Map<string, T>();
  for (const document of documents) {
    if (!document?.pathname) continue;
    if (!map.has(document.pathname)) map.set(document.pathname, document);
  }
  return [...map.values()];
}

export function collectBlobCleanupCandidates(empenhos: Empenho[], invoices: Invoice[]): BlobCleanupCandidate[] {
  const candidates: BlobCleanupCandidate[] = [];
  const seen = new Set<string>();

  for (const empenho of empenhos) {
    const documents = uniqueByPathname([
      ...(empenho.notaEmpenhoPdfVersions || []),
      ...(empenho.notaEmpenhoPdf ? [empenho.notaEmpenhoPdf] : []),
    ]);
    for (const document of documents) {
      if (!isMigratedDriveDocument(document)) continue;
      if (!isLegacyEmpenhoPathname(document.pathname, empenho.id)) continue;
      if (seen.has(document.pathname)) continue;
      seen.add(document.pathname);
      candidates.push({
        kind: 'empenho',
        empenhoId: empenho.id,
        pathname: document.pathname,
        label: `NE ${empenho.id}`,
      });
    }
  }

  for (const invoice of invoices) {
    const documents = uniqueByPathname([
      ...(invoice.notaFiscalPdfVersions || []),
      ...(invoice.notaFiscalPdf ? [invoice.notaFiscalPdf] : []),
    ]);
    for (const document of documents) {
      if (!isMigratedDriveDocument(document)) continue;
      if (!isLegacyInvoicePathname(document.pathname, invoice.empenhoId, invoice.id)) continue;
      if (seen.has(document.pathname)) continue;
      seen.add(document.pathname);
      candidates.push({
        kind: 'invoice',
        empenhoId: invoice.empenhoId,
        invoiceId: invoice.id,
        pathname: document.pathname,
        label: `NF ${invoice.id}`,
      });
    }
  }

  return candidates;
}

async function getAuthorizationHeader(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function cleanupOne(user: User, candidate: BlobCleanupCandidate): Promise<'deleted' | 'already-missing'> {
  const headers = await getAuthorizationHeader(user);
  const response = await fetch('/api/document-storage/blob-decommission', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(candidate),
  });

  const payload = await response.json().catch(() => ({})) as {
    status?: 'deleted' | 'already-missing';
    error?: string;
  };

  if (!response.ok || !payload.status) {
    throw new Error(payload.error || `Falha ao remover ${candidate.label} do Blob.`);
  }
  return payload.status;
}

export async function cleanupMigratedLegacyBlobCopies(
  user: User,
  empenhos: Empenho[],
  invoices: Invoice[],
  onProgress?: (progress: BlobCleanupProgress) => void
): Promise<BlobCleanupResult> {
  const candidates = collectBlobCleanupCandidates(empenhos, invoices);
  const result: BlobCleanupResult = {
    total: candidates.length,
    deleted: 0,
    alreadyMissing: 0,
    failed: 0,
    failures: [],
  };

  let processed = 0;
  const emit = (currentLabel: string) => onProgress?.({
    processed,
    total: candidates.length,
    deleted: result.deleted,
    alreadyMissing: result.alreadyMissing,
    failed: result.failed,
    currentLabel,
  });

  emit('Preparando limpeza controlada');

  for (const candidate of candidates) {
    emit(candidate.label);
    try {
      const status = await cleanupOne(user, candidate);
      if (status === 'deleted') result.deleted += 1;
      else result.alreadyMissing += 1;
    } catch (error) {
      result.failed += 1;
      result.failures.push(`${candidate.label}: ${error instanceof Error ? error.message : 'falha desconhecida'}`);
    }
    processed += 1;
    emit(candidate.label);
  }

  return result;
}
