from pathlib import Path


def patch(path: str, old: str, new: str) -> None:
    p = Path(path)
    content = p.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'Trecho esperado não encontrado em {path}: {old[:120]!r}')
    p.write_text(content.replace(old, new, 1), encoding='utf-8')

# A leitura e exclusão de Blob devem validar a NF de origem gravada no próprio metadado.
patch(
    'app/api/invoice-documents/route.ts',
    """    const empenhoId = normalizeEmpenhoId(url.searchParams.get('empenhoId'));\n    normalizeInvoiceId(url.searchParams.get('invoiceId'));\n    const pathname = assertStoredInvoicePath(url.searchParams.get('pathname'), empenhoId);\n""",
    """    const empenhoId = normalizeEmpenhoId(url.searchParams.get('empenhoId'));\n    const invoiceId = normalizeInvoiceId(url.searchParams.get('invoiceId'));\n    const pathname = assertInvoiceUploadPath(url.searchParams.get('pathname'), empenhoId, invoiceId);\n""",
)
patch(
    'app/api/invoice-documents/route.ts',
    """    const body = (await request.json()) as { empenhoId?: unknown; pathname?: unknown };\n    const empenhoId = normalizeEmpenhoId(body.empenhoId);\n    const pathname = assertStoredInvoicePath(body.pathname, empenhoId);\n""",
    """    const body = (await request.json()) as { empenhoId?: unknown; invoiceId?: unknown; pathname?: unknown };\n    const empenhoId = normalizeEmpenhoId(body.empenhoId);\n    const invoiceId = normalizeInvoiceId(body.invoiceId);\n    const pathname = assertInvoiceUploadPath(body.pathname, empenhoId, invoiceId);\n""",
)
# assertStoredInvoicePath deixa de ser necessário na rota principal.
patch(
    'app/api/invoice-documents/route.ts',
    """  assertInvoiceUploadPath,\n  assertStoredInvoicePath,\n""",
    """  assertInvoiceUploadPath,\n""",
)

# O cliente sempre envia o identificador de origem do PDF também nas limpezas de upload incompleto.
patch(
    'lib/invoiceDocuments.ts',
    """      body: JSON.stringify({ empenhoId, pathname: blob.pathname }),\n""",
    """      body: JSON.stringify({ empenhoId, invoiceId, pathname: blob.pathname }),\n""",
)
patch(
    'lib/invoiceDocuments.ts',
    """export async function deleteInvoicePdfUpload(\n  user: User,\n  empenhoId: string,\n  pathname: string\n): Promise<void> {\n""",
    """export async function deleteInvoicePdfUpload(\n  user: User,\n  empenhoId: string,\n  invoiceId: string,\n  pathname: string\n): Promise<void> {\n""",
)
patch(
    'lib/invoiceDocuments.ts',
    """    body: JSON.stringify({ empenhoId, pathname }),\n""",
    """    body: JSON.stringify({ empenhoId, invoiceId, pathname }),\n""",
)
patch(
    'components/InvoiceDocumentActions.tsx',
    """        await deleteInvoicePdfUpload(user, uploadedDocument.empenhoId, uploadedDocument.pathname).catch(() => undefined);\n""",
    """        await deleteInvoicePdfUpload(user, uploadedDocument.empenhoId, uploadedDocument.invoiceId, uploadedDocument.pathname).catch(() => undefined);\n""",
)

# Exclusão de uma NF não apaga automaticamente seus PDFs: evita perda documental caso a persistência
# do Firestore falhe ou a exclusão seja revertida. Uma política de retenção pode ser adicionada depois.
patch(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    """import { deleteInvoicePdfUpload, uploadInvoicePdf } from '../../../lib/invoiceDocuments';\n""",
    """import { uploadInvoicePdf } from '../../../lib/invoiceDocuments';\n""",
)
patch(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    """  const removeInvoiceDocuments = async (invoice: Invoice) => {\n    if (!user) return;\n    const documents = [\n      ...(invoice.notaFiscalPdfVersions || []),\n      ...(invoice.notaFiscalPdf ? [invoice.notaFiscalPdf] : []),\n    ].filter((document, index, all) => all.findIndex((item) => item.pathname === document.pathname) === index);\n    await Promise.allSettled(\n      documents.map((document) => deleteInvoicePdfUpload(user, document.empenhoId, document.pathname))\n    );\n  };\n\n""",
    """""",
)
patch(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    """        await removeInvoiceDocuments(invoice);\n""",
    """""",
)
patch(
    'features/notas-fiscais/hooks/useNotasFiscaisActions.ts',
    """        await Promise.all(invoices.map((invoice) => removeInvoiceDocuments(invoice)));\n""",
    """""",
)

print('Hardening final de documentos de NF aplicado.')
