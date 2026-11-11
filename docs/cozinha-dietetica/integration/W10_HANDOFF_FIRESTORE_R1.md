# W10 — Firestore operacional hospitalar: handoff incremental e gate de segurança

**Data:** 11/11/2026 · **Origem imutável:** PR #550 em `ec0e055bed10e60b764ed4aeb7450a37171c2d59`
**Branch:** `feat/cozinha-dietetica-w10-firestore-operacional`
**Alvo:** `feat/cozinha-dietetica-firebase-isolado-r1` (PR #550)
**Parecer:** **NO-GO** para integrar todas as operações hospitalares, para merge, deploy ou pacientes reais.

## O que está realmente implementado

- `lib/server/hospital/firebase/firestore-store.mjs`: repositório **assíncrono** Firestore REST, **exclusivo do emulador local** `demo-cozinha-dietetica`, com transação nativa `beginTransaction → batchGet/runQuery → commit`; leitura com escopo OM/unidade, CAS por revisão, ponteiro de unidade, transferência de registro, chave única de refeição, idempotência, versões imutáveis e journal de eventos create-only. Falha fechada com conexão/projeto divergente, sem fallback.
- `lib/server/hospital/core/auth.mjs`: lookup do vínculo hospitalar e da organização agora aguarda Promises; mantém compatibilidade com a store síncrona anterior, sem confiar em roles do HTTP.
- `firebase.hospital-w10-test.json`, `firebase.hospital-w10-test.rules`, `firebase.hospital-w10-indexes.json`: emuladores Auth/Firestore, **Rules negando SDK cliente**, índice de eventos versionado para QA. NÃO alterados no projeto real.
- `tests/hospital/firebase/firestore-store-emulator.test.mjs`: teste de emulador com usuários e pacientes fictícios, transação/rollback, concorrência, unicidade, auditoria, isolamento OM/unidade, tokens rejeitados e regras SDK cliente. Execução de CI em `.github/workflows/hospital-w10-firestore-qa.yml`. **Não considerar PASS antes de consultar a execução.**
- `app/manifest.ts` e `scripts/pwa-installability.test.mjs`: `start_url: '/'` e contrato de portal `/portal`, vitrine `/info`, aliases e caminhos operacionais; verificações de segurança e cache legadas preservadas.

## Cobertura real de rotas (importante)

**NENHUMA rota hospitalar W0–W9 foi migrada integralmente** para esta store Firestore. Permanecem com SQLite de QA: `/api/hospital/patients`, `/api/hospital/maps`, `/api/hospital/diets`, `/api/hospital/production`, `/api/hospital/distribution`, `/api/hospital/nutrition-audit`, `/api/hospital/administration`, `/api/hospital/reporting`, e composição da UI. O gateway da PR #550 também permanece desconectado dos handlers clínicos. **Não habilitar simultaneamente sistemas clínicos de persistência distintos**: o módulo real continua bloqueado.

A migração completa exige remover SQL direto e chamadas síncronas presentes em serviços de pacientes, dietas, mapas, administração, auditoria nutricional, relatórios e transferência; converter **cada operação crítica** para `async/await` e transações nativas; revalidar todas as APIs, UI e exportações. **Ainda não está feito.** Não rotular esta PR como entrega final do W10.

## Modelo de coleções implementado no emulador

```text
organizations/{OM}/config/meta                — hospital/UG ativa
organizations/{OM}/memberships/{uid}          — papel, unidade, vínculo
organizations/{OM}/recordPointers/{kind__id}  — localizador canônico por unidade
organizations/{OM}/units/{unit}/records/{kind__id} — documento e revision
organizations/{OM}/maps/{mapId}/versions/{version} — snapshots create-only
organizations/{OM}/mealKeys/{sha256}           — reserva única create-only
organizations/{OM}/idempotency/{sha256}        — resposta idempotente create-only
organizations/{OM}/events/{uuid}               — journal create-only, timestamp do servidor
```

Consultas `list` restringem OM/unidade/kind; `events` restringe OM/tipo/agregado. Proteção adicional por UID e permissão exige passar pelo `resolveHospitalScope` + `requireHospitalPermission`; o storage sozinho **não** substitui guarda HTTP. Índices são arquivo local do emulador, sem aplicação no Firestore real.

## QA, infraestrutura e pendências externas

- **Workflow isolado:** [Hospital W10 Firestore Emulator QA](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/workflows/hospital-w10-firestore-qa.yml). Gates: Node 24, Java 21, `npm ci`, typecheck, build, PWA, testes Firebase/Emulator, regressões W0–W9, Core Protection, núcleo. Conferir resultados reais; falhas são NO-GO.
- **IAM de produção não é necessário para QA**: a store só aceita host loopback e projeto `demo-cozinha-dietetica`; não há chave JSON ou conta real.
- Para conectar a infraestrutura Google Cloud de hospital em etapa futura, e **somente após homologar código QA e autorização institucional**, será preciso: (1) identidade de serviço exclusiva no projeto `cozinha-dietetica`; (2) IAM de mínimo privilégio no Firestore hospitalar; (3) runtime hospitalar isolado do backend financeiro com revogação de sessão; (4) homologação institucional de dados sensíveis, backup e contingência. Não executar agora.

**Invariantes:** sem pacientes reais, sem gravar Firebase real, sem mudar Rules/IAM produtivos, sem Cloud Run, sem deploy, sem merge e sem alterações na `main`. As suites antigas W0–W9 permanecem fixtures QA SQLite, não prova de migração.

**Decisão:** NO-GO para afirmar que Firestore está operacionalmente integrado às telas e às APIs; NO-GO para o uso clínico. Revisão do código de infraestrutura e do PWA pode prosseguir, condicionada à avaliação dos testes reais.
