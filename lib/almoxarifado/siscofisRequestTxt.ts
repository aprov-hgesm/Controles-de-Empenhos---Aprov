/**
 * Adaptador TXT de Pedido SISCOFIS, independente do PDF e do Mapa de Existência.
 * Suporta exclusivamente o layout de fixture sintética explicitamente marcado.
 */
import {
  parseRequestTextLines, requestFailure, validateImportInput,
  type RequestImportInput, type RequestParseResult,
} from './siscofisRequestParser';

export function parseSiscofisRequestTxt(input: RequestImportInput): RequestParseResult {
  const invalid = validateImportInput(input);
  if (invalid) return invalid;
  if (input.bytes[0] === 0xff && input.bytes[1] === 0xfe
    || input.bytes[0] === 0xfe && input.bytes[1] === 0xff) {
    return requestFailure('UNREADABLE_SOURCE', 'TXT UTF-16 não homologado. Exportar texto em UTF-8.');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
  } catch {
    return requestFailure('UNREADABLE_SOURCE', 'TXT não é UTF-8 legível.');
  }
  if (text.includes('\u0000')) return requestFailure('UNREADABLE_SOURCE', 'TXT contém bytes nulos.');
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r\n|\n|\r/g).map((value, index) => ({
    sourceRowId: 'txt-l' + String(index + 1).padStart(5, '0'),
    text: value,
  }));
  return parseRequestTextLines(input, 'TXT', lines);
}
