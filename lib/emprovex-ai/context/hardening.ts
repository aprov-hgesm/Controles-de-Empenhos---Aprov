/** Detect independent operations before routing can discard half a request.
 * Deliberately does not execute multi-intent queries in R1.
 */
export function inspectCompound(t:string):string|null {
 const phrases=[
  /\b(?:fornecedor|contato|cnpj)\b.{0,85}\be\s+(?:o\s+|a\s+)?(?:saldo|quanto|valor|resta|restante)\b/,
  /\b(?:saldo|resta|restante)\b.{0,85}\be\s+(?:o\s+|a\s+)?(?:fornecedor|contato|cnpj)\b/,
  /\b(?:quanto|estoque|saldo fisico)\b.{0,85}\be\s+(?:onde|localizacao|em qual deposito)\b/,
  /\b(?:onde|localizacao)\b.{0,85}\be\s+(?:quanto|saldo|estoque)\b/,
  /\b(?:empenho|\d{4}ne\d+)\b.{0,85}\be\s+(?:o\s+)?(?:historico|cronograma|envio)\b/,
  /\b(?:cronograma|envio)\b.{0,85}\be\s+(?:o\s+)?(?:empenho|saldo)\b/,
  /\b(?:diferenca|compare|comparar|comparacao|versus)\b.{0,100}\b(?:saldo|empenho|ne)\b/,
  /\b(?:entregas|fornecedores)\b.{0,100}\be\s+(?:qual|quanto|valor)\b/,
  /\b(?:saldo|resta|restante)\b.{0,90}\be\s+(?:a\s+)?(?:quantidade|localizacao|validade)\b/,
  /\b(?:quanto|temos|estoque)\b.{0,90}\be\s+(?:qual|a|o)\s+(?:validade|vencimento)\b/,
  /\b(?:cronograma|envio)\b.{0,90}\be\s+(?:(?:qual|quanto)\s+(?:o\s+|a\s+)?)?(?:saldo|resta|valor)\b/
 ];
 return phrases.some(re=>re.test(t))
  ?'A solicitação reúne informações que não posso combinar com segurança nesta fase. Qual consulta deseja realizar primeiro?'
  :null;
}
