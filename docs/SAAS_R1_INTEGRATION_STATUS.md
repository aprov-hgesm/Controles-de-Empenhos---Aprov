# EMPROVEX SaaS R1 — Integration Status

Última atualização: **2026-10-02**
Produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Integrador: `feat/saas-r1-commercializacao`
Estado global: **SAAS-A + B + C + DL + E + DS + I INTEGRADAS / CANDIDATO R1 COMBINADO CERTIFICADO / SAAS-P EM EXECUÇÃO**

## 1. Baseline

- Performance R3: publicada.
- Vercel produção: release R3 publicada.
- `firestore.warehouse.rules`: publicada após a R3.
- Billing Bloco 22: existente em modo OBSERVE.
- Provisionamento multi-tenant: existente.
- Termos/Privacidade: públicos.
- Backup/Monitoring: existentes, com lacunas de R1 registradas no Plano Mestre.

## 2. Quadro vivo

| Frente | Branch | Dependência | Estado | Integração |
| --- | --- | --- | --- | --- |
| SAAS-A Fundação/contratos | integradora | R3 | **CONGELADA** | documentação canônica |
| SAAS-B Billing/pagamento | `saas-r1-b-billing-payment` | A | **CONCLUÍDA** | **INTEGRADA — PR #216 / `f91cda645...`** |
| SAAS-C Onboarding | `saas-r1-c-onboarding` | A | **CONCLUÍDA** | **INTEGRADA SEMANTICAMENTE — `cf320ce3...`; PRs #213/#217 fechados sem merge** |
| SAAS-DL Legal/aceite | `saas-r1-dl-legal-acceptance` | A | **CONCLUÍDA** | **INTEGRADA SEMANTICAMENTE — `733885c1...`; PR #214 fechado sem merge** |
| SAAS-E Operação/recovery | `saas-r1-e-ops-recovery` | A | **CONCLUÍDA** | **INTEGRADA — PR #215 / `82f2e643...`** |
| SAAS-DS Segurança/enforcement | `saas-r1-ds-security-enforcement` | B + C | **CONCLUÍDA** | **INTEGRADA — PR #218 / `726436ac...`** |
| SAAS-I Integração | `saas-r1-i-integration` → integradora | B+C+DL+E+DS | **CONCLUÍDA** | **INTEGRADA — PR #219 / `25dda487...`** |
| SAAS-P Piloto | integradora | I | **EM EXECUÇÃO** | P2 concluída; P3 recovery configurado e aguardando backup READY/restore/uptime; sem publicação automática |
| SAAS-J Certificação | integradora | P | **AGUARDANDO** | — |

## 3. Contratos congelados

Não alterar em worker:
- **R$ 70/mês — Plano Completo**;
- 30 dias de trial;
- 5º dia útil;
- 10 dias de tolerância;
- cobrança externa simples;
- confirmação administrativa;
- suspensão manual;
- nenhum delete por inadimplência;
- founder exempt;
- VIP externo = `exempt`, sem cobrança e com acesso completo;
- sem public signup;
- sem auto-suspensão;
- sem webhook/API de pagamento;
- sem tiers ou módulos pagos separadamente;
- 1 workspace ↔ 1 UG ↔ 1 conta externa primária;
- aceite legal versionado;
- backup nativo dos dois bancos antes da abertura.

## 4. Achados de baseline que orientam a execução

1. `billingAccounts` já é fonte de verdade comercial; não criar coleção concorrente.
2. SAAS-B já migrou o default para R$ 70,00 e preservou competências históricas materializadas.
3. `exempt` já é o contrato integrado para VIP externo e fundador, evitando novo status de domínio.
4. `platformAccess` não lê billing e isso é desejável para custo/isolamento.
5. Rules operacionais já exigem workspace e conta ativos; enforcement deve reutilizar esse contrato.
6. SAAS-C integrou onboarding/credenciais preservando provisionamento, UID/e-mail/workspace/UG e sessões; B+C agora satisfazem a dependência da SAAS-DS.
7. SAAS-E integrou o tooling de backup nativo; em 2026-10-02 PITR, delete protection e schedules diários foram ativados nos dois bancos. Permanecem pendentes backup READY, restore real isolado e certificação de uptime/alertas.
8. O backup lógico atual continua não cobrindo `emprovex-warehouse`; a Central depende do backup nativo para recuperação global.
9. SAAS-DL integrou Termos/Privacidade comerciais e aceite legal versionado; falta apenas conectar o `LegalAcceptanceGate` ao shell depois da SAAS-C.
10. O health/uptime foi preparado; o uptime check real no Cloud Monitoring ainda precisa ser criado e validado.

## 5. Infraestrutura e migrações

Neste momento:
- novo banco Firestore para SaaS/billing/legal: **NÃO** — manter no banco principal;
- `emprovex-warehouse` permanece como banco separado da Central;
- nova base de dados adicional: somente com nova decisão arquitetural baseada em necessidade objetiva;
- troca de Firebase: **não**;
- troca de Vercel: **não**;
- novo provedor de autenticação: **não**;
- Mercado Pago API/webhook: **não**;
- Rules novas: somente se cada frente provar necessidade;
- Indexes novos: somente mediante query real;
- variáveis de ambiente novas: somente públicas/operacionais estritamente necessárias.

## 6. Ação atual do Coordenador

A Onda 1 foi autorizada pelo usuário em 2026-10-01.

O Coordenador deve:
- manter B, C, DL e E paralelas e independentes;
- receber e validar cada handoff;
- atualizar este quadro a cada worker concluída;
- integrar somente após revisão semântica;
- impedir que uma worker resolva conflitos alterando domínio de outra;
- manter SAAS-DS bloqueada até B e C estarem semanticamente integradas.

SAAS-B, SAAS-C, SAAS-DL e SAAS-E já foram recebidas, auditadas e integradas. A Onda 1 está concluída.

Próximo gate:
- executar **SAAS-P — Piloto controlado** sobre a integradora já consolidada;
- registrar evidência real de onboarding, trial, pagamento de workspace não legado, suspensão/reativação e aceite;
- manter backup/restore/uptime reais como pendências de certificação antes de SAAS-J;
- tratar correções do piloto em branches curtas e escopo próprio;
- antes de qualquer correção transversal em Auth/legal/lifecycle/sessão/Rules/Central, sincronizar semanticamente com a integradora MOBILE-R1;
- manter as configurações externas da SAAS-E como gates obrigatórios de operação/certificação, sem confundi-las com merge de código.

## 7. Registro de integrações

### SAAS-B — integrada em 2026-10-01

- worker: `saas-r1-b-billing-payment`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- worker HEAD: `7e288e79e1514f91c9f0099392302ec7efd5cefe`;
- PR: #216;
- integração squash: `f91cda64582cc148bac340086be56163d366dd35`;
- Application CI #886: SUCCESS;
- Core Protection #173: SUCCESS;
- Recovery #573: SUCCESS;
- build/typecheck/diff hygiene: PASS;
- segurança multi-tenant: PASS;
- Vercel preview: falha externa `build-rate-limit`, não bloqueante para integração;
- enforcement: deliberadamente não ativado;
- ajuste do Coordenador: rótulo do fundador diferenciado de VIP no cabeçalho.

A integração não foi promovida para `main` nem para produção.

### SAAS-E — integrada em 2026-10-01

- worker: `saas-r1-e-ops-recovery`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional: `e650191a52656347b45c2769f1d93be9d21b2eac`;
- HEAD final após correção de whitespace: `8fb8e3ff3cd61bbc090a6a180528758930fdbd0f`;
- PR: #215;
- integração squash: `82f2e6432b979634cae8023a773e31efa8f0cd65`;
- Application CI #896: SUCCESS;
- Core Protection #183: SUCCESS;
- Recovery #583: SUCCESS;
- build/typecheck/diff hygiene: PASS;
- health endpoint: integrado;
- backup/recovery tooling para os dois bancos: integrado;
- restore real/backup READY/uptime real: **PENDENTES**; PITR/delete protection/schedules já estão ativos nos dois bancos.

A integração não foi promovida para `main` nem para produção.

### SAAS-DL — integrada semanticamente em 2026-10-01

- worker: `saas-r1-dl-legal-acceptance`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional: `4806adfb35d4bad29f32695ae6a9de327fe1f40d`;
- HEAD final: `b460d1a41ca63c9e14b0c7004bbedfe4954fb633`;
- PR #214 fechado sem merge automático devido a conflitos esperados com B/E já integradas;
- integração semântica do Coordenador: `733885c1729d43623058b2dcfe4bea82f4eacabe`;
- Application CI #892: SUCCESS;
- SAAS-DL Legal #8: SUCCESS;
- Core Protection #179: SUCCESS;
- Recovery #579: SUCCESS;
- Rules do aceite + package scripts reconciliados preservando B/E;
- `LegalAcceptanceGate`: **AINDA NÃO CONECTADO AO SHELL**;
- deploy de Rules legais: **NÃO EXECUTADO**.

A integração não foi promovida para `main` nem para produção.

### SAAS-C — integrada semanticamente em 2026-10-01

- worker: `saas-r1-c-onboarding`;
- base: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`;
- HEAD funcional: `524432969c0bc07acdbce9539830e703a8374226`;
- teardown E2E: `8c7fc09912b7b01208fda9f5c0b3be848641e0c4`;
- HEAD final/handoff: `8bd5f38ce31073bd01b43e05fb46c103a9fe696d`;
- PR #213 e PR técnico #217 fechados sem merge;
- integração coordenadora: `cf320ce33f8bb9e667cf0eb59fcf456214109ed3`;
- Application CI #894: SUCCESS;
- Core Protection #181: SUCCESS;
- Recovery #581: SUCCESS;
- build/typecheck/diff hygiene e release gates 16–21: PASS;
- Browser assertions: **3/3 PASS**;
- workflow Browser: `cancelled` somente no teardown pós-`3 passed`; não registrar como workflow verde;
- onboarding/reset/troca de senha/checklist: integrados;
- Rules/Indexes/env/banco: sem mudança;
- enforcement: não implementado.

A integração não foi promovida para `main` nem para produção.

### SAAS-DS — integrada em 2026-10-02

- worker: `saas-r1-ds-security-enforcement`;
- base: `73c22a441249cd87b6d6e1dfeb69bcb005d663e9`;
- HEAD funcional: `476efffaf60e5276e6d68ac9c2a425848b9fff66`;
- HEAD final: `073b96886d54b33e7e188265eb1e53672fbd9b1c`;
- PR #218;
- squash: `726436ac9db13eb5e0195cc33ac432005f3f113a`;
- Application CI #901: SUCCESS;
- Core Protection #188: SUCCESS;
- Recovery #588: SUCCESS;
- SAAS-DL Legal #13: SUCCESS;
- Firestore multi-tenant + Central external security: PASS;
- endpoint lifecycle founder-only: integrado;
- revogação de sessões: integrada;
- `warehouseAccess`: integrado;
- billing continua desacoplado;
- Rules da Central: **NÃO PUBLICADAS**;
- produção: **NÃO ALTERADA**.

## 8. Estado de produção

Nenhuma alteração do SaaS R1 está em `main`.

Nenhum deploy de produção do SaaS R1 está autorizado implicitamente.

A branch integradora pode receber documentação e código de workers, mas promoção para produção depende de SAAS-J e autorização explícita do usuário.

### SAAS-I — candidata em validação em 2026-10-02

- branch técnica: `saas-r1-i-integration`;
- base exata: `71ed87932f17b8acd9fab9c30006970b59079c42`;
- PR técnico: **#219**, draft, base `feat/saas-r1-commercializacao`;
- HEAD funcional pré-documentação: `f840af0bffbd24dbe56c4de9f3a05334e68a2b7f`;
- LegalAcceptanceGate: conectado ao shell principal e à Central;
- listeners operacionais: bloqueados até aceite vigente;
- páginas públicas/reset: preservados fora do gate;
- billing x enforcement: desacoplamento preservado;
- VIP legado: metadata/proteção + migração segura implementadas;
- guard `verify:saas-r1-integration`: incorporado ao Application CI;
- Rules principal: ~92,11 KiB;
- Rules Central: ~152,38 KiB;
- produção/main/Rules/migração: **NÃO ALTERADAS**.

A quantidade de candidatos VIP legado permanece dependente de inventário autenticado do Firestore. `apply` exige allowlist explícita e não será executado pela SAAS-I.

Handoff: `docs/SAAS_R1_I_INTEGRATION_HANDOFF.md`.


## 16. Integração SAAS-I

A SAAS-I foi auditada pelo Coordenador e integrada.

Evidências:
- base `71ed87932f17b8acd9fab9c30006970b59079c42`;
- HEAD final `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`;
- PR #219 clean/mergeable;
- squash `25dda4876fedabb498ad30139262b11943412273`;
- Application CI #908, Core Protection #195, Recovery #595 e Legal #20: SUCCESS;
- build, TypeScript, Diff Hygiene, multi-tenant, Central external security e gates 16–21: PASS.

Contratos combinados agora canônicos:
- legal gate integrado sem bloquear páginas públicas/reset/regularização;
- subscriptions operacionais aguardam aceite vigente;
- billing continua desacoplado do lifecycle;
- VIP legado possui metadata e proteção imutável;
- migração VIP é allowlist-only, idempotente e auditável;
- nenhum billing histórico é reprecificado;
- Central continua com `warehouseAccess`;
- nenhum terceiro banco.

Não executado:
- main;
- deploy Vercel produção;
- deploy de Rules;
- migração VIP produtiva;
- configuração externa SAAS-E.

Próxima etapa: **SAAS-P — Piloto controlado**.


## 17. Desenvolvimento paralelo — MOBILE-R1

Programa paralelo ativo:
- integradora Mobile: `feat/central-mobile-r1`;
- baseline funcional original: SAAS-I certificada `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`;
- a história Git pode divergir da integradora SaaS por causa do squash da SAAS-I e dos commits documentais posteriores.

Regra do Coordenador:
- comparar semanticamente, não por ancestralidade apenas;
- consultar `CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md` e `CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md` antes de qualquer mudança SaaS transversal;
- exigir seção **Impacto MOBILE-R1** em correções que toquem Auth, workspace/UG, sessão/lease, legal gate, lifecycle, `warehouseAccess`, Rules, shell ou contratos comuns da Central;
- não bloquear SAAS-P por existência do Mobile; bloquear somente conflito concreto;
- reconciliar obrigatoriamente os dois programas antes de SAAS-J.

## 18. SAAS-P — abertura e auditoria P0

A SAAS-P foi formalmente iniciada em 2026-10-02.

Snapshot auditado:
- integradora SaaS no início da SAAS-P: `f8fc2b60ef67f882c3f2c36099b372f16792ee11`;
- `main`: `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- PR #219: **MERGED**;
- SAAS-I: Application CI, Core Protection, Recovery e Legal Validation **SUCCESS**; Browser SAAS-C **skipped por escopo**;
- plano/matriz operacional criado em `docs/SAAS_R1_P_PILOTO_CONTROLADO.md`.

MOBILE-R1 no snapshot:
- integradora `feat/central-mobile-r1@2d3d82d0...`;
- apenas deltas documentais integrados após o baseline SAAS-I;
- MOBILE-A PR #221 e MOBILE-B PR #220 já abertos em draft e ainda não integrados;
- portanto, não há conflito funcional integrado SaaS ↔ Mobile neste momento.

Pendências imediatas da SAAS-P:
1. inventário autenticado da coorte VIP legado;
2. seleção de 3–5 participantes reais;
3. baseline de custos;
4. auditoria/ativação externa de backup, PITR, delete protection e uptime;
5. definição de janela controlada de publicação para o piloto real;
6. preenchimento da matriz J01–J24.

Nenhuma ação produtiva foi autorizada por esta abertura.

## 19. SAAS-P — P2/P3 e PILOT-OPS — 2026-10-02

P2 avançou com inventário autenticado real:

- 3 candidatos VIP legado;
- 0 não resolvidos;
- founder `hgesm-aprov` excluído;
- allowlist humanamente congelada: `aprovisionamento-2-b-fv`, `aprovisionamento-3-gac-ap`, `aprovisionamento-teste`;
- `aprovisionamento-teste` foi confirmado como VIP legado permanente e perfil real de teste funcional externo;
- futuro perfil não-VIP para trial/cobrança fica adiado para etapa posterior do piloto;
- `apply` produtivo **não executado**.

P3 confirmou estado externo ainda não certificado:

- banco principal: sem PITR, sem delete protection, sem agenda diária, sem backup READY;
- `emprovex-warehouse`: delete protection ativa; sem PITR, sem agenda diária e sem backup READY;
- nenhum backup concluído/READY foi encontrado nos dois bancos.

Correção operacional Windows:

- PR #222 — `saas-p-fix-ops-windows-gcloud`;
- Application CI, Core Protection, Recovery e Legal: SUCCESS;
- integração squash: `ea2d389f726ae989ae88f7fc7359c690b23dfb13`;
- nenhum delta em Rules, schema, billing, lifecycle, Auth ou Mobile.

Próximos passos seguros:

1. executar `dry-run` da allowlist VIP congelada;
2. manter `apply` bloqueado até autorização explícita;
3. preparar/validar os controles externos de recovery antes da certificação final;
4. preservar a exigência de um workspace novo não-VIP para provar cobrança no piloto.

Dry-run da coorte VIP legado concluído com sucesso:

- `aprovisionamento-2-b-fv`: selecionado;
- `aprovisionamento-3-gac-ap`: selecionado;
- `aprovisionamento-teste`: selecionado;
- 0 não resolvidos;
- nenhuma escrita executada.

P2 está pronta para `apply` produtivo, que depende de autorização explícita.

### SAAS-P — P2 concluída

Migração produtiva VIP legado executada e verificada em 2026-10-02:

- `aprovisionamento-2-b-fv`: APPLIED / READY;
- `aprovisionamento-3-gac-ap`: APPLIED / READY;
- `aprovisionamento-teste`: APPLIED / READY.

Estado final da coorte:

- `status = exempt`;
- `monthlyPriceCents = 0`;
- `paymentRequired = false`;
- `exemptionSource = legacy_vip`;
- `legacyVipCutoff = 2026-10-02`.

P2: **CONCLUÍDA**.

Próximo eixo ativo da SAAS-P: P3 — controles externos de recovery/backup/uptime.

### SAAS-P — P3 controles nativos aplicados

Após autorização explícita, ambos os bancos ficaram com:

- PITR ativo;
- delete protection ativa;
- backup diário configurado;
- retenção de 14 semanas.

Estado atual:
- banco principal: `backupReady=false`, 0 backups concluídos;
- `emprovex-warehouse`: `backupReady=false`, 0 backups concluídos;
- certificação global de recovery ainda `ready=false`.

Próxima evidência obrigatória: aguardar pelo menos um backup READY em cada banco e executar `npm run recovery:verify`. Depois, validar restore real em banco isolado.

### Política temporária de Vercel durante desenvolvimento — 2026-10-02

Decisão operacional: enquanto o EMPROVEX permanecer em desenvolvimento ativo e não houver intenção de publicar mudanças em produção, falhas de Preview da Vercel causadas exclusivamente por `build-rate-limit` não bloqueiam o andamento das branches/PRs.

Regras:
- não interpretar `build-rate-limit` como regressão funcional;
- priorizar gates GitHub/CI, testes locais e validações de domínio;
- não promover alterações para `main` nem produção sem autorização explícita;
- consolidar deploys quando houver uma janela real de publicação, evitando consumo desnecessário de builds durante o desenvolvimento.

## 20. Conferência corrente — SAAS-P / Mobile / Health — 2026-10-02

- P2 VIP legado: **CONCLUÍDA / 3 de 3 READY**.
- P3: PITR, delete protection e schedules diários ativos; aguardando backup READY, restore isolado e uptime real.
- PR #223 `saas-p-ops-health-endpoint`: draft, mergeable, Application CI/Core Protection/Recovery **SUCCESS**; sem merge/deploy.
- Vercel Preview `build-rate-limit`: não bloqueante durante desenvolvimento.
- Mobile: PR #220/MOBILE-B **MERGED**; PR #221/MOBILE-A aberto/draft, mergeable, HEAD `44c4f013...`, gates principais verdes.
- Antes de SAAS-J: reconciliar novamente a integradora Mobile viva e concluir evidências do piloto/recovery/uptime.
