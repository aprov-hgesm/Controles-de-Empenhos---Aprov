# EMPROVEX — NE: Cadastro Manual e Importação PDF

Decisão do fundador em 16/10/2026: desativar apenas a entrada de Nota de Empenho via JSON.

Métodos permitidos na aba Empenhos / Cadastrar Empenho:
- Cadastro Manual;
- Importar PDF da NE, usando /api/empenhos/parse-ne e revisão editável antes de salvar.

O botão JSON, o campo de colagem, os comandos de prompt externo e o parser JSON de NE foram retirados. A gravação da revisão exige importSource === 'pdf'. Históricos, modelos persistidos, outros sistemas que trabalham com JSON (SAG, NF etc.) e importação PDF permanecem preservados.

Validação: npm run verify:empenho-pdf-direct-import, npm run verify:empenhos-subtabs, npm run typecheck e Application CI.

Mudanças isoladas em branch DRAFT; nenhum merge/deploy/alteração de banco autorizados.
