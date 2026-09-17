import type { DocumentStorageRef } from './types';

export type StorageBackedDocument = {
  pathname: string;
  storage?: DocumentStorageRef;
};

/**
 * O Google Drive é o único provedor documental ativo do EMPROVEX.
 * Documentos sem metadata de storage são considerados inválidos após o cutover 14E.
 */
export function resolveDocumentStorageRef(document: StorageBackedDocument): DocumentStorageRef {
  const storage = document.storage;
  if (!storage) {
    throw new Error('Documento sem metadata de armazenamento após o cutover para o Google Drive.');
  }
  if (storage.provider !== 'google-drive') {
    throw new Error('Provedor documental não suportado. O EMPROVEX utiliza exclusivamente o Google Drive.');
  }
  return storage;
}

export function isGoogleDriveDocument(document: StorageBackedDocument): boolean {
  return document.storage?.provider === 'google-drive';
}

export function assertActiveDocumentStorage(document: StorageBackedDocument): DocumentStorageRef {
  const storage = resolveDocumentStorageRef(document);
  if (storage.status !== 'active') {
    throw new Error('O documento não está mais disponível no armazenamento ativo.');
  }
  return storage;
}
