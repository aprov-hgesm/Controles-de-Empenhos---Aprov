/** O texto é apenas rascunho: nenhum envio ou registro de envio é efetuado. */
export function buildDocumentShareDraft(input: {
  channel: 'whatsapp' | 'email'; documentLabel: string; reference: string; recipientName?: string;
}) {
  const safe = (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
  const ref = safe(input.reference);
  return {
    channel: input.channel,
    subject: `Documento para conferência — ${ref}`,
    body: `${safe(input.recipientName || 'Prezados(as)')},\n\nSegue para conferência ${safe(input.documentLabel)} referente a ${ref}.\n\nAtenciosamente,`,
    status: 'draft' as const,
  };
}
