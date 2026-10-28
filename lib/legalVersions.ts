export const LEGAL_ACCEPTANCE_SCHEMA_VERSION = 'emprovex_legal_acceptance_v1';

export const CURRENT_LEGAL_BUNDLE = Object.freeze({
  legalBundleVersion: 'saas-r1-2026-10-01',
  termsVersion: 'terms-2026-10-01-r1',
  privacyVersion: 'privacy-2026-10-01-r1',
});

/**
 * PROPOSTA R4 — NÃO ATIVAR NESTA BRANCH.
 * As Firestore Rules em produção aceitam somente saas-r1-2026-10-01 e
 * seus termos/privacidade associados. A ativação de uma nova versão
 * exige coordenação expressa entre Rules, CURRENT_LEGAL_BUNDLE, gate
 * e tratamento do aceite dos usuários já cadastrados.
 *
 * Este objeto é uma proposta documental inerte. A fonte de verdade
 * do runtime continua sendo CURRENT_LEGAL_BUNDLE até a publicação
 * coordenada que for aprovada pelo Coordenador.
 */
export const PROPOSED_LEGAL_BUNDLE_R4 = Object.freeze({
  legalBundleVersion: 'saas-r4-2026-10-27',
  termsVersion: 'terms-2026-10-27-r2',
  privacyVersion: 'privacy-2026-10-27-r2',
});

export type LegalBundleVersions = typeof CURRENT_LEGAL_BUNDLE;

function assertSafeDocumentToken(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(field + ' é obrigatório para o aceite legal.');
  }

  if (normalized.includes('/')) {
    throw new Error(field + ' contém caractere inválido para o identificador do aceite.');
  }

  return normalized;
}

export function legalAcceptanceDocumentId(
  uid: string,
  legalBundleVersion: string = CURRENT_LEGAL_BUNDLE.legalBundleVersion
): string {
  return (
    assertSafeDocumentToken(uid, 'UID')
    + '__'
    + assertSafeDocumentToken(legalBundleVersion, 'Versão do pacote legal')
  );
}
