import { inflateSync } from 'node:zlib';

export type EmpenhoContractingModality =
  | 'PREGAO'
  | 'DISPENSA_ELETRONICA'
  | 'OUTRA';

export interface ParsedEmpenhoPdfItem {
  id: string;
  itemCompraNumber: string;
  sequence: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  declaredTotal: number;
  received: number;
}

export interface ParsedEmpenhoPdfResult {
  id: string;
  ug: string | null;
  supplier: string;
  supplierCnpj: string;
  description: string;
  date: string;
  tipoEmpenho: string;
  processo: string;
  valorTotal: number;
  naturezaDespesa: string | null;
  ptres: string | null;
  fonteRecurso: string | null;
  ugr: string | null;
  planoInterno: string | null;
  notaCredito: string | null;
  modalidadeContratacao: EmpenhoContractingModality;
  numeroContratacao: string | null;
  pregao: string;
  contrato: string | null;
  classification: string;
  tipoObjeto: 'MATERIAL' | 'SERVICO' | 'OUTRO';
  items: ParsedEmpenhoPdfItem[];
  warnings: string[];
  pageCountDetected: number;
  itemRowsDetected: number;
  duplicatedRowsIgnored: number;
}

type PdfObject = {
  id: number;
  body: string;
};

type TextStream = {
  objectId: number;
  fragments: string[];
  fields: string[];
  pageNumber: number | null;
  pageCount: number | null;
};

const CNPJ_PATTERN = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;
const BRAZILIAN_NUMBER_PATTERN = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_INFLATED_STREAM_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_DECODED_BYTES = 24 * 1024 * 1024;

function normalizeText(value: string): string {
  return value.replace(/\u0000/g, '').trim().replace(/[ ]+/g, ' ');
}

function lookupText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function compactLookup(value: string): string {
  return lookupText(value).replace(/[^a-z0-9]+/g, '');
}

function binaryString(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

function parsePdfObjects(pdfBinary: string): PdfObject[] {
  const objects: PdfObject[] = [];
  const pattern = /(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(pdfBinary)) !== null) {
    objects.push({
      id: Number(match[1]),
      body: match[2],
    });
  }
  return objects;
}

function extractStreamBytes(body: string): { dictionary: string; bytes: Uint8Array } | null {
  const marker = body.indexOf('stream');
  const end = body.lastIndexOf('endstream');
  if (marker < 0 || end <= marker) return null;

  const dictionary = body.slice(0, marker);
  if (
    /\/Subtype\s*\/Image\b/.test(dictionary)
    || /\/FontFile[23]?\b/.test(dictionary)
    || /\/Type\s*\/ObjStm\b/.test(dictionary)
    || /\/Type\s*\/XRef\b/.test(dictionary)
  ) {
    return null;
  }

  let start = marker + 'stream'.length;
  if (body[start] === '\r' && body[start + 1] === '\n') start += 2;
  else if (body[start] === '\r' || body[start] === '\n') start += 1;

  let streamEnd = end;
  if (body[streamEnd - 2] === '\r' && body[streamEnd - 1] === '\n') streamEnd -= 2;
  else if (body[streamEnd - 1] === '\r' || body[streamEnd - 1] === '\n') streamEnd -= 1;

  const raw = body.slice(start, streamEnd);
  return {
    dictionary,
    bytes: Uint8Array.from(raw, (char) => char.charCodeAt(0) & 0xff),
  };
}

function decodeStream(dictionary: string, bytes: Uint8Array): Uint8Array | null {
  if (!/\/Filter\b/.test(dictionary)) return bytes;

  if (/\/Filter\s*\/FlateDecode\b/.test(dictionary)) {
    const inflated = inflateSync(Buffer.from(bytes));
    if (inflated.byteLength > MAX_INFLATED_STREAM_BYTES) {
      throw new Error('Uma página da Nota de Empenho excede o limite seguro de leitura.');
    }
    return new Uint8Array(inflated);
  }

  return null;
}

function decodePdfLiteral(
  source: Uint8Array,
  startIndex: number
): { value: string; nextIndex: number } | null {
  if (source[startIndex] !== 0x28) return null;
  const bytes: number[] = [];
  let depth = 1;
  let index = startIndex + 1;

  while (index < source.length && depth > 0) {
    const current = source[index];

    if (current === 0x5c) {
      const next = source[index + 1];
      if (next === undefined) return null;

      if (next === 0x0d || next === 0x0a) {
        index += next === 0x0d && source[index + 2] === 0x0a ? 3 : 2;
        continue;
      }

      const escapes: Record<number, number> = {
        0x6e: 0x0a,
        0x72: 0x0d,
        0x74: 0x09,
        0x62: 0x08,
        0x66: 0x0c,
        0x28: 0x28,
        0x29: 0x29,
        0x5c: 0x5c,
      };
      if (Object.prototype.hasOwnProperty.call(escapes, next)) {
        bytes.push(escapes[next]);
        index += 2;
        continue;
      }

      if (next >= 0x30 && next <= 0x37) {
        let octal = String.fromCharCode(next);
        let consumed = 1;
        while (
          consumed < 3
          && source[index + 1 + consumed] >= 0x30
          && source[index + 1 + consumed] <= 0x37
        ) {
          octal += String.fromCharCode(source[index + 1 + consumed]);
          consumed += 1;
        }
        bytes.push(Number.parseInt(octal, 8));
        index += 1 + consumed;
        continue;
      }

      bytes.push(next);
      index += 2;
      continue;
    }

    if (current === 0x28) {
      depth += 1;
      bytes.push(current);
      index += 1;
      continue;
    }

    if (current === 0x29) {
      depth -= 1;
      if (depth === 0) {
        return {
          value: new TextDecoder('windows-1252').decode(Uint8Array.from(bytes)),
          nextIndex: index + 1,
        };
      }
      bytes.push(current);
      index += 1;
      continue;
    }

    bytes.push(current);
    index += 1;
  }

  return null;
}

function isWhitespace(value: number): boolean {
  return value === 0x20 || value === 0x09 || value === 0x0a || value === 0x0d;
}

function parseTjArray(source: Uint8Array, start: number, end: number): string {
  let value = '';
  let index = start;

  while (index < end) {
    if (source[index] === 0x28) {
      const literal = decodePdfLiteral(source, index);
      if (!literal || literal.nextIndex > end) break;
      value += literal.value;
      index = literal.nextIndex;
      continue;
    }

    const remaining = new TextDecoder('latin1').decode(source.slice(index, end));
    const numberMatch = /^[-+]?\d+(?:\.\d+)?/.exec(remaining);
    if (numberMatch) {
      const spacing = Number(numberMatch[0]);
      if (Math.abs(spacing) >= 500 && value && !value.endsWith('\t')) {
        value += '\t';
      }
      index += numberMatch[0].length;
      continue;
    }

    index += 1;
  }

  return normalizeText(value.replace(/\t[ ]+/g, '\t'));
}

function extractTextFragments(stream: Uint8Array): string[] {
  const fragments: string[] = [];
  let index = 0;

  while (index < stream.length) {
    if (stream[index] === 0x5b) {
      const arrayStart = index + 1;
      let cursor = arrayStart;
      while (cursor < stream.length) {
        if (stream[cursor] === 0x28) {
          const literal = decodePdfLiteral(stream, cursor);
          if (!literal) break;
          cursor = literal.nextIndex;
          continue;
        }
        if (stream[cursor] === 0x5d) {
          let operator = cursor + 1;
          while (operator < stream.length && isWhitespace(stream[operator])) operator += 1;
          if (stream[operator] === 0x54 && stream[operator + 1] === 0x4a) {
            const value = parseTjArray(stream, arrayStart, cursor);
            if (value) fragments.push(value);
            index = operator + 2;
          } else {
            index = cursor + 1;
          }
          break;
        }
        cursor += 1;
      }
      if (cursor >= stream.length) index += 1;
      continue;
    }

    if (stream[index] === 0x28) {
      const literal = decodePdfLiteral(stream, index);
      if (!literal) {
        index += 1;
        continue;
      }
      let operator = literal.nextIndex;
      while (operator < stream.length && isWhitespace(stream[operator])) operator += 1;
      if (stream[operator] === 0x54 && stream[operator + 1] === 0x6a) {
        const value = normalizeText(literal.value);
        if (value) fragments.push(value);
        index = operator + 2;
      } else {
        index = literal.nextIndex;
      }
      continue;
    }

    index += 1;
  }

  return fragments;
}

function flattenFields(fragments: string[]): string[] {
  return fragments
    .flatMap((fragment) => fragment.split('\t'))
    .map(normalizeText)
    .filter(Boolean);
}

function parseFooterPage(fields: string[]): { pageNumber: number | null; pageCount: number | null } {
  const joined = fields.join(' ');
  const matches = Array.from(joined.matchAll(/\b(\d{1,3})\s+de\s+(\d{1,3})\b/gi));
  const match = matches.at(-1);
  if (!match) return { pageNumber: null, pageCount: null };
  return {
    pageNumber: Number(match[1]),
    pageCount: Number(match[2]),
  };
}

function collectTextStreams(objects: PdfObject[]): TextStream[] {
  const streams: TextStream[] = [];
  let totalDecodedBytes = 0;

  for (const object of objects) {
    const raw = extractStreamBytes(object.body);
    if (!raw) continue;

    let decoded: Uint8Array | null;
    try {
      decoded = decodeStream(raw.dictionary, raw.bytes);
    } catch {
      continue;
    }
    if (!decoded) continue;

    totalDecodedBytes += decoded.byteLength;
    if (totalDecodedBytes > MAX_TOTAL_DECODED_BYTES) {
      throw new Error('O PDF excede o limite seguro de conteúdo descompactado.');
    }

    const operatorSample = Buffer.from(decoded).toString('latin1');
    if (
      !operatorSample.includes('BT')
      || (!operatorSample.includes('Tj') && !operatorSample.includes('TJ'))
    ) {
      continue;
    }

    const fragments = extractTextFragments(decoded);
    if (fragments.length < 4) continue;

    const marker = compactLookup(fragments.join(' '));
    if (!marker.includes('notadeempenho')) continue;

    const fields = flattenFields(fragments);
    const footer = parseFooterPage(fields);
    streams.push({
      objectId: object.id,
      fragments,
      fields,
      ...footer,
    });
  }

  return streams;
}

function parseBrazilianNumber(value: string): number | null {
  const text = normalizeText(value);
  if (!BRAZILIAN_NUMBER_PATTERN.test(text)) return null;
  const parsed = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function findFieldIndex(
  fields: string[],
  expected: string,
  from = 0
): number {
  const target = lookupText(expected);
  for (let index = from; index < fields.length; index += 1) {
    if (lookupText(fields[index]) === target) return index;
  }
  return -1;
}

function findNextDate(fields: string[], from: number): number {
  for (let index = Math.max(0, from); index < fields.length; index += 1) {
    if (DATE_PATTERN.test(fields[index])) return index;
  }
  return -1;
}

function cleanDescriptionLine(value: string): string {
  const ncIndex = value.search(/\b20\d{2}NC\d+\b/i);
  return normalizeText(ncIndex >= 0 ? value.slice(0, ncIndex) : value);
}

function parseGeneralData(page: TextStream) {
  const fields = page.fields;
  const fullText = fields.join(' ');

  const neIndex = fields.findIndex((field, index) => (
    field.toUpperCase() === 'NE'
    && /^\d{4}$/.test(fields[index - 1] || '')
    && /^\d{1,6}$/.test(fields[index + 1] || '')
  ));
  if (neIndex < 1) {
    throw new Error('Número da Nota de Empenho não reconhecido no PDF.');
  }

  const year = fields[neIndex - 1];
  const number = fields[neIndex + 1];
  const id = year + 'NE' + number;

  const ug = fields.slice(0, neIndex).find((field) => /^\d{6}$/.test(field)) || null;

  const cellIndex = findFieldIndex(fields, 'Célula Orçamentária');
  const emissionLabelIndex = findFieldIndex(fields, 'Data de Emissão', Math.max(0, cellIndex));
  const budgetValues = cellIndex >= 0 && emissionLabelIndex > cellIndex
    ? fields.slice(cellIndex + 1, emissionLabelIndex)
    : [];

  const emissionValueIndex = findNextDate(fields, Math.max(0, emissionLabelIndex + 1));
  if (emissionValueIndex < 0) {
    throw new Error('Data de emissão não reconhecida na Nota de Empenho.');
  }

  const date = fields[emissionValueIndex];
  const tipoEmpenho = fields[emissionValueIndex + 1] || '';
  const processo = fields[emissionValueIndex + 2] || '';
  const declaredValueIndex = emissionValueIndex + 4;
  const valorTotal = parseBrazilianNumber(fields[declaredValueIndex] || '');
  if (valorTotal === null || valorTotal <= 0) {
    throw new Error('Valor total da Nota de Empenho não reconhecido.');
  }

  let supplierCnpjIndex = -1;
  for (let index = declaredValueIndex + 1; index < fields.length; index += 1) {
    if (CNPJ_PATTERN.test(fields[index])) {
      supplierCnpjIndex = index;
      break;
    }
  }
  if (supplierCnpjIndex < 0) {
    throw new Error('CNPJ do fornecedor não reconhecido na Nota de Empenho.');
  }

  const supplierCnpj = fields[supplierCnpjIndex];
  const supplier = fields[supplierCnpjIndex + 1] || '';
  if (!supplier) {
    throw new Error('Fornecedor não reconhecido na Nota de Empenho.');
  }

  const articleIndex = findFieldIndex(fields, 'Artigo', supplierCnpjIndex + 1);
  const descriptionCandidates = fields
    .slice(supplierCnpjIndex + 2, articleIndex > supplierCnpjIndex ? articleIndex : supplierCnpjIndex + 8)
    .filter((field) => {
      const lookup = lookupText(field);
      return !/^grupo:\s*\d+$/i.test(field)
        && !lookup.includes('rua mal hermes')
        && !lookup.includes('uasg minuta')
        && lookup !== 'local da entrega'
        && lookup !== 'informacao complementar';
    })
    .map(cleanDescriptionLine)
    .filter(Boolean);

  const description = normalizeText(descriptionCandidates.join(' '))
    || ('Empenho ' + tipoEmpenho);

  const notaCredito = fullText.match(/\b(20\d{2}NC\d{5,})\b/i)?.[1]?.toUpperCase() || null;
  const dispensa = fullText.match(/\bDISP(?:ENSA)?\s+ELETR(?:ONICA)?\.?\s+(\d{5}\/\d{4})\b/i);
  const pregao = fullText.match(/\b(?:SRP|PREGAO(?:\s+ELETRONICO)?)\s+(\d{5}\/\d{4})\b/i);
  const contrato = fullText.match(/\bCONTRATO\s+([0-9]{1,6}\/\d{4})\b/i)?.[1] || null;

  const hasDispensa = Boolean(dispensa)
    || lookupText(fullText).includes('dispensa de licitacao');
  const hasPregao = Boolean(pregao)
    || /\bPREGAO\b/i.test(fullText);

  const modalidadeContratacao: EmpenhoContractingModality = hasDispensa
    ? 'DISPENSA_ELETRONICA'
    : hasPregao
      ? 'PREGAO'
      : 'OUTRA';

  const numeroContratacao = modalidadeContratacao === 'DISPENSA_ELETRONICA'
    ? dispensa?.[1] || null
    : modalidadeContratacao === 'PREGAO'
      ? pregao?.[1] || null
      : null;

  const naturezaDespesa = budgetValues[3] || null;
  const planoInterno = budgetValues[5] || null;
  const tipoObjeto: ParsedEmpenhoPdfResult['tipoObjeto'] = naturezaDespesa === '339030'
    ? 'MATERIAL'
    : naturezaDespesa === '339039'
      ? 'SERVICO'
      : 'OUTRO';

  const classification = planoInterno?.toUpperCase().endsWith('QR') ? 'QR' : 'QR';

  return {
    id,
    ug,
    supplier,
    supplierCnpj,
    description,
    date,
    tipoEmpenho,
    processo,
    valorTotal,
    naturezaDespesa,
    ptres: budgetValues[1] || null,
    fonteRecurso: budgetValues[2] || null,
    ugr: budgetValues[4] || null,
    planoInterno,
    notaCredito,
    modalidadeContratacao,
    numeroContratacao,
    pregao: modalidadeContratacao === 'PREGAO' ? numeroContratacao || '' : '',
    contrato,
    classification,
    tipoObjeto,
  };
}

function pageSortValue(stream: TextStream): number {
  if (stream.pageNumber !== null) return stream.pageNumber;
  return 10000 + stream.objectId;
}

function parseItems(pages: TextStream[]) {
  const items: ParsedEmpenhoPdfItem[] = [];
  const keys = new Set<string>();
  let itemRowsDetected = 0;
  let duplicatedRowsIgnored = 0;

  const sorted = [...pages].sort((a, b) => pageSortValue(a) - pageSortValue(b));

  for (const page of sorted) {
    const fields = page.fields;
    for (let index = 0; index < fields.length - 2; index += 1) {
      if (!/^\d{3}$/.test(fields[index])) continue;
      const declaredTotal = parseBrazilianNumber(fields[index + 1] || '');
      if (declaredTotal === null) continue;

      const itemLine = fields[index + 2] || '';
      const itemMatch = /^Item compra:\s*([^\s]+)\s*-\s*(.*)$/i.exec(itemLine);
      if (!itemMatch) continue;

      itemRowsDetected += 1;
      const sequence = fields[index];
      const rawCode = itemMatch[1].trim();
      const itemCompraNumber = /^\d+$/.test(rawCode)
        ? rawCode.padStart(5, '0')
        : rawCode;
      const descriptionParts = [itemMatch[2]];

      let cursor = index + 3;
      while (cursor < fields.length && lookupText(fields[cursor]) !== 'data') {
        const marker = lookupText(fields[cursor]);
        if (
          marker === 'seq.'
          || marker === 'descricao'
          || marker === 'valor do item'
          || /^\d{3}$/.test(fields[cursor])
        ) {
          break;
        }
        descriptionParts.push(fields[cursor]);
        cursor += 1;
      }

      const dateIndex = findNextDate(fields, cursor);
      if (dateIndex < 0 || dateIndex > cursor + 8) continue;

      let valuesIndex = dateIndex + 1;
      while (
        valuesIndex < fields.length
        && !BRAZILIAN_NUMBER_PATTERN.test(fields[valuesIndex])
      ) {
        valuesIndex += 1;
      }

      const quantity = parseBrazilianNumber(fields[valuesIndex] || '');
      const unitPrice = parseBrazilianNumber(fields[valuesIndex + 1] || '');
      const rowTotal = parseBrazilianNumber(fields[valuesIndex + 2] || '');

      if (
        quantity === null
        || unitPrice === null
        || rowTotal === null
        || quantity <= 0
        || unitPrice < 0
      ) {
        continue;
      }

      const dedupeKey = [
        sequence,
        itemCompraNumber,
        quantity.toFixed(5),
        unitPrice.toFixed(4),
        rowTotal.toFixed(2),
      ].join('|');

      if (keys.has(dedupeKey)) {
        duplicatedRowsIgnored += 1;
        continue;
      }
      keys.add(dedupeKey);

      items.push({
        id: itemCompraNumber,
        itemCompraNumber,
        sequence,
        name: normalizeText(descriptionParts.join(' ')),
        unit: 'UN',
        quantity,
        unitPrice,
        declaredTotal: rowTotal,
        received: 0,
      });
    }
  }

  return { items, itemRowsDetected, duplicatedRowsIgnored };
}

export function parseEmpenhoPdfBytes(input: Uint8Array): ParsedEmpenhoPdfResult {
  if (input.byteLength < 16 || input.byteLength > MAX_PDF_BYTES) {
    throw new Error('O PDF deve ter entre 16 bytes e 12 MB.');
  }

  const pdfBinary = binaryString(input);
  if (!pdfBinary.startsWith('%PDF-')) {
    throw new Error('O arquivo selecionado não é um PDF válido.');
  }
  if (/\/Encrypt\b/.test(pdfBinary)) {
    throw new Error('PDF protegido por senha não é suportado no cadastro direto.');
  }

  const objects = parsePdfObjects(pdfBinary);
  if (objects.length === 0) {
    throw new Error('A estrutura interna do PDF não pôde ser reconhecida.');
  }

  const textStreams = collectTextStreams(objects);
  const pageOne = textStreams.find((stream) => {
    const marker = compactLookup(stream.fragments.join(' '));
    return marker.includes('notadeempenho')
      && marker.includes('celulaorcamentaria')
      && !marker.includes('listadeitens');
  });
  if (!pageOne) {
    throw new Error(
      'Formato não reconhecido como Nota de Empenho SIAFI em Impressão Completa.'
    );
  }

  const itemPages = textStreams.filter((stream) =>
    compactLookup(stream.fragments.join(' ')).includes('listadeitens')
  );
  if (itemPages.length === 0) {
    throw new Error('A Lista de Itens da Nota de Empenho não foi localizada.');
  }

  const general = parseGeneralData(pageOne);
  const parsedItems = parseItems(itemPages);
  if (parsedItems.items.length === 0) {
    throw new Error('Nenhum item válido pôde ser extraído da Nota de Empenho.');
  }

  const warnings: string[] = [];
  const calculatedTotal = parsedItems.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  if (Math.abs(calculatedTotal - general.valorTotal) > 0.05) {
    warnings.push(
      'O valor total da NE diverge da soma calculada dos itens. Revise a prévia antes de salvar.'
    );
  }

  const itemTotalMismatch = parsedItems.items.some(
    (item) => Math.abs(item.declaredTotal - item.quantity * item.unitPrice) > 0.05
  );
  if (itemTotalMismatch) {
    warnings.push(
      'Um ou mais itens apresentam divergência entre quantidade × valor unitário e o valor do item.'
    );
  }

  warnings.push(
    'A Nota de Empenho SIAFI não informa a unidade de fornecimento na Lista de Itens. O EMPROVEX preenche UN para revisão manual.'
  );

  if (!general.notaCredito) {
    warnings.push('Nota de Crédito (NC) não identificada automaticamente.');
  }
  if (!general.numeroContratacao) {
    warnings.push('Número da contratação não identificado automaticamente.');
  }
  if (general.planoInterno && !general.planoInterno.toUpperCase().endsWith('QR')) {
    warnings.push(
      'A classe do empenho não foi inferida pelo PDF. Revise a classificação antes de confirmar.'
    );
  }

  const pageCountDetected = Math.max(
    ...textStreams.map((stream) => stream.pageCount || 0),
    textStreams.length
  );

  return {
    ...general,
    items: parsedItems.items,
    warnings,
    pageCountDetected,
    itemRowsDetected: parsedItems.itemRowsDetected,
    duplicatedRowsIgnored: parsedItems.duplicatedRowsIgnored,
  };
}
