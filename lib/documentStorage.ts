import type { DocumentStorageRef } from './types';

export const LEGACY_DOCUMENT_STORAGE_PROVIDER = 'vercel-blob' as const;

export type StorageBackedDocument = {
  pathname: string;
  storage?: DocumentStorageRef;
};

/**
 * Compatibilidade para documentos criados antes da abstração multi-provider.
 * A ausência de metadata `storage` significa que o documento continua no
 * Vercel Blob privado, usando o `pathname` histórico como chave física.
 */
export function resolveDocumentStorageRef(document: StorageBackedDocument): DocumentStorageRef {
  if (document.storage) return document.storage;

  return {
    provider: LEGACY_DOCUMENT_STORAGE_PROVIDER,
    status: 'active',
    objectKey: document.pathname,
  };
}

export function createVercelBlobStorageRef(
  pathname: string,
  workspaceId?: string
): DocumentStorageRef {
  return {
    provider: 'vercel-blob',
    status: 'active',
    objectKey: pathname,
    ...(workspaceId ? { workspaceId } : {}),
  };
}

export function isVercelBlobDocument(document: StorageBackedDocument): boolean {
  return resolveDocumentStorageRef(document).provider === 'vercel-blob';
}

export function isGoogleDriveDocument(document: StorageBackedDocument): boolean {
  return resolveDocumentStorageRef(document).provider === 'google-drive';
}

export function assertActiveDocumentStorage(document: StorageBackedDocument): DocumentStorageRef {
  const storage = resolveDocumentStorageRef(document);
  if (storage.status !== 'active') {
    throw new Error('O documento não está mais disponível no armazenamento ativo.');
  }
  return storage;
}
