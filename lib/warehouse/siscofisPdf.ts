import {
  EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION,
  type EmprovexSiscofisInventory,
  type EmprovexSiscofisInventoryItem,
} from './siscofis';

type PdfTextItem = {
  page: number;
  x: number;
  y: number;
  text: string;
};

type PdfColumns = {
  ficha: number;
  description: number;
  quantity: number;
  available: number;
  unitValue: number;
  expiry: number;
};

export interface EmprovexSiscofisPdfExtraction {
  inventory: EmprovexSiscofisInventory;
  pageCount: number;
  detectedRows: number;
  zeroQuantityRows: number;
  invalidRows: number;
  referenceDate: string | null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function lookupText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function decodePdfLiteral(source: string, startIndex: number): { value: string; nextIndex: number } | null {
  if (source[startIndex] !== '(') return null;
  let depth = 1;
  let value = '';
  let index = startIndex + 1;

  while (index < source.length && depth > 0) {
    const char = source[index];

    if (char === '\\') {
      const next = source[index + 1];
      if (next === undefined) return null;

      if (next === '\r') {
        index += source[index + 2] === '\n' ? 3 : 2;
        continue;
      }
      if (next === '\n') {
        index += 2;
        continue;
      }

      const escapes: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
      };
      if (Object.prototype.hasOwnProperty.call(escapes, next)) {
        value += escapes[next];
        index += 2;
        continue;
      }

      if (/[0-7]/.test(next)) {
        let octal = next;
        let consumed = 1;
        while (consumed < 3 && /[0-7]/.test(source[index + 1 + consumed] || '')) {
          octal += source[index + 1 + consumed];
          consumed += 1;
        }
        value += String.fromCharCode(Number.parseInt(octal, 8));
        index += 1 + consumed;
        continue;
      }

      value += next;
      index += 2;
      continue;
    }

    if (char === '(') {
      depth += 1;
      value += char;
      index += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) return { value, nextIndex: index + 1 };
      value += char;
      index += 1;
      continue;
    }

    value += char;
    index += 1;
  }

  return null;
}

function parsePositionedText(stream: string, page: number): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  const tdPattern = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td\b/g;
  let match: RegExpExecArray | null;

  while ((match = tdPattern.exec(stream)) !== null) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const searchStart = tdPattern.lastIndex;
    const nextTd = stream.indexOf(' Td', searchStart);
    const open = stream.indexOf('(', searchStart);
    const tj = stream.indexOf('Tj', searchStart);

    if (open < 0 || tj < 0 || open > tj || (nextTd >= 0 && nextTd < open)) continue;
    const literal = decodePdfLiteral(stream, open);
    if (!literal || literal.nextIndex > tj) continue;

    const text = normalizeText(literal.value);
    if (text) items.push({ page, x, y, text });
  }

  return items;
}

function parsePdfObjects(pdfText: string): Map<number, string> {
  const objects = new Map<number, string>();
  const objectPattern = /(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objectPattern.exec(pdfText)) !== null) {
    objects.set(Number(match[1]), match[2]);
  }

  return objects;
}

function contentReferences(pageObject: string): number[] {
  const direct = pageObject.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (direct) return [Number(direct[1])];

  const array = pageObject.match(/\/Contents\s*\[([^\]]+)\]/);
  if (!array) return [];

  return Array.from(array[1].matchAll(/(\d+)\s+0\s+R/g), (match) => Number(match[1]));
}

function extractStream(objectBody: string): string | null {
  const marker = objectBody.indexOf('stream');
  const end = objectBody.lastIndexOf('endstream');
  if (marker < 0 || end <= marker) return null;

  const dictionary = objectBody.slice(0, marker);
  if (/\/Filter\b/.test(dictionary)) {
    throw new Error(
      'Este Mapa de Existência usa uma compressão de PDF não suportada pelo leitor local.'
    );
  }

  let start = marker + 'stream'.length;
  if (objectBody[start] === '\r' && objectBody[start + 1] === '\n') start += 2;
  else if (objectBody[start] === '\r' || objectBody[start] === '\n') start += 1;

  let streamEnd = end;
  if (objectBody[streamEnd - 2] === '\r' && objectBody[streamEnd - 1] === '\n') streamEnd -= 2;
  else if (objectBody[streamEnd - 1] === '\r' || objectBody[streamEnd - 1] === '\n') streamEnd -= 1;

  return objectBody.slice(start, streamEnd);
}

function findColumns(items: PdfTextItem[]): PdfColumns | null {
  const byText = (value: string) =>
    items.find((item) => lookupText(item.text) === lookupText(value))?.x ?? null;

  const ficha = byText('Nr Ficha');
  const description = byText('Nome do Material');
  const quantity = byText('Qtde Exist');
  const available = byText('Qtde Disp');
  const unitValue = byText('Vlr Unit');
  const expiry = byText('Validade');

  if (
    ficha === null
    || description === null
    || quantity === null
    || available === null
    || unitValue === null
    || expiry === null
  ) {
    return null;
  }

  return { ficha, description, quantity, available, unitValue, expiry };
}

function near(value: number, target: number, tolerance = 5): boolean {
  return Math.abs(value - target) <= tolerance;
}

function looksLikeFicha(value: string): boolean {
  const normalized = normalizeText(value);
  return /^(?:\d{2}\.\d{3,}[a-z]?|\d{4,}[a-z]?)$/i.test(normalized);
}

function parseBrazilianNumber(value: string): number | null {
  const text = normalizeText(value);
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(text)) return null;
  const parsed = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBrazilianDate(value: string): string | null {
  const text = normalizeText(value);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return match[3] + '-' + match[2] + '-' + match[1];
}

function isDescriptionStatus(value: string): boolean {
  const text = lookupText(value);
  return text === 'disponivel'
    || text === 'indisponivel'
    || text === 'bloqueado'
    || text === 'reservado';
}

const PORTUGUESE_MONTHS: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

function parseReportDate(text: string): string | null {
  const normalized = lookupText(text);
  const match = normalized.match(
    /data de emissao\s*:\s*(?:[^\d]*?)?(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/
  );
  if (!match) return null;
  const month = PORTUGUESE_MONTHS[match[2]];
  if (!month) return null;
  return match[3] + '-' + month + '-' + match[1].padStart(2, '0');
}

function extractPageRows(
  pageItems: PdfTextItem[],
  columns: PdfColumns
): {
  items: EmprovexSiscofisInventoryItem[];
  detectedRows: number;
  zeroQuantityRows: number;
  invalidRows: number;
} {
  const starts = pageItems
    .filter((item) => near(item.x, columns.ficha) && looksLikeFicha(item.text))
    .sort((a, b) => b.y - a.y);

  const items: EmprovexSiscofisInventoryItem[] = [];
  let zeroQuantityRows = 0;
  let invalidRows = 0;

  starts.forEach((start, index) => {
    const nextY = starts[index + 1]?.y ?? Number.NEGATIVE_INFINITY;
    const record = pageItems.filter(
      (item) => item.y <= start.y + 1.5 && item.y > nextY + 1.5
    );

    const description = record
      .filter(
        (item) =>
          near(item.x, columns.description)
          && !isDescriptionStatus(item.text)
          && lookupText(item.text) !== 'nome do material'
      )
      .sort((a, b) => b.y - a.y)
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const quantity = record
      .filter((item) => near(item.x, columns.quantity))
      .map((item) => parseBrazilianNumber(item.text))
      .find((value): value is number => value !== null) ?? null;

    const unitValue = record
      .filter((item) => near(item.x, columns.unitValue))
      .map((item) => parseBrazilianNumber(item.text))
      .find((value): value is number => value !== null) ?? null;

    const expiry = record
      .filter((item) => near(item.x, columns.expiry))
      .map((item) => parseBrazilianDate(item.text))
      .find((value): value is string => value !== null) ?? null;

    if (quantity === 0) {
      zeroQuantityRows += 1;
      return;
    }

    if (!description || quantity === null || quantity < 0 || unitValue === null || unitValue < 0) {
      invalidRows += 1;
      return;
    }

    items.push({
      numeroItem: normalizeText(start.text),
      descricao: description,
      quantidade: quantity,
      valorUnitario: Math.round(unitValue * 100) / 100,
      validade: expiry,
    });
  });

  return {
    items,
    detectedRows: starts.length,
    zeroQuantityRows,
    invalidRows,
  };
}

export function extractEmprovexSiscofisInventoryFromPdfBytes(
  input: ArrayBuffer | Uint8Array
): EmprovexSiscofisPdfExtraction {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 8) throw new Error('PDF SISCOFIS vazio ou inválido.');

  const pdfText = new TextDecoder('windows-1252').decode(bytes);
  if (!pdfText.startsWith('%PDF-')) {
    throw new Error('O arquivo selecionado não é um PDF válido.');
  }
  if (/\/Encrypt\b/.test(pdfText)) {
    throw new Error('PDF SISCOFIS protegido por senha não é suportado pelo leitor local.');
  }

  const objects = parsePdfObjects(pdfText);
  const pageEntries = Array.from(objects.entries())
    .filter(([, body]) => /\/Type\s*\/Page\b/.test(body))
    .sort((a, b) => a[0] - b[0]);

  if (pageEntries.length === 0) {
    throw new Error('Não foi possível localizar páginas no PDF SISCOFIS.');
  }

  const allItems: PdfTextItem[] = [];
  for (let pageIndex = 0; pageIndex < pageEntries.length; pageIndex += 1) {
    const [, pageBody] = pageEntries[pageIndex];
    const refs = contentReferences(pageBody);
    if (refs.length === 0) continue;

    for (const ref of refs) {
      const contentObject = objects.get(ref);
      if (!contentObject) continue;
      const stream = extractStream(contentObject);
      if (!stream) continue;
      allItems.push(...parsePositionedText(stream, pageIndex + 1));
    }
  }

  const joined = lookupText(allItems.map((item) => item.text).join(' '));
  if (!joined.includes('mapa de existencia - material de consumo')) {
    throw new Error(
      'Formato não reconhecido como Mapa de Existência - Material de Consumo do SISCOFIS.'
    );
  }

  const items: EmprovexSiscofisInventoryItem[] = [];
  let detectedRows = 0;
  let zeroQuantityRows = 0;
  let invalidRows = 0;
  let pagesWithColumns = 0;

  for (let page = 1; page <= pageEntries.length; page += 1) {
    const pageItems = allItems.filter((item) => item.page === page);
    const columns = findColumns(pageItems);
    if (!columns) continue;
    pagesWithColumns += 1;

    const extracted = extractPageRows(pageItems, columns);
    items.push(...extracted.items);
    detectedRows += extracted.detectedRows;
    zeroQuantityRows += extracted.zeroQuantityRows;
    invalidRows += extracted.invalidRows;
  }

  if (pagesWithColumns === 0 || detectedRows === 0) {
    throw new Error(
      'As colunas do Mapa de Existência não puderam ser reconhecidas neste PDF.'
    );
  }

  if (items.length === 0) {
    throw new Error(
      'Nenhum item com Qtde Exist positiva pôde ser extraído do PDF SISCOFIS.'
    );
  }

  return {
    inventory: {
      schemaVersion: EMPROVEX_SISCOFIS_INVENTORY_SCHEMA_VERSION,
      items,
    },
    pageCount: pageEntries.length,
    detectedRows,
    zeroQuantityRows,
    invalidRows,
    referenceDate: parseReportDate(allItems.map((item) => item.text).join(' ')),
  };
}
