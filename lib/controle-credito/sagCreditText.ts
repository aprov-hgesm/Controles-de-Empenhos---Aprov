/**
 * SAG NC — interpretação determinística de texto previamente extraído.
 * R1: um favorecido, um sequencial, uma linha de destino.
 * Não executa OCR nem interpreta bytes PDF. Resultado sempre em revisão.
 */
export interface SagCreditCell {
  ug: string; item: string; num: string; esfera: string;
  ptres: string; fonte: string | null; nd: string;
  ugr: string; pi: string | null; cents: number;
}
export interface SagCreditDraft {
  number: string; issuingUg: string; issueDate: string;
  totalCents: number; description: string; deadline: string | null;
  origin: SagCreditCell | null; destination: SagCreditCell;
  warnings: string[]; requiresReview: true;
}
const months: Record<string, string> = {
  JAN:'01', FEV:'02', MAR:'03', ABR:'04', MAI:'05', JUN:'06',
  JUL:'07', AGO:'08', SET:'09', OUT:'10', NOV:'11', DEZ:'12',
};
function date(year: string, month: string, day: string): string | null {
  const result = year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0');
  const ms = Date.parse(result + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === result ? result : null;
}
function cents(value: string): number {
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(value)) throw new Error('Valor monetário SAG inválido.');
  const parsed = Number(value.replace(/[.,]/g,''));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Valor monetário SAG inválido.');
  return parsed;
}
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}
function oneMatch(text: string, pattern: RegExp, label: string): RegExpMatchArray {
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(label + ' ausente ou ambíguo; use o cadastro manual.');
  return matches[0];
}
function parseCell(section: string, warnings: string[], label: string): SagCreditCell {
  const row = oneMatch(section, /^\s*(\d{6})[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d{6})[ \t]+([A-Z0-9]+)[ \t]+(\d{6})[ \t]+(\d{6})[ \t]+([A-Z0-9-]+)[ \t]+(?:R\$\s*)?(\d[\d.]*,\d{2})[ \t]*$/gm, 'Linha de ' + label);
  // Fail closed if another candidate data row exists, even if malformed.
  const candidates = section.split('\n').filter(line => /^\s*\d{6}\s/.test(line));
  if (candidates.length !== 1) throw new Error('Múltiplas linhas ou leitura incompleta em ' + label + '.');
  const fonte = /^\d{10}$/.test(row[6]) ? row[6] : null;
  if (!fonte) warnings.push('Fonte de recursos de ' + label + ' ilegível; conferir no original.');
  const pi = row[9] === '-' ? null : row[9];
  return { ug:row[1], item:row[2], num:row[3], esfera:row[4], ptres:row[5],
    fonte, nd:row[7], ugr:row[8], pi, cents:cents(row[10]) };
}
export function parseSagCreditText(raw: string, expectedUg: string): SagCreditDraft {
  if (!/^\d{6}$/.test(expectedUg) || !raw.trim() || raw.length > 200_000) throw new Error('Texto ou UG inválidos.');
  const text = normalize(raw.replace(/\r\n?/g,'\n'));
  if (!/NOTA DE CREDITO ORCAMENTARIO/.test(text)) throw new Error('Documento não reconhecido como NC do SAG.');
  const number = oneMatch(text, /^\s*(20\d{2}NC\d{6})[ \t]*$/gm,'Número da NC')[1];
  const longNumber = oneMatch(text, /\bNUMERO NC[ \t]+(\d+20\d{2}NC\d{6})\b/g,'Identificador completo')[1];
  const issuingUg = oneMatch(text, /\bUG EMITENTE[ \t]+(\d{6})\b/g,'UG emitente')[1];
  if (!longNumber.startsWith(issuingUg) || !longNumber.endsWith(number)) throw new Error('Identificadores da NC divergentes.');
  const emission = oneMatch(text, /\bDATA EMISSAO[ \t]+(\d{2})\/(\d{2})\/(\d{4})\b/g,'Data de emissão');
  const issueDate = date(emission[3], emission[2], emission[1]);
  if (!issueDate) throw new Error('Data de emissão inválida.');
  const totalCents = cents(oneMatch(text, /\bVALOR TOTAL[ \t]+(?:R\$\s*)?(\d[\d.]*,\d{2})\b/g,'Valor total')[1]);
  const count = oneMatch(text, /QTDE\.\s*UGS FAV\.\s*(\d+)/g,'Quantidade de UGs favorecidas')[1];
  if (count !== '1') throw new Error('NC com múltiplas UGs exige conciliação manual nesta versão.');
  if ([...text.matchAll(/SEQUENCIAL\s+\d+/g)].length !== 1) throw new Error('NC com múltiplos sequenciais ou sequencial ausente.');
  const desc = oneMatch(text, /(?:^|\n)DESCRI(?:C|G)AO[ \t]*\n([\s\S]+?)\n[^\n]*DETALHAMENTO POR UG FAVORECIDA/g,'Descrição')[1].trim().replace(/\s+/g,' ');
  const description = desc;
  const warnings: string[] = [];
  const explicit = [...description.matchAll(/PRAZO (?:DE|PARA) EMPENHO\s*:?\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4}|\d{2})\b/g)];
  const numeric = [...description.matchAll(/PRAZO (?:DE|PARA) EMPENHO\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g)];
  let deadline: string | null = null;
  const candidates = [...explicit.map(m=>[m[1],months[m[2]],m[3]]),...numeric.map(m=>[m[1],m[2],m[3]])];
  if (candidates.length === 1 && candidates[0][1]) {
    const [d,m,y] = candidates[0];
    deadline = date(y.length === 2 ? '20'+y : y,m,d);
  }
  if (!deadline) warnings.push('Prazo de empenho ausente ou ambíguo; conferir na descrição.');
  if (deadline && deadline < issueDate) { deadline = null; warnings.push('Prazo anterior à emissão; conferir.'); }
  const originSection = oneMatch(text, /ORIGEM DO CREDITO\s*\n([\s\S]+?)\n\s*DESTINO DO CREDITO/g,'Seção origem')[1];
  const destinationSection = oneMatch(text, /DESTINO DO CREDITO\s*\n([\s\S]+)/g,'Seção destino')[1];
  const origin = parseCell(originSection,warnings,'origem');
  const destination = parseCell(destinationSection,warnings,'destino');
  if (destination.ug !== expectedUg || origin.ug !== expectedUg) throw new Error('UG favorecida incompatível.');
  if (destination.cents !== totalCents || origin.cents !== totalCents) throw new Error('Valores de origem, destino e total divergentes.');
  if (!destination.pi) warnings.push('PI de destino não informado; conferir no documento.');
  return { number, issuingUg, issueDate, totalCents, description, deadline, origin, destination, warnings, requiresReview:true };
}
