# EMPROVEX Cozinha Dietética — W0 | Contratos R1 e handoff de integração

**Entrega:** fundação hospitalar server-only. **Não é produto clínico homologado.** Branch: `feat/cozinha-dietetica-w0-fundacao` (base: `main`); PR Draft para `main`. W1–W8 devem partir do **SHA da HEAD do W0**, informado na PR, e não replicar os DTOs por conta própria.

## 1. Imports definitivos

- Tipos: `import type { HospitalScope, Admission, DietMap, MealRequest, HospitalPermission, HospitalResult } from '@/features/hospital/core/contracts';`
- Ciclos e estados: `import { CYCLES, classifyMealTiming, nextMealStatus, assertMealReleaseSafe, HospitalError } from '@/features/hospital/core/domain.mjs';`
- Token e autorização server-only: `import { resolveHospitalScope, requireHospitalPermission } from '@/lib/server/hospital/core/auth.mjs';`
- Storage QA: `import { HospitalQAStore } from '@/lib/server/hospital/core/qa-store.mjs';`
- Serviços reais: `import { HospitalCoreService } from '@/lib/server/hospital/core/service.mjs';`
- Adapter de route handler: `import { createHospitalCoreHandler } from '@/lib/server/hospital/core/handler.mjs';`

Os arquivos `.d.mts` acompanham `.mjs`, fornecendo tipos ao compilador TS do Next.js. Não importar nada sob `lib/server/hospital/` no cliente. `HospitalScope` é objeto opaco de runtime; não pode ser construído a partir de claims de cliente, query string, `workspaceId` ou cookies não verificados.

## 2. Autenticação e escopo

`resolveHospitalScope({authorization,organizationId,store})` verifica no servidor o Firebase ID token por `firebase-admin/auth`, com `checkRevoked=true`, e **então** busca membership habilitado na base hospitalar. O `firebase-admin` deve ter seu default app já inicializado pelo backend; falha fecha o acesso. Em testes, pode-se injetar `verifyToken: async token => ({uid: 'synthetic-uid'})` **somente em QA**, nunca da requisição HTTP. `requireHospitalPermission(scope, permission, unitId)` exige papel reconhecido, unidade autorizada e escopo emitido no processo servidor. A organização é consultada, UG conferida e dados de outra OM não são retornados.

Papéis: `UNIT`, `KITCHEN`, `NUTRITION`, `HOSPITAL_ADMIN`. `HOSPITAL_ADMIN` pode administrar configurações e ver trilha de auditoria nas unidades vinculadas, mas **não** ler pacientes, mapas ou prescrições por padrão. O administrador comercial EMPROVEX não é papel clínico. Cozinha e Nutrição são limitadas às `unitIds` explicitamente vinculadas. Médico prescreve fora do sistema V1; a unidade apenas registra a **referência** da prescrição existente.

## 3. Modelo, IDs, operações e consistência

- Entidades e DTOs públicos em `contracts.ts`: hospital, unit, bed, membership, patient, admission, location, medical reference, catalog, diet map / version, meal, production, label, delivery, incident, audit, nutrition audit e medical review.
- `HospitalCoreService` opera sob `HospitalScope` verificado. Métodos R1 de fundação: `createPatient`, `upsertDietCatalogItem`, `createAdmission`, `updateClinicalSafety`, `recordMedicalDiet`, `createDraftMap`, `addMealRequest`, `submitMap`, `closeMap`, `advanceMeal`, `planTransfer`, `confirmTransfer`, `openNutritionAudit`, `transitionNutritionAudit`, `get`, `list`, `listMapVersions`, `auditTrail`.
- `createDraftMap` cria ID determinístico hash de `org|unit|localDate|cycle`, prevenindo mapas duplicados por chave natural. `MealRequest.id` é hash de `org|admission|localDate|cycle|mealType` e `meal_keys` possui PK real. `idempotencyKey` é obrigatória em `addMealRequest` e não pode ser reaproveitada com payload diferente. `expectedRevision` atua como ETag para alterações e transições. `BEGIN IMMEDIATE` + constraints do SQLite asseguram atomicidade e serialização no QA.
- `submitMap` e `closeMap` são transições distintas; geram snapshots no `map_versions`. Adendo pós-envio/fechamento exige `reason`, cria **nova versão** sem atualizar versões antigas. Triggers SQL bloqueiam UPDATE/DELETE dos snapshots e do journal `hospital_events`. `occurredAt` é gerado pelo servidor; `effectiveAt` permanece campo de declaração clínica separado.
- `planTransfer` não altera internação; `confirmTransfer` exige vínculo nas duas unidades, muda unidade do paciente/internação e suspende refeições pendentes. Nenhuma tela pode assumir transferência executada a partir de um evento apenas planejado.
- `advanceMeal` respeita `REQUESTED -> PREPARING -> READY -> DISPATCHED -> RECEIVED_BY_UNIT -> DELIVERED` (com suspensões), sem inferir entrega do preparo. Alergia incompatível ou jejum suspendem ou bloqueiam a liberação. A Nutrição registra inconformidade mas não habilita automaticamente mapas ou pedidos.

**Eventos canônicos R1:** `patient/created`, `patient/admission.updated`, `patient/location.planned`, `dietReference.updated`, `dietCatalog.updated`, `map.created`, `map.submitted`, `map.amended`, `meal.requested`, `meal.suspended`, `meal.production.started`, `meal.production.completed`, `meal.dispatched`, `meal.received`, `meal.delivered`, `nutritionAudit.opened`, `nutritionAudit.updated`, `nutritionAudit.closed`. Workers expandem eventos em seus próprios domínios sem modificar os eventos centrais.

## 4. Ciclos (America/Sao_Paulo)

| Ciclo | Refeições | Prazo de mapa | Tolerância principal |
|---|---|---|---|
| 06 | Café da manhã / lanche da manhã | 06:00 | 06:30 |
| 10 | Almoço / lanche da tarde | 10:00 | 10:30 |
| 16 | Jantar / ceia | 16:00 | 16:30 |

`classifyMealTiming({cycleId:'06',localDate:'2026-11-11',at:'2026-11-11T06:10:00-03:00'})` devolve `LATE_BEFORE_TOLERANCE`, `mapOnTime:false` e `recommendation:'KITCHEN_REVIEW'`. Após 06:30, 10:30 ou 16:30, a principal rotineira é recusada e o serviço orienta secundária ou escalonamento assistencial. Isso **não nega atendimento emergencial**: a exceção clínica exige fluxo institucional e deverá ser implementada/homologada pelos serviços assistenciais W3/W6, sem presumir autorização. Mapa das 06h pode ser antecipado no dia anterior.

## 5. Persistência e ambiente QA

**Escolha W0:** `node:sqlite` / SQLite local QA, usando `DatabaseSync` disponível em Node 22+ (CI Node 24). É um banco **arquivo local em pasta temporária**, não conectado a Firestore, Cloud Run, ERP ou dados reais. `new HospitalQAStore({filename:'/tmp/hospital-test.sqlite',qa:true})` só funciona fora de `NODE_ENV=production` e com arquivo dentro de `os.tmpdir()`. `:memory:` também funciona. Schema versão 1, índices por `(organization_id,kind,unit_id)`, FKs de membership, PKs, idempotência e triggers imutáveis são aplicados ao abrir a conexão. `PRAGMA user_version=1`; migrações de produção não são presumidas.

**Exemplo de handler (server-only):**

```ts
const store = new HospitalQAStore({filename:'/tmp/hospital-demo.sqlite',qa:true}); // QA exclusivamente
const handle = createHospitalCoreHandler({store});
const response = await handle({
  authorization: request.headers.get('authorization') ?? '',
  organizationId: 'om-hospital-qa', // rota autorizada; nunca confiar sem checagem
  operation: 'map.create',
  payload: {unitId:'uti-qa',localDate:'2026-11-11',cycleId:'06'},
});
// response.body = {ok:true,data:...} ou {ok:false,error:{code,message}}
```

Em produção, substituir o adapter QA por datastore hospitalar dedicado com service account/IAM separados, migrações e isolamento auditado; **não** apontar SQLite para volume produtivo nem replicar dados clínicos no Firestore operacional. O handler não deve ser registrado em `app/api` até W2/W3/W9 desenvolverem as rotas e a infraestrutura autorizada. HGeSM deve homologar o catálogo, protocolo de jejum/alergias, exceções e LGPD.

## 6. Testes reais e handoff

```bash
node --test tests/hospital/core/core.test.mjs
node scripts/hospital/core-test.mjs
npm run typecheck                    # exige node_modules da aplicação completa
npm run build                        # exige ambiente completo, poderá depender de configuração
```

Cobertura W0: 2 OMs / 2 unidades, vínculo individual e administrador comercial, token recusado, persistência por duas conexões SQLite, mapas e snapshots imutáveis, 3 ciclos 05:59/06:00/06:10/06:31 e equivalentes, idempotência e concorrência, ETag stale, jejum/alergias, Nutrição não bloqueante, transferência planejada/confirmada, `occurredAt` do servidor e handler real com erro tipado. Apenas fixtures sintéticas em arquivos de teste.

**Dependências de integração:** W2 constrói operações completas de paciente/leito/admissão; W3 institui telas e endpoints de dieta e mapas; W4–W5 integram etapas e etiquetagem; W6 completa fluxo institucional de revisão; W7 configura hospital/membership via API administrativa segregada; W8 usa eventos mínimos e W9 testa caminhos E2E. **GO** para integrar contratos/testes W0. **NO-GO** para qualquer uso clínico/produção antes de banco segregado definitivo, validação institucional e E2E.
