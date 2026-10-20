# EMPROVEX SaaS R1 — HARDEN-B — Recovery e Restore Isolado

Data de atualização: **2026-10-05**

Branch worker: `saas-harden-b-recovery-restore`  
Base congelada original: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`  
Branch integradora: `feat/saas-r1-commercializacao`  
PR: **#237 — HARDEN-B: recovery and isolated restore readiness**

## 1. Governança preservada

Esta frente permanece exclusivamente dedicada a **backup, recovery e restore isolado**.

Restrições vigentes:

- não rebasear a branch;
- não mergear a integradora;
- não corrigir mergeability por incorporação de commits externos;
- não alterar `main`;
- não alterar o RC FROZEN;
- não publicar Firestore Rules;
- não executar Vercel Production;
- não alterar IAM;
- não apontar a aplicação EMPROVEX para o banco restaurado;
- não executar writes de aplicação no target restaurado;
- não excluir automaticamente o banco temporário após a validação.

Estado global preservado no início deste fechamento:

- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- integradora SaaS observada pelo Program Control: `feat/saas-r1-commercializacao@965b1beee066aa7e50b32b9f190b62274239f4e0`;
- RC FROZEN: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`.

## 2. Projeto e bancos protegidos

Projeto Google Cloud:

`gen-lang-client-0982077967`

Região:

`us-east1`

Bancos produtivos protegidos:

1. `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`
2. `emprovex-warehouse`

Controles já comprovados nos dois bancos:

- PITR ativo;
- delete protection ativa;
- backup schedule diário ativo;
- retenção de 14 semanas;
- RPO interno de referência: 24 h;
- RTO interno de referência: 4 h.

## 3. Tooling de recovery

O tooling v2 foi executado no RC FROZEN:

`54e60c2264588d8802a67a4cab3d875d64f6bfc1`

Resultado já comprovado em 2026-10-04:

### `npm run recovery:status`

`ready=true`

### `npm run recovery:verify`

`ready=true`

nos dois bancos.

A antiga dependência temporal “aguardando primeiro backup READY” está encerrada.

## 4. Backups nativos READY comprovados

### 4.1 Banco principal

Database:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`

Backup:

`projects/gen-lang-client-0982077967/locations/us-east1/backups/17811fa5-c11c-4e1e-ab9c-bc48b79fe4a9`

Estado:

`READY`

Snapshot:

`2026-10-03T07:45:45.222712Z`

Expiração:

`2027-01-09T07:45:45.222712Z`

### 4.2 Warehouse

Database:

`emprovex-warehouse`

Backup:

`projects/gen-lang-client-0982077967/locations/us-east1/backups/5640c06e-229b-4cab-82a8-e7425dc035a3`

Estado:

`READY`

Snapshot:

`2026-10-03T17:05:24.058789Z`

Expiração:

`2027-01-09T17:05:24.058789Z`

## 5. Restore real autorizado

O Fundador autorizou explicitamente o restore real do backup do Warehouse para banco novo e isolado.

Origem:

`emprovex-warehouse`

Backup selecionado:

`5640c06e-229b-4cab-82a8-e7425dc035a3`

Target isolado:

`emprovex-restore-warehouse-2026-10-04`

Operação:

`projects/gen-lang-client-0982077967/databases/emprovex-restore-warehouse-2026-10-04/operations/VBGHTglagY-cTVmjSXHn4RAqMXRzYWUtc3UIIgoQHho`

Start time:

`2026-10-04T05:16:14.315849Z`

## 6. Resultado final da operação de restore

Evidência coletada em PowerShell autenticado no projeto em 2026-10-05:

- `done: true`;
- `operationState: SUCCESSFUL`;
- `startTime: 2026-10-04T05:16:14.315849Z`;
- `endTime: 2026-10-04T05:25:24.414352Z`;
- backup: `projects/gen-lang-client-0982077967/locations/us-east1/backups/5640c06e-229b-4cab-82a8-e7425dc035a3`;
- database target: `projects/gen-lang-client-0982077967/databases/emprovex-restore-warehouse-2026-10-04`;
- `sourceInfo.progress: COMPLETED`;
- snapshot restaurado: `2026-10-03T17:05:24.058789Z`;
- nenhum `error` reportado.

O gate de conclusão do restore real está **PASS**.

Não foi iniciado segundo restore e nenhum banco produtivo foi sobrescrito.

## 7. Banco isolado criado

Resource:

`projects/gen-lang-client-0982077967/databases/emprovex-restore-warehouse-2026-10-04`

UID:

`e1e77149-a359-4d9c-8f81-5a094e871154`

Região:

`us-east1`

Estado confirmado após a conclusão:

- tipo: `FIRESTORE_NATIVE`;
- edição: `STANDARD`;
- região: `us-east1`;
- UID: `e1e77149-a359-4d9c-8f81-5a094e871154`;
- `deleteProtectionState: DELETE_PROTECTION_ENABLED`;
- `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED`;
- `sourceInfo.progress: COMPLETED`;
- source backup e snapshot correspondem exatamente ao backup Warehouse selecionado.

O PITR desabilitado no target temporário **não é automaticamente falha do teste**. O objetivo deste target é comprovar recuperabilidade, integridade e isolamento; ele não foi promovido a banco produtivo.

## 8. Comportamento oficial do mecanismo de backup/restore

Segundo a documentação oficial atual do Firestore Native:

- o backup é uma cópia consistente do banco em um ponto no tempo;
- o backup contém **dados e configurações de índices** daquele momento;
- o backup **não contém políticas TTL**;
- o backup **não contém Firebase Security Rules**;
- o restore grava o backup em **novo banco Firestore**;
- após o restore, é necessário verificar o IAM do novo banco;
- Rules devem ser configuradas separadamente quando aplicáveis;
- TTL precisa ser reaplicado quando aplicável.

Referências oficiais:

- Google Cloud Firestore — Back up and restore data:
  https://cloud.google.com/firestore/native/docs/backups
- Google Cloud Firestore — Manage data retention with TTL policies:
  https://cloud.google.com/firestore/native/docs/ttl

## 9. Gates pós-restore obrigatórios

Somente depois de a operação deixar `PROCESSING` sem `error`, executar os gates abaixo.

### A. Operação

Confirmar:

- operação concluída;
- ausência de `error`;
- source database correto;
- backup correto;
- target correto;
- snapshot correto;
- horário de conclusão.

### B. Banco restaurado

Confirmar por leitura:

- banco existe;
- tipo Firestore Native;
- região `us-east1`;
- `sourceInfo.backup` aponta para o backup Warehouse selecionado;
- `sourceInfo.progress` concluído;
- target continua distinto dos bancos produtivos.

### C. Integridade dos dados — PASS

Foi executada comparação somente leitura entre `emprovex-warehouse` e `emprovex-restore-warehouse-2026-10-04`.

Resultado:

| Coleção | Origem | Restore | Diferença |
| --- | ---: | ---: | ---: |
| materials | 56 | 56 | 0 |
| depots | 11 | 11 | 0 |
| locations | 265 | 265 | 0 |
| movements | 810 | 810 | 0 |
| balances | 56 | 56 | 0 |
| locationBalances | 70 | 70 | 0 |
| lots | 12 | 12 | 0 |
| layouts | 21 | 21 | 0 |
| inventories | 0 | 0 | 0 |
| intakes | 917 | 917 | 0 |
| destinations | 4 | 4 | 0 |
| withdrawals | 3 | 3 | 0 |
| consumptions | 912 | 912 | 0 |

As **13 coleções verificadas coincidem exatamente**, inclusive coleções de grande volume e relevância operacional como `movements`, `intakes` e `consumptions`.

Como a origem poderia ter recebido alterações após o snapshot de `2026-10-03T17:05:24.058789Z`, igualdade não era requisito. A igualdade observada torna a evidência ainda mais forte.

Gate de integridade: **PASS**.

### D. Isolamento — PASS

Comprovado:

- `emprovex-restore-warehouse-2026-10-04` é distinto de `emprovex-warehouse`;
- target é distinto do banco principal;
- `firebase.json` referencia apenas os bancos produtivos configurados e não aponta o EMPROVEX para o target temporário;
- nenhuma variável produtiva foi alterada por esta frente;
- nenhum write de aplicação foi executado no target;
- nenhum banco produtivo foi sobrescrito.

Gate de isolamento: **PASS**.

### E. IAM — PASS

A política IAM do projeto foi inspecionada em modo somente leitura.

Bindings relevantes observados:

- `roles/datastore.user` — `serviceAccount:emprovex-provisioner@gen-lang-client-0982077967.iam.gserviceaccount.com`;
- `roles/firebase.managementServiceAgent` — service agent Firebase;
- `roles/firebase.sdkAdminServiceAgent` — Firebase Admin SDK service account;
- `roles/firebaseappcheck.admin` — Firebase Admin SDK service account;
- `roles/firebaseappcheck.serviceAgent` — App Check service agent;
- `roles/firebaseauth.admin` — `emprovex-provisioner`;
- `roles/firebaserules.system` — Firebase Rules service agent;
- `roles/owner` — conta fundadora.

Nenhum binding foi alterado nesta frente.

A inspeção não revelou concessão criada especificamente para o target restaurado nem ampliação deliberada de acesso durante o teste.

Gate IAM: **PASS** para o escopo read-only desta certificação.

### F. Firebase Security Rules

Registrar explicitamente:

- Rules **não fazem parte do backup**;
- Rules não devem ser inferidas como restauradas;
- Firebase Security Rules são gerenciadas separadamente para cada named database;
- a configuração segura de Rules é etapa separada de disaster recovery.

Evidência do repositório:

- `firebase.json` associa `emprovex-warehouse` a `firestore.warehouse.rules`;
- `firebase.json` não possui entrada para o target temporário `emprovex-restore-warehouse-2026-10-04`;
- o source `firestore.warehouse.rules` define explicitamente o namespace `/warehouse/{workspaceId}` e suas coleções operacionais.

Portanto, a existência dos dados restaurados **não prova** que o ruleset Warehouse está anexado ao target.

Foi tentada leitura read-only do release de Rules tanto em:

- `emprovex-warehouse`;
- `emprovex-restore-warehouse-2026-10-04`.

As duas consultas retornaram `HTTP 403 Forbidden`.

Como o mesmo 403 ocorre na **origem produtiva** e no target restaurado, esta evidência não caracteriza regressão específica do restore; caracteriza limitação de leitura/autorização da API com o token utilizado nesta verificação.

A documentação oficial exige a permissão `firebaserules.releases.get` para leitura de release. O runbook permanece correto: Rules são responsabilidade separada e não devem ser presumidas como restauradas.

Nenhum ruleset foi publicado nesta frente.

Gate de comportamento/procedimento de Rules: **PASS COM RISCO RESIDUAL DOCUMENTADO**.

Risco residual: antes de promover qualquer banco restaurado a substituto operacional, deve-se resolver a leitura `403` e confirmar/publicar explicitamente o ruleset adequado por procedimento controlado.

### G. TTL

Registrar explicitamente:

- políticas TTL **não fazem parte do backup**;
- TTL não é reaplicado automaticamente ao target;
- a eventual reaplicação deve seguir runbook separado e autorização adequada.

Evidência pós-restore no target:

- `gcloud firestore fields ttls list` => `Listed 0 items.`.

Comparação com a origem concluída:

- target: `Listed 0 items.`;
- origem `emprovex-warehouse`: `Listed 0 items.`.

Não havia política TTL na origem que precisasse ser reaplicada neste snapshot.

Gate TTL: **PASS**.

Não foi habilitado TTL no target apenas para cumprir o teste.

### H. Índices/configurações

O backup inclui configurações de índice do snapshot.

Evidência pós-restore no target:

- composite indexes: `Listed 0 items.`;
- field indexes: somente o registro default `collectionGroups/__default__/fields/*`.

Comparação com a origem concluída:

- composite indexes origem: `Listed 0 items.`;
- composite indexes target: `Listed 0 items.`;
- field indexes origem: apenas `collectionGroups/__default__/fields/*`;
- field indexes target: apenas `collectionGroups/__default__/fields/*`.

A configuração observável de índices é coerente entre origem e restore.

Gate de índices/configuração: **PASS**.

Nenhuma alteração foi feita apenas para o teste.

## 10. Comandos de verificação pós-restore

PowerShell já utilizado pelo operador:

```powershell
$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

$Operation = "projects/gen-lang-client-0982077967/databases/emprovex-restore-warehouse-2026-10-04/operations/VBGHTglagY-cTVmjSXHn4RAqMXRzYWUtc3UIIgoQHho"

& $Gcloud firestore operations describe "$Operation"
```

Depois da conclusão:

```powershell
& $Gcloud firestore databases describe `
  --project="gen-lang-client-0982077967" `
  --database="emprovex-restore-warehouse-2026-10-04"

& $Gcloud firestore indexes composite list `
  --project="gen-lang-client-0982077967" `
  --database="emprovex-restore-warehouse-2026-10-04"

& $Gcloud firestore indexes fields list `
  --project="gen-lang-client-0982077967" `
  --database="emprovex-restore-warehouse-2026-10-04"
```

Qualquer consulta de dados deve ser somente leitura e deve evitar writes acidentais.

## 11. Cleanup

O banco restaurado **não deve ser apagado automaticamente**.

Após o fechamento do teste, o handoff deve registrar:

- target ainda existente;
- possível custo enquanto existir;
- delete protection ativa;
- cleanup recomendado;
- necessidade de autorização separada para desativar delete protection e excluir o target.

## 12. Impacto em produção e RC

Até este checkpoint:

- produção alterada: **NÃO**;
- RC FROZEN alterado: **NÃO**;
- Rules produtivas alteradas: **NÃO**;
- IAM alterado por esta frente: **NÃO**;
- Vercel Production executado: **NÃO**;
- banco produtivo sobrescrito: **NÃO**.

## 13. Impacto MOBILE-R1

Classificação:

**SEM DELTA**

Justificativa:

- nenhuma alteração de schema da aplicação;
- nenhuma alteração de Auth;
- nenhuma alteração de sessão/lease;
- nenhuma publicação de Rules;
- nenhuma alteração de contratos Mobile;
- nenhuma alteração de código Mobile;
- nenhuma alteração de `next.config.ts`.

## 14. Classificação final do worker

**HARDEN-B — PASS TÉCNICO / APTO PARA RATIFICAÇÃO DO PROGRAM CONTROL**

Fundamentos:

- backups READY nos dois bancos: **PASS**;
- `recovery:status = ready=true`: **PASS**;
- `recovery:verify = ready=true`: **PASS**;
- autorização explícita do restore: **PASS**;
- restore real isolado: **SUCCESSFUL / PASS**;
- target Firestore Native em `us-east1`: **PASS**;
- source backup/snapshot corretos: **PASS**;
- `sourceInfo.progress = COMPLETED`: **PASS**;
- integridade de dados: **13/13 coleções verificadas com contagens idênticas / PASS**;
- isolamento: **PASS**;
- IAM read-only: **PASS**;
- TTL origem x restore: **0 x 0 / PASS**;
- composite indexes origem x restore: **0 x 0 / PASS**;
- field index config origem x restore: **default x default / PASS**;
- Rules: procedimento de disaster recovery comprovado; leitura live do release retornou `403` em origem e target, registrada como **risco residual não bloqueante**;
- produção alterada: **NÃO**;
- RC FROZEN alterado: **NÃO**.

A recuperabilidade real do Warehouse foi demonstrada por backup nativo READY, restore autorizado em database isolado, conclusão sem erro e verificação quantitativa de dados reais.

## 15. Recomendação ao Program Control

A recomendação formal deste worker é:

**APTO PARA RATIFICAR HARDEN-B — PASS**

A ratificação global permanece responsabilidade do Program Control após auditoria independente deste handoff.

O risco residual de Rules não bloqueia a certificação de recuperabilidade, mas deve permanecer registrado no runbook: um banco restaurado não deve ser promovido a substituto operacional sem confirmação/aplicação explícita do ruleset correto.

## 16. Handoff final — campos obrigatórios

Ao fechar a frente, registrar:

- branch;
- HEAD inicial;
- HEAD final;
- PR #237;
- estado do PR;
- backup principal;
- backup Warehouse;
- `recovery:status`;
- `recovery:verify`;
- restore operation ID;
- target isolado;
- horário de início e fim;
- resultado da operação;
- evidência de integridade;
- evidência de isolamento;
- IAM;
- Rules;
- TTL;
- índices/configurações;
- produção alterada: SIM/NÃO;
- RC FROZEN alterado: SIM/NÃO;
- riscos residuais;
- cleanup pendente;
- classificação final;
- recomendação ao Program Control.

Recomendação esperada, se tudo passar:

**APTO PARA RATIFICAR HARDEN-B — PASS**
