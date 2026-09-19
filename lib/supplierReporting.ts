import type { Empenho, Invoice } from './types';
import { isValidSupplierCnpj, normalizeSupplierCnpj } from './invoiceIdentity';

export interface SupplierEmpenhoReport {
  empenho: Empenho;
  invoices: Invoice[];
  totalCommitted: number;
  totalReceived: number;
  balance: number;
  invoicesWithNs: number;
  invoicesWithoutNs: number;
}

export interface SupplierPregaoReport {
  pregao: string;
  empenhos: SupplierEmpenhoReport[];
  totalCommitted: number;
  totalReceived: number;
  balance: number;
  invoiceCount: number;
  invoicesWithNs: number;
  invoicesWithoutNs: number;
}

export interface SupplierReport {
  cnpj: string;
  cnpjValid: boolean;
  supplierName: string;
  aliases: string[];
  empenhos: SupplierEmpenhoReport[];
  pregoes: SupplierPregaoReport[];
  totalCommitted: number;
  totalReceived: number;
  balance: number;
  invoiceCount: number;
  invoicesWithNs: number;
  invoicesWithoutNs: number;
  nsCoverage: number;
}

function totalCommitted(empenho: Empenho): number {
  return empenho.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function pickSupplierName(empenhos: Empenho[]): { supplierName: string; aliases: string[] } {
  const counts = new Map<string, number>();

  for (const empenho of empenhos) {
    const name = empenho.supplier.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const aliases = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const supplierName = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]?.[0] || 'Fornecedor sem razão social';

  return { supplierName, aliases };
}

export function buildSupplierReports(empenhos: Empenho[], invoices: Invoice[]): SupplierReport[] {
  const empenhosByCnpj = new Map<string, Empenho[]>();

  for (const empenho of empenhos) {
    const cnpj = normalizeSupplierCnpj(empenho.supplierCnpj);
    if (!cnpj) continue;
    const current = empenhosByCnpj.get(cnpj) || [];
    current.push(empenho);
    empenhosByCnpj.set(cnpj, current);
  }

  return Array.from(empenhosByCnpj.entries())
    .map(([cnpj, supplierEmpenhos]) => {
      const empenhoIds = new Set(supplierEmpenhos.map((empenho) => empenho.id));
      const supplierInvoices = invoices.filter((invoice) => empenhoIds.has(invoice.empenhoId));
      const { supplierName, aliases } = pickSupplierName(supplierEmpenhos);

      const empenhoReports: SupplierEmpenhoReport[] = supplierEmpenhos
        .map((empenho) => {
          const linkedInvoices = supplierInvoices
            .filter((invoice) => invoice.empenhoId === empenho.id)
            .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
          const committed = totalCommitted(empenho);
          const received = linkedInvoices.reduce((sum, invoice) => sum + invoice.totalValue, 0);
          const withNs = linkedInvoices.filter((invoice) => Boolean(invoice.numeroNS)).length;

          return {
            empenho,
            invoices: linkedInvoices,
            totalCommitted: committed,
            totalReceived: received,
            balance: Math.max(0, committed - received),
            invoicesWithNs: withNs,
            invoicesWithoutNs: linkedInvoices.length - withNs,
          };
        })
        .sort((a, b) => b.empenho.id.localeCompare(a.empenho.id));

      const pregaoMap = new Map<string, SupplierEmpenhoReport[]>();
      for (const empenhoReport of empenhoReports) {
        const pregao = empenhoReport.empenho.pregao?.trim() || 'Sem Pregão';
        const current = pregaoMap.get(pregao) || [];
        current.push(empenhoReport);
        pregaoMap.set(pregao, current);
      }

      const pregoes: SupplierPregaoReport[] = Array.from(pregaoMap.entries())
        .map(([pregao, reports]) => ({
          pregao,
          empenhos: reports,
          totalCommitted: reports.reduce((sum, report) => sum + report.totalCommitted, 0),
          totalReceived: reports.reduce((sum, report) => sum + report.totalReceived, 0),
          balance: reports.reduce((sum, report) => sum + report.balance, 0),
          invoiceCount: reports.reduce((sum, report) => sum + report.invoices.length, 0),
          invoicesWithNs: reports.reduce((sum, report) => sum + report.invoicesWithNs, 0),
          invoicesWithoutNs: reports.reduce((sum, report) => sum + report.invoicesWithoutNs, 0),
        }))
        .sort((a, b) => a.pregao.localeCompare(b.pregao, 'pt-BR', { numeric: true }));

      const committed = empenhoReports.reduce((sum, report) => sum + report.totalCommitted, 0);
      const received = empenhoReports.reduce((sum, report) => sum + report.totalReceived, 0);
      const withNs = supplierInvoices.filter((invoice) => Boolean(invoice.numeroNS)).length;

      return {
        cnpj,
        cnpjValid: isValidSupplierCnpj(cnpj),
        supplierName,
        aliases,
        empenhos: empenhoReports,
        pregoes,
        totalCommitted: committed,
        totalReceived: received,
        balance: Math.max(0, committed - received),
        invoiceCount: supplierInvoices.length,
        invoicesWithNs: withNs,
        invoicesWithoutNs: supplierInvoices.length - withNs,
        nsCoverage: supplierInvoices.length > 0 ? Math.round((withNs / supplierInvoices.length) * 100) : 0,
      };
    })
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'pt-BR'));
}
