# EMPROVEX SaaS R1 — HARDEN-B — Recovery e Restore Isolado

Data de atualização: **2026-10-04**

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

## 6. Último estado operacional conhecido

Na última evidência entregue ao worker, a operação ainda estava em execução:

- `operationState: PROCESSING`;
- `completedWork: 30`;
- `estimatedWork: 100`;
- `sourceInfo.progress: IN_PROGRESS`;
- nenhum erro reportado.

Enquanto esse estado permanecer `PROCESSING`:

- não iniciar novo restore;
- não criar segundo target;
- não alterar o target;
- não executar cleanup;
- não declarar PASS.

## 7. Banco isolado criado

Resource:

`projects/gen-lang-client-0982077967/databases/emprovex-restore-warehouse-2026-10-04`

UID:

`e1e77149-a359-4d9c-8f81-5a094e871154`

Região:

`us-east1`

Estado observado durante o restore:

- `deleteProtectionState: DELETE_PROTECTION_ENABLED`;
- `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED`.

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

### C. Integridade dos dados

O gate deve provar presença de dados reais recuperados da Central de Depósitos.

Verificações devem ser **somente leitura**.

Comparações com produção devem respeitar o snapshot:

`2026-10-03T17:05:24.058789Z`

Não exigir igualdade com alterações realizadas após esse horário.

Amostras/contagens devem cobrir estruturas reais representativas da Central de Depósitos, conforme existirem no snapshot, por exemplo:

- materiais;
- depósitos;
- posições/locations;
- movimentos/ledger;
- saldos;
- layouts;
- intake;
- inventário;
- consumo;
- demais coleções reais relevantes.

### D. Isolamento

Comprovar:

- `emprovex-restore-warehouse-2026-10-04` é distinto de `emprovex-warehouse`;
- target é distinto do banco principal;
- nenhuma configuração do EMPROVEX aponta para o target;
- nenhuma variável produtiva foi alterada;
- nenhum write de aplicação foi executado no target.

### E. IAM

Inspecionar em modo somente leitura:

- controles IAM aplicáveis ao banco/projeto;
- ausência de exposição indevida;
- requisitos necessários para um eventual restore emergencial.

Não alterar IAM nesta frente.

### F. Firebase Security Rules

Registrar explicitamente:

- Rules **não fazem parte do backup**;
- Rules não devem ser inferidas como restauradas;
- em um banco novo sem configuração anterior, clientes web/mobile ficam bloqueados por padrão segundo a documentação oficial;
- a configuração segura de Rules é etapa separada de disaster recovery.

Não publicar Rules nesta frente.

### G. TTL

Registrar explicitamente:

- políticas TTL **não fazem parte do backup**;
- TTL não é reaplicado automaticamente ao target;
- a eventual reaplicação deve seguir runbook separado e autorização adequada.

Não habilitar TTL no target apenas para cumprir o teste.

### H. Índices/configurações

O backup inclui configurações de índice do snapshot.

Após a conclusão, listar/inspecionar o estado de índices no target e registrar a evidência. Nenhuma alteração deve ser feita sem necessidade.

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

## 14. Classificação atual do worker

**HARDEN-B — PARCIAL / RESTORE REAL EM ANDAMENTO**

Motivo:

- backups READY: comprovados;
- `recovery:status = ready=true`: comprovado;
- `recovery:verify = ready=true`: comprovado;
- autorização explícita do restore: comprovada;
- restore real isolado: iniciado;
- target isolado: criado;
- conclusão da operação: **ainda não comprovada neste checkpoint**;
- integridade de dados pós-restore: **pendente**;
- IAM pós-restore: **pendente**;
- Rules/TTL pós-restore: comportamento documentado, verificação do target pendente;
- índices/configurações pós-restore: verificação pendente.

Ainda não existe base factual para declarar `PASS TÉCNICO` enquanto a operação estiver `PROCESSING`.

## 15. Gate final esperado

Se a operação concluir sem erro e todos os gates pós-restore forem comprovados:

**HARDEN-B — PASS TÉCNICO / APTO PARA RATIFICAÇÃO DO PROGRAM CONTROL**

A ratificação formal:

**HARDEN-B — PASS**

permanece responsabilidade do Program Control após auditoria independente.

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
