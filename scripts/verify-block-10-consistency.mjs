#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) findings.push(message);
};
const forbidText = (source, forbidden, message) => {
  if (source.includes(forbidden)) findings.push(message);
};

const analyzer = read('lib/historicalConsistency.ts');
const service = read('lib/historicalConsistencyService.ts');
const view = read('features/relatorios/components/HistoricalConsistencyView.tsx');
const reports = read('features/relatorios/components/RelatoriosView.tsx');
const audit = read('lib/auditTrail.ts');
const rules = read('firestore.rules');
const e2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const fixture = read('scripts/firestore-multitenancy-security.test.mjs');
const docs = read('docs/BLOCK_10_HISTORICAL_CONSISTENCY.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

for (const code of [
  "'empenho_invalid_cnpj'",
  "'invoice_missing_empenho'",
  "'invoice_missing_supplier_cnpj'",
  "'invoice_invalid_supplier_cnpj'",
  "'invoice_supplier_cnpj_mismatch'",
  "'invoice_record_key_missing'",
  "'invoice_record_key_mismatch'",
  "'invoice_invalid_ns'",
  "'invoice_ug_without_ns'",
  "'invoice_ns_without_ug'",
  "'invoice_ns_wrong_workspace_ug'",
  "'duplicate_ns_identity'",
  "'canonical_lock_missing'",
  "'canonical_lock_conflict'",
  "'canonical_lock_metadata_mismatch'",
  "'legacy_lock_migration_available'",
  "'legacy_lock_redundant'",
  "'orphan_ns_lock'",
]) {
  requireText(analyzer, code, `Analyzer perdeu classificação histórica: ${code}`);
}

requireText(analyzer, "repairMode: 'manual_review'", 'Analyzer não possui classe explícita de revisão humana.');
requireText(analyzer, "repairMode: 'automatic'", 'Analyzer não possui classe explícita de reparo automático.');
requireText(analyzer, 'rawInvoiceCnpj && !isValidSupplierCnpj(rawInvoiceCnpj)', 'CNPJ inválido da NF pode estar sendo confundido com CNPJ ausente.');
requireText(analyzer, "summary: 'NS histórica não possui UG confiável.'", 'NS histórica sem UG perdeu bloqueio de inferência.');
requireText(analyzer, 'duplicateOwners.length === 1', 'Reconstrução de lock não exige identidade NS única.');
requireText(analyzer, 'invoiceByStoredRecordKey.has(ownerKey)', 'Scanner pode apagar lock ligado a NF fisicamente deslocada.');
requireText(analyzer, "String(invoice.recordKey || '').trim() === document.documentId", 'Reconstrução de lock não exige recordKey persistida.');

for (const repair of [
  "'backfill_invoice_supplier_cnpj'",
  "'backfill_invoice_record_key'",
  "'clear_orphan_ns_ug'",
  "'rebuild_canonical_lock'",
  "'refresh_canonical_lock'",
  "'migrate_legacy_lock'",
  "'delete_redundant_legacy_lock'",
  "'delete_orphan_lock'",
]) {
  requireText(service, repair, `Serviço perdeu reparo controlado: ${repair}`);
}

requireText(service, 'runTransaction(db, async (transaction)', 'Reparos históricos não são transacionais.');
requireText(service, "operation: 'historical.repair'", 'Reparos não geram evento de auditoria histórico.');
requireText(service, "source: 'system'", 'Origem de reparo histórico não está identificada.');
requireText(service, 'getCurrentOperationalScope(user.uid)', 'Scanner/reparo não usa escopo autenticado.');
requireText(service, 'A UG da NF diverge da UG autenticada do workspace.', 'Reparo de lock não revalida UG do workspace.');
requireText(service, 'A NF proprietária existe novamente. O lock não foi removido.', 'Remoção de lock órfão não revalida a ausência da NF.');
requireText(service, 'A NF passou a possuir NS. O reparo automático de CNPJ foi bloqueado.', 'Backfill de CNPJ não revalida ausência de NS.');

requireText(audit, "| 'historical.repair'", 'Taxonomia de auditoria não inclui historical.repair.');
requireText(audit, "| 'ns_lock';", 'Auditoria não reconhece entidade ns_lock.');
requireText(rules, "'historical.repair'", 'Firestore Rules não reconhecem evento historical.repair.');
requireText(rules, "'ns_lock'", 'Firestore Rules não reconhecem entidade de auditoria ns_lock.');

requireText(reports, "id: 'integridade'", 'Relatórios não possui subaba Integridade.');
requireText(reports, '<HistoricalConsistencyView />', 'Subaba Integridade não monta o centro de diagnóstico.');
requireText(reports, 'data-testid={`relatorios-tab-${tab.id}`}', 'Subabas de Relatórios perderam seletor estável E2E.');
requireText(view, 'scanHistoricalConsistency', 'UI não executa diagnóstico real.');
requireText(view, 'repairHistoricalConsistencyIssue', 'UI não executa reparo transacional real.');
requireText(view, "issue.repairMode === 'automatic'", 'UI pode estar exibindo reparo para achados não automáticos.');
requireText(view, 'Revisão documental necessária', 'UI não diferencia achado que exige decisão humana.');

requireText(fixture, 'nf_11111111000191_2002', 'Fixture E2E não contém inconsistência histórica segura.');
requireText(fixture, "supplier: 'Fornecedor E2E Lifecycle'", 'Fixture histórica E2E perdeu vínculo de fornecedor.');
forbidText(
  fixture.slice(fixture.indexOf("'workspaces/workspace-lifecycle/invoices/nf_11111111000191_2002'"), fixture.indexOf("await ownerSet('workspaces/workspace-b/empenhos/sample'")),
  "supplierCnpj:",
  'Fixture E2E 2002 não deve nascer com CNPJ; o diagnóstico precisa detectar ausência real.'
);

requireText(e2e, "relatorios-tab-integridade", 'Browser E2E não navega até Integridade.');
requireText(e2e, 'historical-consistency-scan', 'Browser E2E não executa diagnóstico.');
requireText(e2e, 'historical-issue-invoice_missing_supplier_cnpj', 'Browser E2E não detecta inconsistência segura.');
requireText(e2e, 'repair-backfill_invoice_supplier_cnpj', 'Browser E2E não executa reparo seguro.');
requireText(e2e, 'historical-consistency-clean', 'Browser E2E não comprova diagnóstico limpo após reparo.');
requireText(e2e, 'page.reload()', 'Browser E2E não comprova persistência do saneamento.');

requireText(docs, 'não adivinha CNPJ', 'Contrato não proíbe inferência de CNPJ.');
requireText(docs, 'não adivinha UG histórica', 'Contrato não proíbe inferência de UG histórica.');
requireText(docs, 'não escolhe proprietário de NS duplicada', 'Contrato não protege conflito de propriedade de NS.');
requireText(docs, 'revalidação transacional', 'Contrato não exige revalidação antes da escrita.');
requireText(docs, 'historical.repair', 'Contrato não documenta auditoria dos reparos.');

requireText(pkg, '"verify:block-10-consistency"', 'package.json não registra guard do Bloco 10.');
requireText(workflow, 'Block 10 historical consistency guard', 'Application CI não executa guard do Bloco 10.');

if (findings.length) {
  console.error('BLOCK 10 HISTORICAL CONSISTENCY: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 10 HISTORICAL CONSISTENCY: READY');
  console.log('Diagnóstico histórico: SOMENTE LEITURA');
  console.log('Reparos automáticos: SOMENTE INEQUÍVOCOS');
  console.log('Revalidação antes da escrita: TRANSACIONAL');
  console.log('CNPJ/UG/NS ambíguos: REVISÃO HUMANA');
  console.log('Auditoria dos reparos: IMUTÁVEL');
  console.log('Browser E2E: DIAGNÓSTICO + REPARO + RELOAD');
}
