/**
 * PDF textual Pedido SISCOFIS (W2). Não reutiliza nem altera o parser de Mapa de Existência.
 * Extração limitada a texto WinAnsi literal/hex Tj em streams de página, com rejeição
 * de filtros, fontes, fluxos ou layout desconhecidos. PDFs reais NÃO homologados.
 */
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import {
  parseRequestTextLines, requestFailure, validateImportInput,
  type RequestImportInput, type RequestParseResult,
} from './siscofisRequestParser';

const MAX_PAGE_STREAM_BYTES = 1024 * 1024;
const MAX_PDF_PAGES = 5;

function streamFromObject(body: string): string | null {
  const startMarker = body.indexOf('stream');
  const endMarker = body.lastIndexOf('endstream');
  if (startMarker < 0 || endMarker <= startMarker) return null;
  const dictionary = body.slice(0, startMarker);
  if (/\/(?:Subtype\s*\/Image|Type\s*\/ObjStm|Type\s*\/XRef)\b/.test(dictionary)) return null;
  if (/\/Filter\b/.test(dictionary)
    && !/\/Filter\s*(?:\/FlateDecode\b|\[\s*\/FlateDecode\s*\])/.test(dictionary)) return null;
  let start = startMarker + 6;
  if (body.slice(start, start + 2) === '\r\n') start += 2;
  else if (body[start] === '\r' || body[start] === '\n') start += 1;
  let end = endMarker;
  if (body.slice(end - 2, end) === '\r\n') end -= 2;
  else if (body[end - 1] === '\n' || body[end - 1] === '\r') end -= 1;
  if (end < start || end - start > MAX_PAGE_STREAM_BYTES) return null;
  const bytes = Buffer.from(body.slice(start, end), 'latin1');
  try {
    const decoded = /\/Filter\b/.test(dictionary)
      ? inflateSync(bytes, { maxOutputLength: MAX_PAGE_STREAM_BYTES })
      : bytes;
    return decoded.length <= MAX_PAGE_STREAM_BYTES ? decoded.toString('latin1') : null;
  } catch {
    return null;
  }
}

function decodeLiteral(operand: string): string | null {
  if (operand[0] !== '(' || operand.at(-1) !== ')') return null;
  const inner = operand.slice(1, -1);
  const bytes: number[] = [];
  for (let i = 0; i < inner.length; i += 1) {
    const code = inner.charCodeAt(i);
    if (inner[i] !== '\\') { bytes.push(code); continue; }
    const next = inner[++i];
    if (next === undefined) return null;
    const fixed: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
    if (next in fixed) { bytes.push(fixed[next]); continue; }
    if (/[0-7]/.test(next)) {
      let octal = next;
      for (let k = 0; k < 2 && /[0-7]/.test(inner[i + 1] ?? ''); k += 1) octal += inner[++i];
      bytes.push(Number.parseInt(octal, 8));
      continue;
    }
    if (next === '\n' || next === '\r') {
      if (next === '\r' && inner[i + 1] === '\n') i += 1;
      continue;
    }
    return null;
  }
  return new TextDecoder('windows-1252').decode(Uint8Array.from(bytes));
}

function decodeTextOperand(operand: string): string | null {
  if (operand.startsWith('(')) return decodeLiteral(operand);
  if (!/^<(?:[0-9A-Fa-f]{2})+>$/.test(operand)) return null;
  const hex = operand.slice(1, -1);
  return new TextDecoder('windows-1252')
    .decode(Uint8Array.from(hex.match(/.{2}/g)!.map(pair => Number.parseInt(pair, 16))));
}

function pageText(stream: string): string[] | null {
  // Apenas uma operação Tj por bloco BT/ET. TJ, UTF-16 e CMap exigem homologação específica.
  const blocks = Array.from(stream.matchAll(/\bBT\b([\s\S]*?)\bET\b/g));
  if (!blocks.length || /\]\s*TJ\b|\)\s*'|"\s*$/.test(stream)) return null;
  const result: string[] = [];
  for (const block of blocks) {
    const op = /(\((?:\\[\s\S]|[^\\()])*\)|<(?:[0-9a-fA-F]{2})+>)\s*Tj\b/g;
    const matches = Array.from(block[1].matchAll(op));
    if (matches.length !== 1) return null;
    const text = decodeTextOperand(matches[0][1]);
    if (text === null) return null;
    result.push(text);
  }
  return result;
}

function pageContentRefs(body: string): number[] {
  const single = /\/Contents\s+(\d+)\s+0\s+R\b/.exec(body);
  if (single) return [Number(single[1])];
  const multi = /\/Contents\s*\[([^\]]+)\]/.exec(body);
  return multi ? Array.from(multi[1].matchAll(/(\d+)\s+0\s+R\b/g), m => Number(m[1])) : [];
}

export async function parseSiscofisRequestPdf(input: RequestImportInput): Promise<RequestParseResult> {
  const invalid = validateImportInput(input);
  if (invalid) return invalid;
  const binary = Buffer.from(input.bytes).toString('latin1');
  if (!binary.startsWith('%PDF-') || !/%%EOF\s*$/.test(binary)) {
    return requestFailure('UNREADABLE_SOURCE', 'PDF inválido ou incompleto.');
  }
  let pages: number;
  try {
    const document = await PDFDocument.load(input.bytes, { updateMetadata: false });
    pages = document.getPageCount();
  } catch {
    return requestFailure('UNREADABLE_SOURCE', 'PDF corrompido, protegido ou não interpretável.');
  }
  if (pages === 0 || pages > MAX_PDF_PAGES) {
    return requestFailure('UNSUPPORTED_LAYOUT', 'PDF excede limite de 5 páginas.');
  }
  // Inspeção somente de objetos de página e seus /Contents, nunca de todo texto bruto.
  // XRef/object streams ou fontes com ToUnicode requerem parser certificado específico.
  if (/\/Encrypt\b|\/ObjStm\b|\/ToUnicode\b/.test(binary)) {
    return requestFailure('UNSUPPORTED_LAYOUT', 'PDF usa codificação ou objetos não homologados.');
  }
  const objects = new Map<number, string>();
  const pagesInFile: string[] = [];
  const re = /(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj\b/g;
  for (const match of binary.matchAll(re)) {
    const id = Number(match[1]);
    if (objects.has(id)) return requestFailure('UNSUPPORTED_LAYOUT', 'Objetos PDF repetidos.');
    objects.set(id, match[2]);
    if (/\/Type\s*\/Page\b/.test(match[2])) pagesInFile.push(match[2]);
  }
  if (pagesInFile.length !== pages) {
    return requestFailure('UNSUPPORTED_LAYOUT', 'Estrutura de páginas não suportada.');
  }
  const sourceLines: { sourceRowId: string; text: string }[] = [];
  for (let p = 0; p < pagesInFile.length; p += 1) {
    const refs = pageContentRefs(pagesInFile[p]);
    if (refs.length !== 1 || !objects.has(refs[0])) {
      return requestFailure('UNSUPPORTED_LAYOUT', 'Stream de página não suportado.');
    }
    const stream = streamFromObject(objects.get(refs[0])!);
    const extracted = stream === null ? null : pageText(stream);
    if (!extracted?.length) return requestFailure('UNREADABLE_SOURCE', 'Página escaneada/sem texto selecionável ou fonte desconhecida.');
    for (let i = 0; i < extracted.length; i += 1) {
      sourceLines.push({
        sourceRowId: 'pdf-p' + String(p + 1).padStart(3, '0') + '-l' + String(i + 1).padStart(5, '0'),
        text: extracted[i],
      });
    }
  }
  return parseRequestTextLines(input, 'PDF', sourceLines);
}
