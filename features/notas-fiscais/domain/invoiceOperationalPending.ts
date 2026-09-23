import type { Empenho, Invoice } from '../../../lib/types';
import {
  classRequiresTermoRecebimento,
  mergeEmpenhoClassDefinitions,
  type EmpenhoClassDefinition,
} from '../../../lib/empenhoClasses';

export type InvoiceOperationalPendingStage = 'none' | 'commission' | 'treasury';

export interface EmpenhoInvoicePendingSummary {
  stage: InvoiceOperationalPendingStage;
  count: number;
  commissionCount: number;
  treasuryCount: number;
  invoiceIds: string[];
  message: string;
}

export function getInvoiceOperationalPendingStage(
  invoice: Invoice,
  empenho: Empenho,
  classDefinitions: EmpenhoClassDefinition[]
): InvoiceOperationalPendingStage {
  if (invoice.localizacaoAtual === 'TESOURARIA' || invoice.tesourariaDate) {
    return 'none';
  }

  const requiresCommission = classRequiresTermoRecebimento(
    empenho.classification,
    classDefinitions
  );

  // localizacaoAtual é a fonte operacional quando existe; as datas permanecem
  // como histórico e servem apenas de fallback para registros legados.
  if (invoice.localizacaoAtual === 'COMISSAO') {
    return 'treasury';
  }

  if (invoice.localizacaoAtual === 'APROVISIONAMENTO') {
    return requiresCommission ? 'commission' : 'treasury';
  }

  if (!requiresCommission) {
    return 'treasury';
  }

  return invoice.comissaoDate ? 'treasury' : 'commission';
}

function formatInvoiceReference(invoiceIds: string[]): string {
  const visible = invoiceIds.slice(0, 3).map((id) => `NF #${id}`);
  const extra = Math.max(0, invoiceIds.length - visible.length);
  return `${visible.join(', ')}${extra > 0 ? ` +${extra}` : ''}`;
}

export function summarizeEmpenhoInvoicePending(
  empenho: Empenho,
  invoices: Invoice[],
  classDefinitions: EmpenhoClassDefinition[]
): EmpenhoInvoicePendingSummary {
  const linked = invoices.filter((invoice) => invoice.empenhoId === empenho.id);
  const commissionIds: string[] = [];
  const treasuryIds: string[] = [];

  linked.forEach((invoice) => {
    const stage = getInvoiceOperationalPendingStage(
      invoice,
      empenho,
      classDefinitions
    );

    if (stage === 'commission') commissionIds.push(invoice.id);
    if (stage === 'treasury') treasuryIds.push(invoice.id);
  });

  const invoiceIds = [...commissionIds, ...treasuryIds];
  const count = invoiceIds.length;

  if (commissionIds.length > 0) {
    return {
      stage: 'commission',
      count,
      commissionCount: commissionIds.length,
      treasuryCount: treasuryIds.length,
      invoiceIds,
      message: `${formatInvoiceReference(commissionIds)} ${commissionIds.length === 1 ? 'precisa' : 'precisam'} ser enviada${commissionIds.length === 1 ? '' : 's'} à Comissão de Recebimento.`,
    };
  }

  if (treasuryIds.length > 0) {
    return {
      stage: 'treasury',
      count,
      commissionCount: 0,
      treasuryCount: treasuryIds.length,
      invoiceIds,
      message: `${formatInvoiceReference(treasuryIds)} ${treasuryIds.length === 1 ? 'aguarda' : 'aguardam'} envio à Tesouraria.`,
    };
  }

  return {
    stage: 'none',
    count: 0,
    commissionCount: 0,
    treasuryCount: 0,
    invoiceIds: [],
    message: 'Nenhuma Nota Fiscal com pendência de tramitação.',
  };
}

export function buildDefaultInvoicePendingClassDefinitions(
  empenhos: Empenho[]
): EmpenhoClassDefinition[] {
  return mergeEmpenhoClassDefinitions([], empenhos);
}
