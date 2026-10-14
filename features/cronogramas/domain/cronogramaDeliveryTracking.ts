import type {
  CronogramaEmailEnvio,
  CronogramaEmailRemessaEnviada,
  CronogramaEntregaColuna,
  CronogramaEmpenho,
  Empenho,
  Invoice,
} from '../../../lib/types';

type CronogramaDistribution = Record<string, Record<string, number>>;

export interface SentCronogramaRecord {
  key: string;
  empenhoId: string;
  envio: CronogramaEmailEnvio;
}

/** Congela no envio o conteúdo das remessas, sem consultar saldos posteriormente. */
export function snapshotCronogramaRemessas(
  empenho: Empenho,
  colunas: CronogramaEntregaColuna[],
  distribuicao: CronogramaDistribution
): CronogramaEmailRemessaEnviada[] {
  return colunas.map((coluna) => ({
    id: coluna.id,
    titulo: coluna.titulo,
    dataPrevista: coluna.dataPrevista,
    materiais: empenho.items.flatMap((item) => {
      const quantidade = Number(distribuicao[item.id]?.[coluna.id] ?? 0);
      if (!Number.isFinite(quantidade) || quantidade <= 0) return [];
      return [{
        itemId: item.id,
        nome: item.name,
        unidade: item.unit,
        quantidade,
      }];
    }),
  }));
}

/** Lê YYYY-MM-DD ou ISO com data inicial, sem converter para o fuso local. */
export function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function utcDay(date: string): Date {
  return new Date(date + 'T00:00:00Z');
}
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Semana civil da data prevista: segunda-feira até domingo, inclusivamente. */
export function remessaWeekRange(dateValue: string): { start: string; end: string } | null {
  const date = dateOnly(dateValue);
  if (!date) return null;
  const start = utcDay(date);
  const weekDay = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((weekDay + 6) % 7));
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: isoDay(start), end: isoDay(end) };
}

/** Correspondência documental: mesmo empenho e data de EMISSÃO da NF na semana. */
export function matchInvoicesForRemessaWeek(
  empenhoId: string,
  remessaDate: string,
  invoices: readonly Invoice[]
): Invoice[] {
  const range = remessaWeekRange(remessaDate);
  if (!range) return [];
  const key = empenhoId.trim();
  return invoices
    .filter((invoice) => {
      const issue = dateOnly(invoice.issueDate);
      return invoice.empenhoId.trim() === key
        && issue !== null && issue >= range.start && issue <= range.end;
    })
    .sort((left, right) => (left.issueDate || '').localeCompare(right.issueDate || '') || left.id.localeCompare(right.id));
}

/** Evita duplicar o último envio quando ele já consta no histórico persistido. */
export function listSentCronogramas(cronogramas: readonly CronogramaEmpenho[]): SentCronogramaRecord[] {
  const all: SentCronogramaRecord[] = [];
  for (const cronograma of cronogramas) {
    const history = cronograma.historicoEnviosEmail || [];
    const recorded = new Set<string>();
    for (const envio of history) {
      if (!envio?.enviadoEm || !envio?.messageId) continue;
      recorded.add(envio.messageId);
      all.push({
        key: `${cronograma.empenhoId}:${envio.messageId}`,
        empenhoId: cronograma.empenhoId,
        envio,
      });
    }
    if (cronograma.ultimoEnvioEmail?.enviadoEm && cronograma.ultimoEnvioEmail.messageId
        && !recorded.has(cronograma.ultimoEnvioEmail.messageId)) {
      const envio = cronograma.ultimoEnvioEmail;
      all.push({
        key: `${cronograma.empenhoId}:${envio.messageId}`,
        empenhoId: cronograma.empenhoId,
        envio,
      });
    }
  }
  return all.sort((a, b) =>
    b.envio.enviadoEm.localeCompare(a.envio.enviadoEm)
      || a.empenhoId.localeCompare(b.empenhoId)
  );
}
