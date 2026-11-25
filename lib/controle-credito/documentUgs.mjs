// Document UG is not an authentication tenant. Extend only with explicitly authorized codes.
export function creditDocumentUgs(tenantUg) {
  if (typeof tenantUg !== 'string' || !/^\d{6}$/.test(tenantUg)) return [];
  return tenantUg === '160416' ? ['160416', '167416'] : [tenantUg];
}
export function allowsCreditDocumentUg(tenantUg, documentUg) {
  return typeof documentUg === 'string' && creditDocumentUgs(tenantUg).includes(documentUg);
}
export function creditRecordId(tenantUg, issuingUg, number, beneficiaryUg) {
  // Preserve all existing primary-UG IDs and fingerprints; secondary groups are separate records.
  return issuingUg+'_'+number+(beneficiaryUg===tenantUg?'':'_'+beneficiaryUg);
}
