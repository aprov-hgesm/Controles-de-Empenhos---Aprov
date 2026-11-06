# EMPROVEX Empresas — Handoff oficial W10 Etapa III
**Data:** 06/11/2026 • **Status:** PR Draft, QA isolado • **Sem merge, deploy ou emissão fiscal real**

## Proveniência e base imutável
- **Branch:** `integration/emprovex-empresas-w10-stage3-fiscal-multicnpj-20261106`
- **PR:** [#527](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/527), base `integration/emprovex-empresas-w10-stage2-20261106`.
- **W10-I:** PR #520, SHA `46af306ea67e2c5d45f8a2af922ef2781e154212`.
- **W10-II:** PR #525, HEAD de base `49c8670a66ad858724454eff0683696dcb7efcd3`.
- **W12:** PR #521, SHA `f6fe0743df07d34c5161de58e985e30857d2060e` — 10 blobs idênticos.
- **W13:** PR #522, SHA `d17c45d9e809332a9a396a20f12391ed5322bed6` — 5 blobs idênticos extraídos do descendente W14; importados só uma vez.
- **W14:** PR #526, SHA `9f188001741d8ecc6eae9b98162f0f8c6cc15003` — 6 blobs adicionais idênticos.
- **Checkpoint de código com transporte corrigido:** `bd87dea2484697b0a913e5c41f448cd1322059f0`. O SHA final da PR inclui este documento; consultar o HEAD da #527.
- **Memorial de origem:** PR #510, plano W10 Etapa III e Plano Multi-CNPJ W12–W15.
- **Sem edição das PRs de origem**, sem mudanças no login militar, Firestore Rules, Cloud Run, IAM, secrets ou `main`.

## Funcionalidades efetivas
1. Importação exata de 21 arquivos W12/W13/W14 via SHA de blob Git, sem duplicar WLG.
2. Novo `lib/server/companyProfiles/integration.ts`: sessão Firebase + W0 validada no servidor; descoberta adicional via índice privado `companyProfileUidLinks/{uid}`; revalidação LIVE da autorização, membership, workspace e índice CNPJ para cada ação no workspace selecionado. Retorno sempre por `companyId` isolado, sem usar CNPJ, email, cookie ou corpo como concessão de privilégio.
3. `GET /api/company/profiles`: perfil legado ou lista A/B verificada; `POST /api/company/profiles/select`: seleção HMAC com cookie `__Host-`, TTL 10 min, `HttpOnly`, `Secure`, `SameSite=Strict`, vínculo UID + auth_time + verificação por requisição. CSRF: token Bearer, `Origin` mesmo host e cabeçalho próprio. Alternância no portal com reload e invalidação de outras abas.
4. `POST /api/company/profiles`: **somente QA com Auth/Firestore Emulators demo-`*`** e flag `EMPROVEX_COMPANY_PROFILE_QA_REGISTRATION_ENABLED=1`; usa o mesmo Firebase UID, aprovação administrativa privilegiada em `companyRepresentationApprovals`, requisição idempotente, bloqueio exclusivo de workspace e CNPJ, owner binding, índice de descoberta e auditoria em commit atômico do Firestore. Não cria nova conta Auth e não altera `platformAccounts` ou `platformAuthUidIndex`. Indisponível em produção.
5. RBAC fiscal empresarial explícito: `fiscal:read/write/configure/approve/issue/download`; owner/admin com privilégios cadastrados, finance apenas read/write/download; operações sem autorização não adquirem privilégios.
6. `GET /api/company/fiscal/connections`: metadados WLG sanitizados, de um único workspace e CNPJ, sem token, `providerEmpresaId` ou referência de segredo. Configuração `POST/PUT/DELETE` permanece bloqueada.
7. Motor de emissão W14 integrado em import isolado, incluindo fiscalização de campos, estados e erros, **sem ligação com WLG real**; `/api/company/fiscal/nfe` permanece deliberadamente 503.
8. `createFiscalStore` e `createFiscalTransport`: documentos fiscais e numeração particionados por empresa, reserva/idempotência atômica, CAS com `updateTime`, auditoria, replay seguro e conflito de numeração. Emuladores locais apenas; uso real depende de flag, adapter de identidade privilegiada e aprovação de integração. REST usa resource names literais no corpo de commit e URLs escapadas no GET.

## Testes de regressão e evidência
- **Import puro, SHA `f3181c61834f22995c41d30495780e2487982a24`:** W10 (#42299698183) PASS; W12 (#42299698032) PASS; W14 (#42299697967) PASS; Fast CI (#42299698114) PASS; proteção do Core (#42299697934) PASS. **Estes resultados não certificam o checkpoint final.**
- **Falhas identificadas e corrigidas durante integração:** (a) harness W0 precisava reconhecer o guard selecionado em dois pontos; (b) asserção textual R1-Sync esperava nome legado; (c) autorização cross-tenant CAS precisava preceder validação de integridade; (d) inferência TypeScript dos adapters JS precisava JSDoc; (e) nomes de documento Firestore com `@` não podem ser percent-encoded no corpo JSON de commit.
- **Acrescentados na W10 CI:** W12 `profiles.test.mjs`, W13 `w13.test.mjs`, W14 `w14.test.mjs`, fiscal `store-emulator.test.mjs` e cadastro `qa-registration-emulator.test.mjs`. Firestore/Auth Emulators usam projeto `demo-emprovex-company-w10` e somente hosts de loopback.
- **Provas concretas previstas para homologação do último HEAD:** Node `npm run typecheck`; `npm run build`; W0/W3 Auth + Firestore; W10-II W9/W11; W12-W14 isolados; QA A/B com mesmo Firebase UID, verificação de índice legado, replay, revogação/status, CAS e preservação do Core.
- **Evidências do HEAD final:** consultar checks da PR #527 e registrar seu estado real antes de qualquer merge. Nenhum check pendente equivale a PASS.

## Travas e dependências (não ampliar produção por esta PR)
- **W15:** depende de backend W12/W13/W14 + homologação real multi-tenant; precisa certificar fluxos e UI end-to-end em perfil B, regressões W3/W9/W11 e segregação de memória/cache. W3 membership original é índice singular; convites cross-tenant não liberados.
- Aprovação jurídica da integração WLG para multiempresa/SaaS, verificação documental do representante legal, plataforma de secrets e confirmação dos contratos/provider `homologacao`/real.
- Persistência e validação oficial de chave de acesso NF-e, assinatura XML, protocolo de autorização SEFAZ, DANFE confiável, armazenamento privado W5, comprovante e reconciliação. O motor W14 não demonstra emissão real.
- Fluxo de segunda empresa nesta Etapa III **QA-only** e não considerado pronto para produção. Condição de não-escalada: `EMPROVEX_E2E_SERVER_AUTH=1`, projeto `demo-*`, hosts Auth `127.0.0.1:9099` e Firestore `127.0.0.1:8080`, `NODE_ENV != production`, sem `K_SERVICE` ou `VERCEL`.
- Controle de concorrência de revogação/representação ainda exige homologação transacional final antes de migrar a produção. Nunca habilitar emissão real/segundo CNPJ por mera alteração de variável de ambiente.

## Handoff / parecer
- **GO técnico condicional** para continuar QA em branch isolada com testes comprovadamente verdes no HEAD da PR #527.
- **NO-GO** para merge em `main`, deploy Cloud Run, piloto externo, liberação comercial, segundo CNPJ real, conexão WLG ativa ou emissão NF-e real até completar bloqueios e evidências do W15.
- **Rollback:** descartar PR #527/branch; a `main` e serviços implantados nunca foram alterados. Não há migração ou escrita em dados produtivos por esta atividade.
