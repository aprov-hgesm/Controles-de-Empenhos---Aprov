# W10 — Firestore hospitalar operacional em QA isolado: Handoff R1

**Data:** 11/11/2026 | **PR Draft:** [#551](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/551) | **Destino da PR:** `feat/cozinha-dietetica-firebase-isolado-r1`  
**Base exata da PR #550:** `ec0e055bed10e60b764ed4aeb7450a37171c2d59`.  
**Branch de execução:** `feat/cozinha-dietetica-w10-firestore-operacional`.  
**Decisão:** **GO — integração e revisão técnica em QA com dados estritamente fictícios. NO-GO — deploy, integração no Firestore real e uso clínico** até credenciamento/IAM, homologação e autorização institucional.

## 1. Código entregue e efetivamente conectado

- **Persistência:** `lib/server/hospital/firebase/firestore-store.mjs` implementa repository assíncrono real sobre API REST do **Firestore Emulator**, com `beginTransaction`, leitura em transação, `commit` nativo, precondições de versão, retries de conflito e rollback. A store é limitada ao host loopback e ao projeto `demo-cozinha-dietetica`. Não há chave JSON, fallback para SQLite nem acesso ao Firebase/Firestore real no fluxo W10.
- **Identidade:** `core/auth.mjs` aguarda membership/organização armazenados no servidor. A instância Firebase do navegador permanece **nomeada e separada**; em QA aponta exclusivamente ao Auth Emulator `demo-cozinha-dietetica`. `firebase/verify-auth-emulator.mjs` confere projeto, claims, expiração e consulta ativa ao Auth Emulator para revogação/bloqueio. O verificador JWT do projeto hospitalar real, da PR #550, permanece separado e indisponível para tráfego clínico até infraestrutura autorizada.
- **W0 — domínio canônico:** `core/firestore-service.mjs` e `core/firestore-handler.mjs`, sem segundo ledger; contrato original W0/SQLite fica apenas como fixture de regressão.
- **W2 — Pacientes e internações:** `patients/firestore-service.mjs` e handler; identificador institucional único, internação ativa única, reserva de leito, movimentação prevista/confirmada e suspensão dos pedidos pendentes sem duplicação.
- **W3 — Dietas e mapas:** `diets/firestore-service.mjs`, `maps/firestore-service.mjs`, `maps/firestore-handler.mjs`; referência da prescrição médica, mapa manual das 06h/10h/16h, entrega fora do horário sem confundir prazo de envio e tolerância, adendos e snapshots imutáveis. `catalogRevision` bloqueia liberação de preparação com catálogo desatualizado.
- **W4 — Produção:** `production/firestore-service.mjs`; filas, lote, preparo, conclusão, reconciliação e reservas exclusivas de cada refeição em transação, inclusive corrida de dois cozinheiros.
- **W5 — Distribuição:** `distribution/firestore-service.mjs` e handler; montagem, etiqueta, conferência, expedição, recebimento e confirmação de entrega com dois identificadores; eventos distintos, sem presumir entrega após preparo.
- **W6 — Nutrição auditora:** `nutrition-audit/firestore-service.mjs` e handler; inconformidades, trilha auditável, comunicação médica efetivamente registrada e relatórios. Nutrição **não** se torna aprovadora de mapas rotineiros.
- **W7 — Administração hospitalar:** `administration/firestore-service.mjs` e handler; unidades/leitos, vínculos/revogação, política, contagens agregadas. Não faz leitura comercial de prontuários.
- **W8 — Relatórios:** `reporting/firestore-service.mjs` e handler; consultas por OM/unidade, filtros por até 31 dias, paginação limitada, versões/eventos da fonte canônica e exportações CSV/PDF protegidas; dados parciais são sinalizados, não completados artificialmente.
- **W9 — Interface:** mantém o shell e as telas integradas; os handlers usados pelas telas passam a selecionar os adapters Firestore **quando `HOSPITAL_FIRESTORE_QA_ENABLED=1`** e rejeitam erros sem fallback. Em produção, o módulo permanece fechado.

### 2. Matriz de rotas em W10 QA

| API | Firestore QA | Interface |
|---|---|---|
| `/api/hospital/patients` | W2 Firestore handler | Unidade: pacientes, leitos e movimentações |
| `/api/hospital/diets` | W3 Firestore handler | Dietas/prescrições de referência |
| `/api/hospital/maps` | W3 Firestore handler | Mapas manuais, adendos e acompanhamento |
| `/api/hospital/production` | W4 Firestore service | Cozinha, lotes e preparação |
| `/api/hospital/distribution` | W5 Firestore handler | Etiquetas, expedição e entrega |
| `/api/hospital/nutrition-audit` | W6 Firestore handler | Auditoria nutricional e comunicação médica |
| `/api/hospital/administration` | W7 Firestore handler | Administração hospitalar |
| `/api/hospital/reporting` | W8 Firestore handler | Relatórios e exportações |
| `/api/hospital/production/stream` | **SSE desligado** em W10 | `ProductionView` utiliza polling autenticado a cada 20 s; não relê SQLite |

**Não migrado para acesso GCP real:** nenhum handler é autorizado a utilizar o projeto `cozinha-dietetica` produtivo. O gateway IAM isolado da PR #550 continua sem liberação operacional, deliberadamente. Essa fronteira exige a etapa institucional descrita ao final; não representa fallback oculto.

## 3. Coleções e operações transacionais

```text
organizations/{om}/config/meta
organizations/{om}/memberships/{uid}
organizations/{om}/unitsDirectory/{unit}
organizations/{om}/recordPointers/{kind__id}
organizations/{om}/units/{unit}/records/{kind__id}
organizations/{om}/patientReferences/{sha256(ref)}
organizations/{om}/activeAdmissions/{patientId}
organizations/{om}/occupiedBeds/{sha256(unit|bed)}
organizations/{om}/mealKeys/{sha256(admission|date|cycle|type)}
organizations/{om}/batchMealKeys/{sha256(mealId)}
organizations/{om}/maps/{mapId}/versions/{version}  (create-only)
organizations/{om}/idempotency/{sha256(operation|key)}
organizations/{om}/events/{uuid}               (create-only)
organizations/{om}/units/{unit}/unitEvents/{uuid} (materialização de acesso)
organizations/{om}/units/{unit}/notices/{uuid} (avisos sem segundo ledger)
```

`get/list` resolve documento canônico pelo ponteiro de unidade e consulta limitada; `appendEvent` registra autor e tempo de registro do servidor separadamente de `effectiveAt` declarado. Snapshots originais não são sobrescritos. Rules `allow read, write: if false;` e índices em `firebase.hospital-w10-test.rules` e `firebase.hospital-w10-indexes.json` são **somente arquivos versionados**; nenhuma regra ou índice foi aplicado ao projeto real.

## 4. Testes efetivamente executados

**Execução de referência bem-sucedida:** [Hospital W10 Firestore Emulator QA — run #43062139639](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43062139639)  
**SHA da execução:** `3c88be5e9da79042d125ce8e930938e22e99ef3a` (commits de índice/handoff posteriores são documentais).

| Gate | Resultado comprovado |
|---|---|
| Firestore + Auth Emulator, projeto `demo-*` | **PASS** |
| Suíte W10 transacional + E2E W2–W8 | **PASS** (transações, concorrência, 06/10/16, entrega, Nutrição, relatório, transferência) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS**, sem credenciais hospitalares |
| `npm run test:pwa-installability` | **PASS**, raiz portal e aliases preservados |
| Firebase Auth / gateway original | **PASS** |
| Testes W0–W9 (SQLite fixture isolada) | **PASS** |
| `npm run verify:emprovex-core-protection` | **PASS** |
| Regressoes críticas do EMPROVEX financeiro/logístico | **PASS** |

Adicionalmente, [Core Protection](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43062152883) e [Fast CI](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43062152966) passaram para o SHA de referência. O teste ainda **não** representa uma sessão móvel física no hospital, IAM/GCP real, recuperação de desastre ou homologação clínica.

## 5. Dependências externas mínimas antes de pilotagem real (NÃO EXECUTADAS)

1. Autorizar institucionalmente ambiente de QA com dados sintéticos e, separadamente, eventual tratamento de dados sensíveis (LGPD), backup, retenção e contingência.
2. Criar identidade de serviço **exclusivamente hospitalar** no projeto GCP `cozinha-dietetica`, sem JSON key; restringir IAM ao Firestore hospitalar e impedir acesso por identidade EMPROVEX financeiro/Empresas.
3. Provisionar backend hospitalar isolado e privado no Cloud Run com essa service account; validar tokens Firebase reais, revogação e escopo das APIs e integrar o gateway real de forma explicitamente homologada.
4. Validar conectividade em ambiente autorizado, Rules negadas ao cliente, índices e contingência, com inspeção dos responsáveis clínicos antes de liberar pacientes reais.

**Proteção final:** `main`, Cloud Run, IAM/Rules do Firestore real, banco de Empresas/logístico, cobranças e pacientes reais **não foram tocados** por W10. A PR permanece **Draft**, sem merge e sem deploy.

**Parecer final deste handoff:** **GO — código e teste de integração Firestore em QA isolado. NO-GO — produção, Firestore real, pacientes reais ou implantação institucional.**
