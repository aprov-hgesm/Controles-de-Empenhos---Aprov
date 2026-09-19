# EMPROVEX — Contrato JSON para importação de NS do SAG

## Objetivo

O contrato `emprovex_sag_ns_v1` padroniza a etapa de **extração** dos relatórios de Nota de Lançamento de Sistema (NS) obtidos no Sistema de Acompanhamento da Gestão (SAG).

Este bloco não grava dados no Firestore e não realiza a conciliação definitiva. A IA externa apenas transforma o relatório em JSON estruturado. O EMPROVEX continuará responsável por validar e, em etapas posteriores, relacionar **CNPJ → NF → NE**.

## Princípio de segurança

A IA não pode escolher uma Nota de Empenho, sugerir `empenhoId`, informar `recordKey` ou criar qualquer vínculo interno do EMPROVEX.

Mesmo quando a IA reconhece uma NF, ela deve retornar somente aquilo que está explicitamente presente no relatório do SAG. A associação com uma NE pertence exclusivamente ao motor de conciliação do EMPROVEX.

## Schema

```json
{
  "schema_version": "emprovex_sag_ns_v1",
  "source": "SAG",
  "supplier_cnpj": "02483088000175",
  "ug": "160416",
  "records": [
    {
      "ns": "2026NS000012",
      "ns_issue_date": "2026-01-12",
      "nf_number_raw": "2073",
      "nf_issue_date": "2025-12-12",
      "observation": "APROPRIAÇÃO DE DESPESAS... NF 2073/12DEZ25..."
    },
    {
      "ns": "2026NS000068",
      "ns_issue_date": "2026-01-21",
      "nf_number_raw": null,
      "nf_issue_date": null,
      "observation": "DOCUMENTO EMITIDO PELO SIAFI-WEB..."
    }
  ]
}
```

## Regras do contrato

- `schema_version` deve ser exatamente `emprovex_sag_ns_v1`.
- `source` deve ser `SAG`.
- `supplier_cnpj` é normalizado para 14 dígitos e pode ser comparado ao fornecedor selecionado no EMPROVEX.
- `ug` possui 6 dígitos ou `null`.
- `ns` é normalizada para o padrão `AAAANS000000`.
- `ns_issue_date` é obrigatória em `YYYY-MM-DD`.
- `nf_number_raw` preserva o número extraído da observação, inclusive zeros à esquerda, ou recebe `null`.
- `nf_issue_date` só é preenchida quando a data está explicitamente disponível; caso contrário recebe `null`.
- `observation` preserva o texto de origem útil à conferência.
- NS sem NF continuam no lote. Elas não devem ser descartadas pela IA.
- NS duplicadas no mesmo JSON são rejeitadas.
- Campos de ligação como NE, empenho, `empenhoId`, `recordKey` e IDs internos são rejeitados.
- Uma data de NF posterior à data da NS é preservada e sinalizada como alerta; o sistema não corrige o dado automaticamente.
- Campos extras desconhecidos são ignorados com aviso para manter o contrato estável.

## Funções implementadas

Arquivo: `lib/sagNsContract.ts`

- `normalizeSagNsNumber`
- `isValidSagNsNumber`
- `normalizeSagUg`
- `normalizeSagIsoDate`
- `validateSagNsPayload`
- `parseSagNsJson`
- `buildSagNsExtractionPrompt`

## Limites deste bloco

O Bloco 7 não:

- grava ou atualiza `numeroNS` em uma NF;
- tenta localizar uma NF no EMPROVEX;
- escolhe uma NE;
- faz fuzzy matching;
- resolve conflitos;
- importa automaticamente;
- altera regras do Firestore.

Essas responsabilidades permanecem para os blocos de assistente, conciliação, prévia e persistência idempotente.
