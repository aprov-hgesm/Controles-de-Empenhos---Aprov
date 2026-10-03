# PILOT-C — HANDOFF

Data: **2026-10-02**

Frente: **PILOT-C — Operação, Recovery, Health e Uptime da SAAS-P do EMPROVEX**

## Identificação

- **Branch:** `saas-p-c-recovery-uptime`
- **Base congelada:** `4d87370e5ee7f2697ab4901e0c045a9ab4910fe9`
- **Branch coordenadora:** `feat/saas-r1-commercializacao`
- **HEAD inicial:** igual à base congelada (0 commits à frente / 0 atrás antes deste handoff)
- **Status:** **PARCIAL / BLOQUEADO EXTERNAMENTE**
- **Escopo executado por esta worker:** auditoria documental, auditoria do tooling e do PR #223, consolidação das evidências já obtidas e preparação do procedimento seguro de J23/J24.
- **Mudanças produtivas realizadas por esta worker:** nenhuma.

A branch coordenadora avançou depois do congelamento comum. Esta worker deliberadamente **não fez merge nem rebase** da integradora ou de outros workers.

## Recovery principal

Database:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`

Última evidência externa real disponível em 2026-10-02:

- PITR: **ATIVO**
- delete protection: **ATIVA**
- schedule diário: **ATIVO**
- retenção: **14 semanas**
- backup READY: **NÃO**
- backups concluídos: **0**

Não houve novo `apply`. O estado `backupReady=false` por si só **não é falha de configuração** e não justifica reaplicar controles.

## Recovery warehouse

Database:

`emprovex-warehouse`

Última evidência externa real disponível em 2026-10-02:

- PITR: **ATIVO**
- delete protection: **ATIVA**
- schedule diário: **ATIVO**
- retenção: **14 semanas**
- backup READY: **NÃO**
- backups concluídos: **0**

Não houve novo `apply`.

O backup lógico por workspace não cobre a árvore logística do `emprovex-warehouse`; por isso o backup nativo continua sendo a camada obrigatória para recuperação global da Central.

## PITR

**PASS na última evidência externa conhecida para os dois bancos.**

Nenhuma nova alteração foi executada por esta worker.

## Delete protection

**PASS na última evidência externa conhecida para os dois bancos.**

Nenhuma nova alteração foi executada por esta worker.

## Schedule

**PASS na última evidência externa conhecida para os dois bancos.**

Política esperada:

- recorrência diária;
- retenção de 14 semanas.

Nenhum schedule foi recriado ou alterado por esta worker.

## Backup READY

**PENDENTE / BLOQUEADO POR EVENTO EXTERNO.**

Última verificação real conhecida:

- banco principal: `backupReady=false`, `completedBackupCount=0`;
- warehouse: `backupReady=false`, `completedBackupCount=0`;
- certificação global: `ready=false`.

Isso é compatível com schedules recém-configurados. Não executar verificação em loop.

Próxima leitura segura, quando houver ambiente autenticado:

```bash
npm run recovery:status
npm run recovery:verify
```

`verify` só pode ser considerado PASS quando cada banco tiver PITR, delete protection, exatamente um schedule diário com a retenção esperada e pelo menos um backup `READY`.

## recovery:verify

**NÃO REEXECUTADO por esta worker**, porque este ambiente não possui sessão autenticada do Google Cloud para o projeto.

Último estado externo conhecido: **não certificado**, exclusivamente porque nenhum backup `READY` havia sido concluído.

Não fabricar evidência e não interpretar ausência de credencial do worker como falha do produto.

## Backup escolhido para restore

**PENDENTE.**

Não existe backup real `READY` conhecido que possa ser selecionado legitimamente neste fechamento.

Quando existir backup `READY`, registrar antes do restore:

- resource name completo;
- database de origem;
- location;
- `snapshotTime`;
- `expireTime`;
- state = `READY`.

Prioridade operacional sugerida para o primeiro teste real: `emprovex-warehouse`, pois esse banco não possui cobertura pelo backup lógico por workspace. Isso não elimina a exigência de confirmar backup `READY` também no banco principal.

## Restore target

**NÃO CRIADO.**

O destino deverá ser um database novo e isolado, nunca:

- `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- `emprovex-warehouse`;
- `(default)`.

Padrão recomendado de ID no dia da execução:

`emprovex-restore-warehouse-AAAA-MM-DD`

Antes do restore real, gerar o plano localmente com o backup real:

```bash
node scripts/firestore-recovery.mjs restore-plan \
  --database=emprovex-warehouse \
  --backup=projects/gen-lang-client-0982077967/locations/LOCALIZACAO/backups/BACKUP_ID \
  --target=emprovex-restore-warehouse-AAAA-MM-DD
```

O `restore-plan` é somente leitura e deve imprimir o comando `gcloud firestore databases restore` sem executá-lo.

## Restore executado

**NÃO.**

Restore real é mudança externa com custo e exige autorização específica.

Antes de executar, o Coordenador deve apresentar:

- origem e backup `READY`;
- target isolado;
- comando completo;
- risco e custo potencial;
- estratégia de validação;
- confirmação de que nenhum database produtivo será alvo.

Depois da autorização e execução:

1. acompanhar a operação;
2. descrever o database restaurado;
3. validar amostras;
4. conferir/reaplicar IAM, Rules e TTL quando aplicável;
5. manter o banco restaurado sem acesso de cliente até a validação terminar.

## Validação de dados

**PENDENTE porque o restore real não ocorreu.**

Amostras mínimas previstas no runbook.

Banco principal:

- `workspaces`;
- `platformAccounts`;
- um workspace com `empenhos`;
- `invoices`;
- `comissoes`;
- `cronogramas`;
- `alerts`.

Warehouse, sob `warehouse/{workspaceId}`:

- `materials`;
- `depots`;
- `locations`;
- `movements`;
- `balances`;
- `locationBalances`;
- `layouts`;
- `intakes`;
- `inventories`;
- `consumptions`.

Registrar banco de origem, backup, snapshot, target, início/fim, coleções verificadas e diferenças encontradas.

## PR #223

PR independente auditado:

- **PR:** #223 — `SAAS-P: publicar endpoint mínimo de health`
- **branch:** `saas-p-ops-health-endpoint`
- **base:** `main`
- **estado:** aberto, **draft**, não mergeado
- **mergeable:** sim
- **HEAD auditado:** `08ddbc92a602b3a09bb8728d648a0415b6831de6`
- **escopo:** endpoint `GET /api/health`, teste de contrato, script `test:health` e handoff
- **Rules/billing/Auth/Mobile:** sem alterações

Gates observados no HEAD auditado:

- Application CI #918: **SUCCESS**
- EMPROVEX Core Protection #205: **SUCCESS**
- Recovery guardrails #604: **SUCCESS**
- Vercel: **FAILURE externa por build-rate-limit**, tratada pela política corrente como não bloqueante durante o desenvolvimento sem intenção de deploy.

Esta worker não alterou, mergeou nem publicou o PR #223.

## Estado health

Contrato auditado no PR #223:

- GET público;
- HTTP 200;
- JSON com `status: "ok"`;
- timestamp UTC;
- `Cache-Control: no-store`;
- sem Firestore;
- sem secrets/env;
- sem identificação de versão/commit.

**Produção:** ainda não validável, pois o endpoint não foi publicado em `main`/produção.

Não criar uptime produtivo apontando para rota inexistente.

## Procedimento preparado para J23 — Health/Uptime

Somente após publicação explicitamente autorizada do endpoint:

1. smoke HTTP:
   ```bash
   curl -i https://emprovex.com.br/api/health
   ```
2. confirmar HTTP 200;
3. confirmar corpo contendo `"status":"ok"`;
4. confirmar HTTPS/SSL válido;
5. criar o uptime check:
   ```bash
   gcloud monitoring uptime create "EMPROVEX HTTPS" \
     --project=gen-lang-client-0982077967 \
     --resource-type=uptime-url \
     --resource-labels=host=emprovex.com.br,project_id=gen-lang-client-0982077967 \
     --protocol=https \
     --path=/api/health \
     --port=443 \
     --request-method=get \
     --validate-ssl=true \
     --status-classes=2xx \
     --matcher-content='"status":"ok"' \
     --matcher-type=contains-string \
     --period=5 \
     --timeout=10
   ```
6. no Cloud Monitoring, adicionar alert policy baseada em falha do uptime check;
7. usar duração curta não instantânea (referência do runbook: cerca de 2 minutos) para reduzir ruído;
8. associar notification channel controlado pelo fundador;
9. executar teste real do uptime/alerta/canal;
10. registrar evidência J23.

## Uptime

**NÃO CRIADO.**

Motivo: `/api/health` não está publicado em produção e criação/alteração de uptime produtivo exige autorização específica.

## Alert policy

**NÃO CRIADA.**

Depende do uptime check real e de autorização externa.

## Notification channel

**NÃO CRIADO / NÃO ALTERADO.**

Configuração externa da conta e teste real dependem de autorização específica.

## J23

**PREPARADO / BLOQUEADO EXTERNAMENTE.**

Código e contrato do endpoint estão auditados e os gates do PR #223 estão verdes, exceto a falha externa de Preview Vercel por rate limit.

Faltam:

- publicação autorizada de `/api/health`;
- smoke real HTTP/SSL;
- uptime check;
- alert policy;
- notification channel;
- teste real do alerta.

## J24

**PREPARADO / BLOQUEADO EXTERNAMENTE.**

Controles de proteção e schedule estão ativos na última evidência conhecida.

Faltam:

- um backup `READY` por banco;
- `npm run recovery:verify` verde;
- seleção de backup real;
- restore real para database isolado;
- validação de dados;
- conferência de IAM/Rules/TTL;
- registro da prova.

## Problemas PILOT-OPS

**Nenhum bug novo do tooling foi identificado nesta auditoria.**

O ajuste Windows/gcloud já havia sido tratado no PR #222 e integrado pelo Coordenador. Esta worker não reabriu esse escopo.

Se um novo defeito operacional aparecer durante a execução real de backup/restore/uptime, classificá-lo como `PILOT-OPS` e devolver ao Coordenador antes de qualquer expansão de código.

## Impacto MOBILE-R1

**Nenhum impacto funcional nesta frente.**

Esta worker adiciona apenas documentação de evidência/handoff e não altera:

- Auth;
- Rules;
- Central;
- workspace/UG;
- sessão/lease;
- shell;
- legal gate;
- lifecycle;
- `warehouseAccess`;
- contratos comuns.

Qualquer futura correção de código que toque essas áreas deve ser reconciliada semanticamente com a integradora MOBILE-R1 antes da SAAS-J.

## Testes/gates

Para a própria branch PILOT-C, a alteração deste fechamento é **documental-only em `docs/**`**.

Conforme `docs/DEVELOPMENT_CI_WORKFLOW.md`:

- Application CI ignora PRs com diff exclusivamente em `docs/**`;
- Recovery guardrails só deve rodar quando seus paths de recovery forem afetados;
- não há justificativa para Browser E2E nesta alteração documental.

Evidência técnica herdada e auditada para o health independente no PR #223:

- Application CI #918: SUCCESS;
- Core Protection #205: SUCCESS;
- Recovery guardrails #604: SUCCESS.

Nenhum teste é marcado como executado por esta worker sem evidência real.

## PR da frente

Destino obrigatório:

`feat/saas-r1-commercializacao`

Estado esperado: **draft / não mergear**.

O número do PR deve ser preenchido/confirmado após sua criação.

## Bloqueios

1. backups diários ainda sem `READY` na última evidência externa conhecida;
2. ambiente desta worker sem sessão Google Cloud autenticada para nova leitura;
3. restore real exige backup `READY` e autorização específica;
4. `/api/health` não está publicado em produção;
5. uptime, alert policy e notification channel exigem publicação/autorização externas;
6. política atual evita deploys Vercel durante o desenvolvimento.

Nenhum desses bloqueios exige repetir `apply` ou publicar o PR #223.

## Próxima ação

Quando houver evidência de que o primeiro backup diário pode ter concluído, executar **uma leitura** autenticada:

```bash
npm run recovery:status
npm run recovery:verify
```

Se os dois bancos apresentarem backup `READY`:

1. registrar os dois backups;
2. escolher backup real para o teste de restore;
3. gerar `restore-plan` com target novo/isolado;
4. apresentar o plano completo ao Coordenador/usuário;
5. somente após autorização específica, executar o restore e validar dados.

Em paralelo, J23 permanece preparado, mas sem criar uptime até o `/api/health` existir na produção autorizada.

---

## Conclusão da worker

A PILOT-C fecha esta entrega em estado **PARCIAL / BLOQUEADO EXTERNAMENTE**, conforme permitido pelo plano da SAAS-P.

A preparação segura foi concluída sem:

- repetir `apply`;
- restaurar banco;
- excluir banco;
- criar uptime/alerta/canal;
- mergear PR #223;
- fazer deploy;
- promover Vercel;
- alterar Rules.
