import type { Invoice } from './types';

export interface ReportingPeriod {
  startDate?: string;
  endDate?: string;
}

export function normalizeOperationalDate(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return '';
}

export function isReportingPeriodValid(period: ReportingPeriod): boolean {
  const start = normalizeOperationalDate(period.startDate);
  const end = normalizeOperationalDate(period.endDate);
  return !(start && end && start > end);
}

export function invoiceMatchesReportingPeriod(
  invoice: Pick<Invoice, 'issueDate'>,
  period: ReportingPeriod
): boolean {
  if (!isReportingPeriodValid(period)) return false;

  const start = normalizeOperationalDate(period.startDate);
  const end = normalizeOperationalDate(period.endDate);
  if (!start && !end) return true;

  const issueDate = normalizeOperationalDate(invoice.issueDate);
  if (!issueDate) return false;
  if (start && issueDate < start) return false;
  if (end && issueDate > end) return false;
  return true;
}

export function filterInvoicesByReportingPeriod<T extends Pick<Invoice, 'issueDate'>>(
  invoices: T[],
  period: ReportingPeriod
): T[] {
  return invoices.filter((invoice) => invoiceMatchesReportingPeriod(invoice, period));
}

export function formatReportingPeriodLabel(period: ReportingPeriod): string {
  if (!isReportingPeriodValid(period)) return 'Período inválido';

  const start = normalizeOperationalDate(period.startDate);
  const end = normalizeOperationalDate(period.endDate);
  if (!start && !end) return 'Todo o período';

  const toBr = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  if (start && end) return `${toBr(start)} a ${toBr(end)}`;
  if (start) return `A partir de ${toBr(start)}`;
  return `Até ${toBr(end)}`;
}
