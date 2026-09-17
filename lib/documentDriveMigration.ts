'use client';

import type { User } from 'firebase/auth';
import { resolveDocumentStorageRef } from './documentStorage';
import { fetchLegacyEmpenhoPdfBlob } from './empenhoDocuments';
import { saveEmpenho, saveInvoice } from './firebaseSync';
import {
  deleteWorkspaceDriveFile,
  uploadAndVerifyWorkspacePdf,
} from './googleDriveFiles';
import { fetchLegacyInvoicePdfBlob } from './invoiceDocuments';
import { requireWorkspaceDriveRuntime } from './workspaceDriveRuntime';
import type {
  Empenho,
  EmpenhoPdfDocument,
  Invoice,
  InvoicePdfDocument,
} from './types';

export interface DocumentMigrationCounts {
  empenhoLegacy: number;
  invoiceLegacy: number;
  totalLegacy: number;
  drive: number;
}

export interface DocumentMigrationProgress {
  processed: number;
  total: number;
  migrated: number;
  failed: number;
  currentLabel: string;
}

export interface DocumentMigrationFailure {
  kind: 'empenho' | 'invoice';
  id: string;
  message: string;
}

export interface DocumentMigrationResult {
  total: number;
  migrated: number;
  failed: number;
  failures: DocumentMigrationFailure[];
}

type PdfDocument = EmpenhoPdfDocument | InvoicePdfDocument;

function storageKey(document: PdfDocument): string {
  const storage = resolveDocumentStorageRef(document);
  return `${storage.provider}:${storage.objectKey}`;
}

function uniqueDocuments<T extends PdfDocument>(
  current?: T,
  versions?: T[]
): T[] {
  const map = new Map<string, T>();
  for (const document of [...(versions || []), ...(current ? [current] : [])]) {
    map.set(storageKey(document), document);
  }
  return Array.from(map.values());
}

function countByProvider(documents: PdfDocument[], provider: 'vercel-blob' | 'google-drive'): number {
  return documents.filter((document) => resolveDocumentStorageRef(document).provider === provider).length;
}

export function countDocumentStorage(
  empenhos: Empenho[],
  invoices: Invoice[]
): DocumentMigrationCounts {
  const empenhoDocuments = empenhos.flatMap((empenho) =>
    uniqueDocuments(empenho.notaEmpenhoPdf, empenho.notaEmpenhoPdfVersions)
  );
  const invoiceDocuments = invoices.flatMap((invoice) =>
    uniqueDocuments(invoice.notaFiscalPdf, invoice.notaFiscalPdfVersions)
  );

  const empenhoLegacy = countByProvider(empenhoDocuments, 'vercel-blob');
  const invoiceLegacy = countByProvider(invoiceDocuments, 'vercel-blob');
  const drive = countByProvider([...empenhoDocuments, ...invoiceDocuments], 'google-drive');

  return {
    empenhoLegacy,
    invoiceLegacy,
    totalLegacy: empenhoLegacy + invoiceLegacy,
    drive,
  };
}

function migrateDocumentReference<T extends PdfDocument>(
  document: T,
  replacements: Map<string, T>
): T {
  return replacements.get(storageKey(document)) || document;
}

async function migrateEmpenhoRecord(
  user: User,
  empenho: Empenho
): Promise<number> {
  const runtime = requireWorkspaceDriveRuntime();
  const documents = uniqueDocuments(empenho.notaEmpenhoPdf, empenho.notaEmpenhoPdfVersions);
  const legacyDocuments = documents.filter(
    (document) => resolveDocumentStorageRef(document).provider === 'vercel-blob'
  );
  if (legacyDocuments.length === 0) return 0;

  const replacements = new Map<string, EmpenhoPdfDocument>();
  const createdDriveIds: string[] = [];

  try {
    for (const document of legacyDocuments) {
      const legacyStorage = resolveDocumentStorageRef(document);
      const sourceBlob = await fetchLegacyEmpenhoPdfBlob(
        user,
        empenho.id,
        legacyStorage.objectKey
      );
      const { file, sha256 } = await uploadAndVerifyWorkspacePdf(
        runtime.session,
        runtime.settings.empenhosFolderId,
        sourceBlob,
        document.originalName,
        {
          emprovexDocumentType: 'empenho',
          emprovexEmpenhoId: empenho.id,
          emprovexMigrationSource: 'vercel-blob',
        }
      );
      createdDriveIds.push(file.id);
      replacements.set(storageKey(document), {
        ...document,
        size: file.size || sourceBlob.size || document.size,
        storage: {
          provider: 'google-drive',
          status: 'active',
          objectKey: file.id,
          folderKey: runtime.settings.empenhosFolderId,
          workspaceId: runtime.session.workspaceId,
          sha256,
        },
      });
    }

    const updatedEmpenho: Empenho = {
      ...empenho,
      ...(empenho.notaEmpenhoPdf
        ? { notaEmpenhoPdf: migrateDocumentReference(empenho.notaEmpenhoPdf, replacements) }
        : {}),
      ...(empenho.notaEmpenhoPdfVersions
        ? {
            notaEmpenhoPdfVersions: empenho.notaEmpenhoPdfVersions.map((document) =>
              migrateDocumentReference(document, replacements)
            ),
          }
        : {}),
    };

    await saveEmpenho(user.uid, updatedEmpenho);
    return legacyDocuments.length;
  } catch (error) {
    await Promise.allSettled(
      createdDriveIds.map((fileId) => deleteWorkspaceDriveFile(runtime.session, fileId))
    );
    throw error;
  }
}

async function migrateInvoiceRecord(
  user: User,
  invoice: Invoice
): Promise<number> {
  const runtime = requireWorkspaceDriveRuntime();
  const documents = uniqueDocuments(invoice.notaFiscalPdf, invoice.notaFiscalPdfVersions);
  const legacyDocuments = documents.filter(
    (document) => resolveDocumentStorageRef(document).provider === 'vercel-blob'
  );
  if (legacyDocuments.length === 0) return 0;

  const replacements = new Map<string, InvoicePdfDocument>();
  const createdDriveIds: string[] = [];

  try {
    for (const document of legacyDocuments) {
      const legacyStorage = resolveDocumentStorageRef(document);
      const sourceBlob = await fetchLegacyInvoicePdfBlob(
        user,
        invoice.empenhoId,
        invoice.id,
        legacyStorage.objectKey
      );
      const { file, sha256 } = await uploadAndVerifyWorkspacePdf(
        runtime.session,
        runtime.settings.invoicesFolderId,
        sourceBlob,
        document.originalName,
        {
          emprovexDocumentType: 'invoice',
          emprovexEmpenhoId: invoice.empenhoId,
          emprovexInvoiceId: invoice.id,
          emprovexMigrationSource: 'vercel-blob',
        }
      );
      createdDriveIds.push(file.id);
      replacements.set(storageKey(document), {
        ...document,
        size: file.size || sourceBlob.size || document.size,
        storage: {
          provider: 'google-drive',
          status: 'active',
          objectKey: file.id,
          folderKey: runtime.settings.invoicesFolderId,
          workspaceId: runtime.session.workspaceId,
          sha256,
        },
      });
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      ...(invoice.notaFiscalPdf
        ? { notaFiscalPdf: migrateDocumentReference(invoice.notaFiscalPdf, replacements) }
        : {}),
      ...(invoice.notaFiscalPdfVersions
        ? {
            notaFiscalPdfVersions: invoice.notaFiscalPdfVersions.map((document) =>
              migrateDocumentReference(document, replacements)
            ),
          }
        : {}),
    };

    await saveInvoice(user.uid, updatedInvoice);
    return legacyDocuments.length;
  } catch (error) {
    await Promise.allSettled(
      createdDriveIds.map((fileId) => deleteWorkspaceDriveFile(runtime.session, fileId))
    );
    throw error;
  }
}

export async function migrateLegacyDocumentsToDrive(
  user: User,
  empenhos: Empenho[],
  invoices: Invoice[],
  onProgress?: (progress: DocumentMigrationProgress) => void
): Promise<DocumentMigrationResult> {
  const initialCounts = countDocumentStorage(empenhos, invoices);
  const total = initialCounts.totalLegacy;
  let processed = 0;
  let migrated = 0;
  let failed = 0;
  const failures: DocumentMigrationFailure[] = [];

  const emit = (currentLabel: string) => onProgress?.({
    processed,
    total,
    migrated,
    failed,
    currentLabel,
  });

  emit('Preparando migração');

  for (const empenho of empenhos) {
    const legacyCount = countByProvider(
      uniqueDocuments(empenho.notaEmpenhoPdf, empenho.notaEmpenhoPdfVersions),
      'vercel-blob'
    );
    if (legacyCount === 0) continue;

    emit(`Nota de Empenho ${empenho.id}`);
    try {
      migrated += await migrateEmpenhoRecord(user, empenho);
    } catch (error) {
      failed += legacyCount;
      failures.push({
        kind: 'empenho',
        id: empenho.id,
        message: error instanceof Error ? error.message : 'Falha desconhecida na migração.',
      });
    }
    processed += legacyCount;
    emit(`Nota de Empenho ${empenho.id}`);
  }

  for (const invoice of invoices) {
    const legacyCount = countByProvider(
      uniqueDocuments(invoice.notaFiscalPdf, invoice.notaFiscalPdfVersions),
      'vercel-blob'
    );
    if (legacyCount === 0) continue;

    emit(`Nota Fiscal ${invoice.id}`);
    try {
      migrated += await migrateInvoiceRecord(user, invoice);
    } catch (error) {
      failed += legacyCount;
      failures.push({
        kind: 'invoice',
        id: invoice.id,
        message: error instanceof Error ? error.message : 'Falha desconhecida na migração.',
      });
    }
    processed += legacyCount;
    emit(`Nota Fiscal ${invoice.id}`);
  }

  emit('Migração concluída');
  return { total, migrated, failed, failures };
}
