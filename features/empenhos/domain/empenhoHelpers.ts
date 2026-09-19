export const MILITARY_RANKS = [
  'Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
  'Servidor Civil'
];

export const normalizeSupplier = (supplier: any): string => {
  if (!supplier) return '';
  if (typeof supplier === 'string') return supplier;
  if (typeof supplier === 'object') {
    if (supplier.razao_social) return String(supplier.razao_social);
    if (supplier.fornecedor) return String(supplier.fornecedor);
    if (supplier.name) return String(supplier.name);
    if (supplier.supplier) return normalizeSupplier(supplier.supplier);
    
    const keys = Object.keys(supplier);
    if (keys.includes('razao_social')) {
      return String(supplier.razao_social);
    }
    if (keys.includes('fornecedor')) {
      return String(supplier.fornecedor);
    }
    for (const key of keys) {
      if (typeof supplier[key] === 'string') {
        return supplier[key];
      }
    }
    return String(supplier.name || Object.values(supplier)[0] || '');
  }
  return String(supplier);
};

export const PROMPT_EXTRACAO_EMPENHO = `# PROMPT FIXO — Extração de Dados de Nota de Empenho
# Use este prompt no Claude, ChatGPT ou Gemini, anexando o PDF da NE

---

Analise o PDF da Nota de Empenho anexado e extraia os dados abaixo.
Retorne SOMENTE o JSON, sem texto antes ou depois, sem explicações, sem blocos markdown.

Formato exato a retornar:

{
  "numero_empenho": "2025NE124",
  "data_emissao": "2025-08-27",
  "tipo_empenho": "Global",
  "valor_total": 12043.80,
  "fornecedor": {
    "razao_social": "JULIANO LUCIO FRANCISCATTO DO AMARAL & CIA LT",
    "cnpj": "02.483.088/0001-75"
  },
  "itens": [
    {
      "num_item": "001",
      "codigo_item": "00002",
      "descricao": "LEGUME PROCESSADO, TIPO MANDIOCA, PREPARO IN NATURA, APRESENTACAO CONGELADO, A VACUO",
      "unidade": "kg",
      "quantidade": 430,
      "valor_unitario": 6.90,
      "valor_total_item": 2967.00
    }
  ]
}

Regras:
- data_emissao sempre no formato AAAA-MM-DD
- Valores numéricos com ponto como separador decimal (não vírgula)
- Extrair TODOS os itens da seção "Lista de Itens" do documento
- unidade: identificar na descrição do item (kg, un, maço, pct, cx, lt, g); se não identificável usar "un"
- CNPJ: preservar exatamente letras, números e zeros à esquerda encontrados no documento; CNPJs novos podem ser alfanuméricos\n- Não inventar dados; se um campo não for encontrado, usar null`;
