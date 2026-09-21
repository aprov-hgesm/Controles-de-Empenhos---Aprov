# EMPROVEX — Separação visual de RPNP

## Regra operacional

RPNP (Restos a Pagar Não Processados) é uma qualificação derivada do exercício do empenho.

Na versão inicial desta regra:

- exercício vigente: ano civil atual;
- RPNP: empenho do exercício imediatamente anterior ao vigente;
- anos anteriores ao exercício imediatamente anterior não são rotulados automaticamente como RPNP;
- a classificação persistida continua sendo a classe-base, por exemplo \`CALI\`, \`QR\`, \`PASA\` ou \`FUNADOM\`.

Exemplo, em 2026:

- \`2026NE...\` + CALI → \`CALI\`;
- \`2025NE...\` + CALI → \`CALI RPNP\`;
- \`2025NE...\` + QR → \`QR RPNP\`;
- \`2025NE...\` + PASA → \`PASA RPNP\`;
- \`2025NE...\` + FUNADOM → \`FUNADOM RPNP\`.

## Fonte do ano

A função central usa, nesta ordem:

1. data de emissão ISO (\`YYYY-MM-DD\`);
2. data brasileira (\`DD/MM/YYYY\`);
3. prefixo do número da NE (\`YYYYNE...\`).

## Persistência

RPNP **não é gravado** em \`classification\`.

Isso preserva configuração das classes, regras de Termo de Recebimento, relatórios, integrações, histórico e backup lógico.

## Dashboard

O Dashboard separa uma classe-base em segmentos visuais quando necessário, por exemplo:

\`\`\`text
CALI RPNP
CALI
QR RPNP
QR
PASA RPNP
PASA
\`\`\`

Somente segmentos que possuem empenhos aparecem. Os segmentos RPNP recebem destaque âmbar discreto, saldo próprio, filtro separado e indicação de prioridade de liquidação.

## Aba Empenhos

Na visão geral:

- RPNP recebe o rótulo derivado \`<CLASSE> RPNP\`;
- possui fundo âmbar suave;
- exibe prioridade de liquidação;
- é ordenado antes dos empenhos não RPNP;
- o filtro de ano identifica o exercício anterior como \`YYYY — RPNP\`.

## Limites

A prioridade implementada é **visual e de ordenação**. Ela não altera automaticamente datas de comissão, datas de tesouraria, criação de NF, liquidação financeira, status do empenho ou regras de TR.
