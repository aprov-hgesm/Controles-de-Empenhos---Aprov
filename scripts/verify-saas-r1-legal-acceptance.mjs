#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertContains(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(label + ': trecho obrigatório ausente: ' + needle);
  }
}

const versions = read('lib/legalVersions.ts');
const domain = read('lib/legalAcceptance.ts');
const hook = read('hooks/useLegalAcceptance.ts');
const gate = read('components/legal/LegalAcceptanceGate.tsx');
const terms = read('app/terms/page.tsx');
const privacy = read('app/privacy/page.tsx');
const rules = read('firestore.rules');

assertContains(versions, "legalBundleVersion: 'saas-r1-2026-10-01'", 'Versão do pacote legal');
assertContains(versions, "termsVersion: 'terms-2026-10-01-r1'", 'Versão dos Termos');
assertContains(versions, "privacyVersion: 'privacy-2026-10-01-r1'", 'Versão da Privacidade');
assertContains(versions, "uid", 'ID determinístico');
assertContains(versions, "'__'", 'Separador do ID determinístico');

assertContains(domain, "runTransaction", 'Aceite idempotente');
assertContains(domain, "serverTimestamp()", 'Timestamp confiável');
assertContains(domain, "'legalAcceptances'", 'Coleção tenant-scoped');
assertContains(domain, "hasAcceptedCurrentLegalBundle", 'Leitura da versão vigente');

assertContains(hook, "'checking'", 'Estado de verificação');
assertContains(hook, "'accepted'", 'Estado aceito');
assertContains(hook, "'required'", 'Estado de novo aceite');

assertContains(gate, 'Li e aceito os Termos de Serviço e a Política de Privacidade.', 'Terminologia do aceite');
assertContains(gate, 'href="/terms"', 'Link público para Termos');
assertContains(gate, 'href="/privacy"', 'Link público para Privacidade');
assertContains(gate, 'não significa que todo tratamento de dados pessoais dependa de consentimento', 'Separação entre aceite e consentimento');

assertContains(terms, 'Plano Completo', 'Termos comerciais');
assertContains(terms, '30 dias', 'Trial');
assertContains(terms, 'Mercado Pago', 'Cobrança externa');
assertContains(terms, 'Pix', 'Pix');
assertContains(terms, 'Cancelamento comercial e exclusão de dados são procedimentos diferentes.', 'Cancelamento separado de exclusão');
assertContains(terms, 'não há promessa de', 'Disponibilidade sem garantia absoluta');
assertContains(terms, 'version={CURRENT_LEGAL_BUNDLE.termsVersion}', 'Versão pública dos Termos');

assertContains(privacy, 'Firebase e Google Cloud', 'Infraestrutura Google');
assertContains(privacy, 'Vercel', 'Infraestrutura Vercel');
assertContains(privacy, 'Mercado Pago', 'Provedor de pagamento');
assertContains(privacy, 'não precisa armazenar credenciais de cartão', 'Minimização de dados de pagamento');
assertContains(privacy, 'Logs, eventos de auditoria', 'Logs e auditoria');
assertContains(privacy, 'Backups podem conter', 'Backup');
assertContains(privacy, 'Direitos do titular', 'Direitos do titular');
assertContains(privacy, 'version={CURRENT_LEGAL_BUNDLE.privacyVersion}', 'Versão pública da Privacidade');
assertContains(privacy, 'não significa que todo tratamento de dados pessoais dependa de consentimento', 'Bases legais sem consentimento genérico');

assertContains(rules, 'function validLegalAcceptanceCreate', 'Rules do aceite');
assertContains(rules, "match /workspaces/{workspaceId}/legalAcceptances/{acceptanceId}", 'Caminho do aceite');
assertContains(rules, 'allow list: if false;', 'Sem listagem tenant');
assertContains(rules, 'allow update, delete: if false;', 'Imutabilidade do aceite');
assertContains(rules, "acceptedAt == request.time", 'Timestamp autoritativo');
assertContains(rules, "legalBundleVersion == 'saas-r1-2026-10-01'", 'Versão esperada nas Rules');

console.log('SAAS-DL LEGAL ACCEPTANCE VERIFY: READY');
