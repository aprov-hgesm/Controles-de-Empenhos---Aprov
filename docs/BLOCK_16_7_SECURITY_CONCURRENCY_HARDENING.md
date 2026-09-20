# BLOCO 16.7 — HARDENING DE SEGURANÇA E CONCORRÊNCIA

## Objetivo

Endurecer os componentes introduzidos nos Blocos 16.0 a 16.6 sem ampliar escopo, sem criar nova fonte de verdade e sem alterar o comportamento funcional esperado do operador.

A auditoria foi feita sobre a `main` em `33e16d3fc42512333fa5599aabcabb168419f814`.

## Riscos reais identificados

### 1. Provider founder-only divergente entre Rules e APIs server-side

As Firestore Rules já exigiam que a identidade fundadora utilizasse `google.com`, mas `verifyFounderFirebaseRequest` validava assinatura, issuer, audience, e-mail verificado e e-mail fundador sem validar o `sign_in_provider`.

Correção: as APIs founder-only agora exigem também `FOUNDER_AUTH_PROVIDER`, mantendo o mesmo contrato híbrido das Rules.

### 2. Reutilização de sessionId depois do prazo informativo do tombstone

Os documentos de `sessionRevocations` são imutáveis pelas Rules. O cliente, porém, tratava `expiresAt` como autorização para reutilizar o mesmo `sessionId` depois de 24 horas.

Isso poderia gerar uma inconsistência rara: uma identidade de sessão antiga poderia voltar a ocupar um slot enquanto o tombstone antigo ainda existisse e, numa segunda revogação, o administrador não conseguiria sobrescrever o tombstone imutável.

Correção: a existência de qualquer tombstone passa a revogar definitivamente aquele `sessionId`. O campo `expiresAt` permanece somente como metadado operacional/retentivo. Ao receber `SESSION_REVOKED`, o cliente elimina o estado local e um login posterior cria um novo `sessionId`.

### 3. Tempo capturado antes de retry de transação

O callback de uma transação Firestore pode ser repetido em caso de contenção. O lease usava um relógio capturado antes da transação.

Correção: cada tentativa calcula seu próprio `attemptNowMs`, usado para decidir takeover de slot expirado e gerar a nova expiração. Isso mantém lease de 10 minutos e heartbeat nominal de 5 minutos.

### 4. Encerramento remoto baseado em linha administrativa potencialmente obsoleta

Antes da exclusão, a transação validava sessionId, uid, workspaceId e UG.

Correção: a comparação agora inclui também slotId, accountEmail normalizado e browserInstanceId. Se a vaga mudou desde o snapshot do painel, o encerramento é recusado em vez de agir sobre outra sessão.

### 5. Respostas assíncronas administrativas fora de ordem

Os refreshes de telemetria por UG, Cloud Monitoring e política de alertas poderiam se sobrepor. Uma chamada antiga, se concluísse por último, poderia substituir a resposta mais recente na interface.

Correção: os três hooks usam sequência monotônica de requisição e somente a chamada corrente pode atualizar dados, erro ou loading.

## Componentes auditados sem mudança necessária

- tomada concorrente do último slot: permanece protegida por dois slots fixos e transação Firestore;
- limite externo: permanece em 2 sessões;
- conta fundadora: permanece ilimitada;
- lease: permanece em 10 minutos;
- heartbeat: permanece em 5 minutos;
- isolamento multi-tenant e identidade por UG: preservados;
- telemetria por UG: continua estimativa interna monotônica e isolada;
- Cloud Monitoring: continua leitura global real, server-side e sem polling;
- alertas 70/85/95/>100%: preservados e informativos;
- concorrência otimista de empenhos: permanece baseada em transação + revisão esperada;
- auditoria `session.terminate`: permanece imutável;
- Google Drive: continua a única camada documental por workspace.

## Firestore Rules

O Bloco 16.7 **não altera `firestore.rules`**.

A auditoria concluiu que as Rules atuais já oferecem os invariantes necessários para os riscos encontrados. As correções são de alinhamento do cliente/API e validação de estado concorrente.

## Armazenamento e deploy

- nenhum documento/PDF migra para Vercel Blob;
- nenhum documento/PDF migra para Firebase Storage;
- Google Drive permanece exclusivo para documentos;
- nenhum deploy manual ou de produção na Vercel faz parte deste bloco.

## Critérios de aceite

1. branch própria parte exatamente do fechamento do 16.6;
2. APIs founder-only exigem provider Google;
3. tombstone existente impede reciclagem do mesmo sessionId;
4. retries de transação usam relógio da própria tentativa;
5. encerramento remoto rejeita snapshot administrativo obsoleto;
6. refresh administrativo ignora respostas superseded;
7. Firestore Rules permanecem inalteradas;
8. testes de segurança multi-tenant cobrem imutabilidade do tombstone;
9. guard 16.7 integra a Application CI;
10. build, TypeScript, Diff Hygiene, Browser E2E e release gate permanecem verdes;
11. nenhum deploy Vercel é realizado.
