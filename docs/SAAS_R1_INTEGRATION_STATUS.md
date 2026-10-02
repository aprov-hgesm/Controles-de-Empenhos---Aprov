# EMPROVEX SaaS R1 — Integration Status

Última atualização: **2026-10-01**
Produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Integrador: `feat/saas-r1-commercializacao`
Estado global: **SAAS-A CONGELADA / SAAS-B + SAAS-C + SAAS-DL + SAAS-E INTEGRADAS / ONDA 1 CONCLUÍDA / SAAS-DS LIBERADA**

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
| SAAS-DS Segurança/enforcement | `saas-r1-ds-security-enforcement` | B + C | **LIBERADA** | próxima frente; branch deve partir do fechamento atual da integradora |
| SAAS-I Integração | integradora | B+C+DL+E+DS | **AGUARDANDO** | — |
| SAAS-P Piloto | integradora | I | **AGUARDANDO** | — |
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
7. SAAS-E integrou o tooling de backup nativo para os dois bancos; a ativação externa e a prova de restore real ainda são pendências.
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
- criar/ativar SAAS-DS a partir do HEAD atual da integradora;
- implementar suspensão/reativação server-side e revogação de sessões sem adicionar billing a cada Rule;
- depois da SAAS-DS, executar SAAS-I;
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
- restore real/backup READY/uptime real: **PENDENTES DE CONFIGURAÇÃO EXTERNA**.

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

## 8. Estado de produção

Nenhuma alteração do SaaS R1 está em `main`.

Nenhum deploy de produção do SaaS R1 está autorizado implicitamente.

A branch integradora pode receber documentação e código de workers, mas promoção para produção depende de SAAS-J e autorização explícita do usuário.
