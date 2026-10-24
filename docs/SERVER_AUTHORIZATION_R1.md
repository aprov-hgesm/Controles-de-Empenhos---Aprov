# EMPROVEX — Núcleo de Autenticação e Autorização no servidor (R1)

Data: 24/10/2026. Branch isolada: `feat/emprovex-server-authz-r1-20261024`.
Não foi executado merge, deploy, atualização de Rules ou acesso a dados produtivos.

## Executado em código

- Política explícita e negativa por padrão (`lib/server/authorizationPolicy.ts`).
- Comandos Warehouse classificados por allowlist; `LEDGER_MOVEMENT` permanece proibido.
- `lib/server/warehouseAccess.ts` verifica JWT Firebase, provider, UID vinculado, status da conta, workspace e UG, sem aceitar essas identidades declaradas pelo corpo da requisição.
- A leitura dos documentos `platformAccounts/{email}` e `workspaces/{id}` passou para `lib/server/coreIdentityStore.ts`, usando **IAM server-side** com conta de serviço e allowlist de caminhos; não depende do Firebase token como autorização da consulta Firestore. Emulador somente com projeto `demo-` e host local, fora de produção.
- APIs Warehouse de operações, alocação/consumo imediato, entrada avulsa, fila de NF, status e importação XLSX passam pela mesma política.
- Novo endpoint autenticado `GET /api/authz/context` fornece ao navegador apenas papel, UG e workspace obtidos de fontes verificadas (sem aceitar escopo do cliente). Preparado para substituir verificações locais na migração desktop; não dispensa a validação de cada operação.
- A API de leitura/extração de Nota de Empenho (`/api/empenhos/parse-ne`) exige também a identidade operacional ativa no servidor, em vez de aceitar qualquer Firebase JWT assinado. Motores específicos continuam responsáveis por saldo, lotes, transações, idempotência e consistência.
- Testes de política isolada e scanner de integração das rotas em `scripts/server-authz-policy.test.mjs`.

## Segurança e compatibilidade

O servidor confia em **identidade Firebase autenticada** e em dados de setor/workspace novamente consultados, não nos parâmetros fornecidos pelo navegador. As Firestore Rules atualmente publicadas continuam protegendo quaisquer acessos diretos do cliente. As permissões do IAM da conta de serviço devem permanecer mínimas e suas chaves exclusivas do servidor.

**Não concluir que todas as regras estão no servidor:** os módulos do desktop de Empenhos, Notas Fiscais, sessões, faturamento, administração e algumas leituras Warehouse ainda usam o Firebase SDK cliente e Firestore Rules. Não aplicar `allow read, write: if false` nesses caminhos antes de migrá-los. O Motor de Confiança do Operador Móvel segue uma frente distinta, sem duplicar os motores de negócio.

## Critérios de ativação / limites

1. CI e testes de integração Auth + Firestore Emulator (usuário válido, outsider, suspensão, workspace/UG divergente, replays, concorrência).
2. Staging Vercel com `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` server-only e permissão IAM **leitura limitada** no banco principal; certificar o caminho real de autorização.
3. Medir latência e consumo de leituras no cenário antes/depois; cada requisição externa exige revalidação para respeitar suspensão.
4. Validar o Operador Móvel e os módulos desktop separadamente; migrar leituras/escritas ainda cliente antes de reduzir Rules adicionais.
5. Somente promover produção manualmente após aceite explícito e possibilidade de rollback, conforme runbook `docs/EMPROVEX_RELEASE_POWERSHELL.md`.

**Handoff:** Onde estamos — núcleo de autorização server-side em PR isolado. Fazendo — certificação do código/política e compatibilidade. Quem — executor GitHub. Próximo — verificar CI e testar a autorização autenticada no Emulador e Vercel Staging. Quem fará — executor (GitHub/CI) e responsável pela conta Vercel (PowerShell). Regras e produção permanecem intactas.
