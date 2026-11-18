# W02 — Pacientes, internações, leitos e movimentações | Handoff R1

**Base fixa W0:** `4bcfee7730fc0da3177d9af8a81eabeb7f844abb` (PR #540).  
**Escopo:** exclusivamente `features/hospital/patients/**`, `lib/server/hospital/patients/**`, `app/api/hospital/patients/**`, `tests/hospital/patients/**`. Sem merge, deploy nem pacientes reais.

## Código integrável

- Backend: `new HospitalPatientsService(store: HospitalQAStore)` em `lib/server/hospital/patients/service.mjs`.
- Handler seguro: `createHospitalPatientsHandler({store,verifyToken?})`, que resolve o `HospitalScope` W0 por token Firebase verificado, membership, OM/UG, papel e unidade. `verifyToken` somente é injetável em testes no servidor.
- UI: `import {PatientsView} from '@/features/hospital/patients/PatientsView'` com `organizationId`, `unitId` e `getIdToken:()=>Promise<string>`; W9 fornece token via identidade autenticada. Componente não possui login próprio, nem grava dados de pacientes em localStorage.
- Route Next: `GET/POST /api/hospital/patients`. Só funciona com `HOSPITAL_PATIENTS_QA_ENABLED=1` e `HOSPITAL_PATIENTS_QA_DB_PATH=/tmp/...sqlite`, com `NODE_ENV!=production`. Exige `Authorization: Bearer <firebaseIdToken>` e `x-hospital-organization-id`; o header de OM é **apenas seletor**, revalidado no backend contra o membership. Nenhuma rota disponibiliza seed de pacientes.
- O próprio W0 é o repositório único de `patient`, `admission`, `bed`, `location_event`, `meal` e `medical_reference`; não se criou segundo registro, tabela de pacientes ou journal paralelo. Índice SQLite QA de referência institucional única por OM; `revision` como ETag.

## Comandos

Payloads são enviados como `{"operation":"...", "payload":{"unitId":"uti", ...}}` com ids institucionais sintéticos no QA.

| Comando | Payload complementar |
| --- | --- |
| `patient.register` | `referenceCode`, `displayName` (opcional `patientId` QA) |
| `patient.update` | `patientId`, `displayName`, `expectedRevision` |
| `patient.get` | `patientId` |
| `patient.search` | `q`, `status:ACTIVE\|DISCHARGED\|ALL`, `limit:1..50`, `offset` |
| `bed.save` | `bedId`, `label`, `active`, `expectedRevision` (HOSPITAL_ADMIN) |
| `bed.list` | lista e ocupação real |
| `admission.admit` | `patientId`, `bedId?`, `admissionId?`; episódio novo distinto da pessoa |
| `admission.get` | `admissionId` com `medicalReferenceId`, não prescrição inventada |
| `admission.changeBed` | `admissionId`, `toBedId?`, `expectedRevision` |
| `admission.planTransfer` | `admissionId`, `toUnitId`, `toBedId?`, `eventId?`, `effectiveAt?` |
| `admission.cancelTransfer` | `eventId`, `expectedRevision` |
| `admission.confirmTransfer` | `eventId`, `expectedRevision`, `admissionRevision`; exige vínculo nas **duas** unidades |
| `admission.temporaryDeparture` | `admissionId`, `toUnitId`, `expectedRevision` |
| `admission.temporaryReturn` | `admissionId`, `expectedRevision` |
| `admission.planDischarge` | `admissionId`, `plannedAt` ISO, `expectedRevision` |
| `admission.cancelDischarge` | `admissionId`, `expectedRevision` |
| `admission.confirmDischarge` | `admissionId`, `expectedRevision`; desfechos especiais ainda **não habilitados** |
| `admission.history` | `admissionId`; eventos imutáveis e sem nome no payload |
| `admission.notices` | `limit`; projeção limitada dos eventos para origem/destino/cozinha |

## Contratos para outros workers

- **W3:** `admission.medicalReferenceId` é **identificador** da referência clínica vigente W0; W2 nunca prescreve nem altera dieta. Na transferência confirmada, a referência `medical_reference` é movida junto com a internação, sem mudar `sourceRef`/prescrição. Refeições pendentes mantêm a mesma chave de unicidade W0 `meal_keys`, mudam de unidade e ficam `SUSPENDED`. **Pendente W3/W9:** definir desbloqueio/reconciliação de refeição no destino com mapa distinto; não gerar segundo pedido para o mesmo episódio/ciclo. Não editar W0 silenciosamente.
- **W5:** consultar `admission.unitId`, `bedId` e eventos `patient/admission.updated` antes de etiquetar/distribuir; transferência após expedição exige coordenação humana e caso específico no W5.
- **W8:** `admission.history` e `admission.notices` projetam journal W0; autor, `occurredAt`, `effectiveAt`, e IDs, sem dados clínicos em logs. Avisos são projeção de evento, **não** uma segunda fila global.
- **W9:** compor `PatientsView` no shell autorizado. A interface não tenta buscar/editar prescrição médica; mostra estado de integração W3/ausência. Para uso real, exige storage hospitalar segregado, inicialização segura do Firebase Admin, unidade institucional configurada e homologação. Não ativar endpoint QA em produção.

## Operações e ressalvas

- Transferência prevista e alta prevista **não** mudam localização efetiva ou cancelam refeições; confirmação é transacional e verifica ocupação.
- Entrada temporária em Bloco mantém o leito e unidade assistencial de origem; registra apenas presença temporária. O cadastro de unidades e sua autorização definitiva será integrado por W7/W9.
- Alta confirmada libera o leito por status e suspende refeições pendentes, preservando todo histórico.
- Por política W0, leitura clínica é limitada à unidade do registro vigente; acesso cross-OM é `404` e cross-unit sem papel é `403`. Identificador/nomes de pacientes não aparecem no journal.
- A unicidade institucional usa o código exato normalizado em maiúsculas; **não há deduplicação probabilística por nome**, pois homônimos devem permanecer distintos.
- QA SQLite não é arquitetura de produção: sem deploy, sem prontuários reais, sem dados de saúde reais.

## Testes a executar

```bash
node --test tests/hospital/patients/patients.test.mjs
node --test tests/hospital/core/core.test.mjs
npm run typecheck
npm run build
```

Critério de integração: testes reais da branch aprovados; para uso hospitalar real, **NO-GO** até datastore clínico segregado, protocolo institucional, segurança LGPD e E2E W9.
