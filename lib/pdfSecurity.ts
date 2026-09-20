export const MAX_WORKSPACE_PDF_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface WorkspacePdfValidationOptions {
  maxBytes?: number;
  requireDeclaredPdfMime?: boolean;
}

export async function assertWorkspacePdfIsSafeForStorage(
  blob: Blob,
  options: WorkspacePdfValidationOptions = {}
): Promise<void> {
  const maxBytes = options.maxBytes ?? MAX_WORKSPACE_PDF_UPLOAD_BYTES;
  const requireDeclaredPdfMime = options.requireDeclaredPdfMime ?? false;

  if (requireDeclaredPdfMime && blob.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo no formato PDF.');
  }

  if (blob.type && blob.type !== 'application/pdf') {
    throw new Error('O arquivo informado não foi identificado como PDF.');
  }

  if (blob.size <= 0 || blob.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024));
    throw new Error(`O PDF deve possuir no máximo ${maxMb} MB.`);
  }

  const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== '%PDF-') {
    throw new Error('O arquivo selecionado não possui uma assinatura PDF válida.');
  }
}
