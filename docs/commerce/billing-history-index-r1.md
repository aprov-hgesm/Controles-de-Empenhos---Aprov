# Auditoria R1 — Índice composto para o histórico financeiro

**Estado:** proposta, sem alteração no Firebase real, no banco, nas Rules, em `main` ou na Vercel.

## Falha comprovada e correção proposta

A consulta antiga filtrava `billingCycles.workspaceId` e aplicava `limit 24` sem ordenar. Ordenar somente depois da consulta pode apresentar competências antigas e omitir as recentes.

A primeira correção tentava uma varredura `__name__ DESC` no intervalo de um tenant; o Firestore Emulator respondeu `400 FAILED_PRECONDITION: Firestore does not support descending key scans`. Ela foi substituída por filtro `workspaceId == <id-validado>` e `orderBy referenceMonth DESC`, antes do `limit 24`.

## Pré-requisito de produção

O Firestore exige índice composto no **banco correto**, não no database Warehouse. Exemplo conceitual:

```json
{
  "collectionGroup": "billingCycles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "workspaceId", "order": "ASCENDING" },
    { "fieldPath": "referenceMonth", "order": "DESCENDING" }
  ]
}
```

**Não substituir o arquivo de índices existente por um arquivo contendo somente este índice.** Isso pode excluir índices já provisionados. Antes de qualquer merge do PR de performance, um responsável deve inventariar os índices existentes no database `firebaseConfig.firestoreDatabaseId`, adicionar este índice de forma incremental, aguardar `READY` e executar o smoke autenticado do histórico.

A consulta REST já está programada para **falhar fechada**: sem credencial/índice/Firestore disponível, retorna `available:false`; nunca faz listagem global como fallback.

## Evidências automatizadas

- Testes sem rede: GET do handler real; pagamentos sem `runQuery`; histórico com consulta; VIP isento sem consulta; POST sem permissão recusado; identidade verificada com duas leituras concorrentes.
- Firestore Emulator isolado: 36 competências do workspace A + 12 do B, retorno de exatamente 24 competências mais recentes de A e nenhum documento de B; índices emulados podem diferir da configuração de produção.
- Exibição continua com resumo de até 24 registros, sem afirmar ser histórico completo.

## Publicação futura

Este PR é **somente auditoria**, sem merge e sem deploy. A ativação do índice deve respeitar a liberação do outro desenvolvimento em andamento, validação da composição e método de staged Vercel documentado em `docs/EMPROVEX_RELEASE_POWERSHELL.md`.
