import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(content, text, message) {
  if (!content.includes(text)) throw new Error(message);
}

const model = read('lib/platformAdminUsage.ts');
const panel = read('components/admin/AdminConsolidatedUsagePanel.tsx');
const telemetry = read('lib/workspaceUsageTelemetry.ts');

requireText(model, 'export function reconcileWorkspaceUsage(', 'Modelo de reconciliação ausente.');
requireText(model, 'unattributedDocumentReads', 'Reads não atribuídos ausentes.');
requireText(model, 'coveragePercentage', 'Cobertura de reads ausente.');
requireText(model, 'unattributedDocumentWrites', 'Writes não atribuídos ausentes.');
requireText(panel, 'data-testid="admin-usage-reconciliation"', 'Painel de reconciliação ausente.');
requireText(panel, 'Read Units e Write Units não entram neste percentual', 'Separação entre unidades faturáveis e documentos foi perdida.');
requireText(panel, 'Reads não atribuídos', 'Painel não exibe reads não atribuídos.');
requireText(telemetry, "export const WORKSPACE_USAGE_SOURCE = 'emprovex-workspace-estimate'", 'Fonte de telemetria por UG mudou inesperadamente.');

console.log('Workspace usage reconciliation guard: OK');
