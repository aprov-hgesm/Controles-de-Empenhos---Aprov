import type { Alert, AlertStatus } from '../../../lib/types';

export type NoticeSeverity = 'INFORMATIVO' | 'ATENÇÃO' | 'CRÍTICO';

const LEGACY_INFORMATIONAL_PATTERNS = [
  /novo empenho cadastrado/i,
  /recebida com sucesso/i,
  /editada com sucesso/i,
  /concilia[cç][aã]o realizada/i,
];

export function getNoticeSeverity(alert: Alert): NoticeSeverity {
  if (alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO') return 'CRÍTICO';
  if (alert.type === 'INFORMATIVO') return 'INFORMATIVO';

  const legacyText = `${alert.title} ${alert.subtitle} ${alert.description}`;
  if (LEGACY_INFORMATIONAL_PATTERNS.some((pattern) => pattern.test(legacyText))) {
    return 'INFORMATIVO';
  }

  return 'ATENÇÃO';
}

export function getNoticeStatus(alert: Alert): AlertStatus {
  return alert.status ?? 'NOVO';
}

export function isNoticeUnread(alert: Alert): boolean {
  return getNoticeStatus(alert) === 'NOVO';
}

export function isNoticePending(alert: Alert): boolean {
  const status = getNoticeStatus(alert);
  const severity = getNoticeSeverity(alert);
  return severity !== 'INFORMATIVO'
    && status !== 'RESOLVIDO'
    && status !== 'ARQUIVADO';
}

export function isNoticeVisibleInActiveQueue(alert: Alert): boolean {
  return getNoticeStatus(alert) !== 'ARQUIVADO';
}

export function getNoticeSortTimestamp(alert: Alert): number {
  const candidates = [alert.createdAt, alert.date];

  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const numericId = Number(alert.id.replace(/\D/g, ''));
  return Number.isFinite(numericId) ? numericId : 0;
}

export function countPendingNotices(alerts: Alert[]): number {
  return alerts.filter(isNoticePending).length;
}

export function countUnreadNotices(alerts: Alert[]): number {
  return alerts.filter(isNoticeUnread).length;
}
