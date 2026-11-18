# W4 — Produção da Cozinha Dietética | Handoff técnico R1

**Base obrigatória:** W0_BASE_SHA `4bcfee7730fc0da3177d9af8a81eabeb7f844abb` · **Branch:** `feat/cozinha-dietetica-w4-producao`.

## Interfaces e fronteiras

- `ProductionView` em `features/hospital/production/ProductionView.tsx`: componente `use client` exportado, a ser montado **somente por W9** na área autenticada. Props `{organizationId, unitIds, getAuthorization, initialDate?, initialCycle?}`. `getAuthorization()` retorna `Bearer <Firebase ID token>`; a API verifica o token e membership no servidor. Não há login paralelo e nenhum dado clínico é colocado em URL pública.
- `ProductionService` em `lib/server/hospital/production/service.mjs`: importa `requireHospitalPermission`, `HospitalQAStore` e motor do W0. Métodos: `snapshot`, `createBatch`, `startBatch`, `completeBatch`, `acknowledgeBatch`, `reconcileBatch`, `cancelBatch`, `flagAffected`. Tipos em `features/hospital/production/contracts.ts`.
- `GET /api/hospital/production`: `unitId` repetível, `localDate`, `cycleId`, `status`, `dietCode`, `restriction`, `lateOnly`, `includeSuspended`. Retorna apenas mapas enviados/fechados das unidades permitidas, pedidos, consolidados e lotes.
- `POST /api/hospital/production`: `{action,args}` onde action é `create|start|complete|acknowledge|reconcile|cancel|flagAffected`. Não contém `DISPATCHED` nem `DELIVERED`.
- `GET /api/hospital/production/stream?unitId=...`: SSE autorizado com cursor de revisão **sem identificadores clínicos**. Atualização a cada 10 segundos, sessão limitada a ~2 minutos e revalidação na conexão seguinte. Cliente usa polling de 20 segundos como fallback. Todas as rotas exigem `Authorization: Bearer <token>` e `x-hospital-organization-id` e autorizam cada unidade pedida.

**Atenção:** os endpoints estão intencionalmente ativos apenas no `next dev` de QA, com `NODE_ENV != production` e `HOSPITAL_QA_DB_PATH` em `/tmp`; não conectar a Firestore de produção nem habilitar DB clínico sem homologação e infraestrutura segregada. O W0 requer Firebase Admin inicializado em execução do backend. O endpoint nunca emite dados fictícios de produção.

## Comandos para W5 e W8

Depois de `startBatch` cada pedido passa `REQUESTED -> PREPARING` com evento imutável `meal.production.started` (`batchId`, `quantity:1`, `stage:'PREPARING'`). Depois de `completeBatch` cada pedido **elegível** passa `PREPARING -> READY` com `meal.production.completed` (`batchId`, `quantity:1`, `stage:'READY'`). O próprio lote emite `meal.production.batch.created|started|completed|review.required|review.cleared|reconciled|cancelled` com quantidade e IDs sintéticos opacos de pedidos. O W5 deve buscar o pedido mais recente, comparar versão da dieta/jejum/alergias no instante de expedição, e **nunca** inferir entrega de `READY`. O W8 pode consultar agregados e eventos por organização/unidade autorizada, sem logs de PHI.

**Invariante clínica:** lote só pode ser criado a partir de `MealRequest` cujo mapa esteja `SUBMITTED` ou `CLOSED`, status `REQUESTED` e internação/ref médica vigente compatíveis. No início e no fim, todos os itens são revalidados dentro da mesma transação SQLite; alteração clínica, transferência, cancelamento ou status inconsistente interrompe toda a transação. `snapshot` marca `effectiveStatus:'NEEDS_REVIEW'`. `reconcileBatch` retira **somente** pedidos comprovadamente inelegíveis com evento, preservando a trilha; `acknowledgeBatch` permite concluir reconferência sem exclusões quando não há pendência atual. `flagAffected` é gancho da cozinha para eventos W2/W3; integrações com atores de unidade devem gerar evento e não forjar um `HospitalScope` de cozinha. Não há reconciliação automática irreversível.

**Produção e preparação:** `ProductionBatch` é agrupado por unidade, ciclo, dia, dieta, principal/secundária e restrições; o responsável informa a preparação/prato. Lotes de dietas ou restrições distintas não podem ser misturados. O consolidado usa a chave canônica do pedido W0, evitando dupla contagem em adendos e transferências. A prioridade institucional só poderá ser exibida/filtrada quando W3/W7 estabelecerem atributo autorizado; o W4 não inventa prioridade a partir de texto livre.

## Testes e limites

`node --test tests/hospital/production/production.test.mjs` — **12/12 PASS no ensaio local** (Node 22, SQLite transacional QA): dois mapas, dez pedidos, jejuns/alergias, mudança médica, tardio, cancelamento, idempotência, concorrência por duas conexões, transferência, OM/perfis, reconexão e trilha sem identificador de paciente. O ensaio local usou um harness compatível com as primitivas W0; repetir na árvore completa da PR/CI com os módulos W0 oficiais é gate indispensável. **Não foi executado build ou typecheck do Next completo**, por não existir checkout/dependências instaladas no ambiente deste Worker.

**GO condicional para integração W9** após execução dos testes na árvore conjunta. **NO-GO para uso clínico, deploy e produção.** Pendências externas: adaptador clínico definitivo e isolado, autenticação Firebase Admin de QA, contrato W3 de prioridade/preparações e homologação institucional das restrições. Nenhum merge, deploy ou dado real nesta entrega.
