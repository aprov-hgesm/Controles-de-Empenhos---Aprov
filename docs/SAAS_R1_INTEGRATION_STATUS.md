# EMPROVEX SaaS R1 — Integration Status

Última atualização: **2026-10-01**
Produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Integrador: `feat/saas-r1-commercializacao`
Estado global: **SAAS-A CONGELADA / SAAS-B INTEGRADA / SAAS-C + SAAS-DL + SAAS-E EM EXECUÇÃO / SAAS-DS AGUARDA B+C**

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
| SAAS-C Onboarding | `saas-r1-c-onboarding` | A | **ATIVADA** | worker em execução / aguardando handoff |
| SAAS-DL Legal/aceite | `saas-r1-dl-legal-acceptance` | A | **ATIVADA** | worker em execução / aguardando handoff |
| SAAS-E Operação/recovery | `saas-r1-e-ops-recovery` | A | **ATIVADA** | worker em execução / aguardando handoff |
| SAAS-DS Segurança/enforcement | `saas-r1-ds-security-enforcement` | B + C | **BLOQUEADA POR DEPENDÊNCIA** | não iniciada |
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
6. Provisionamento já cria billing junto do tenant.
7. Backups lógicos atuais dependem de sessão/Drive e não substituem backup nativo do banco inteiro.
8. Central de Depósitos usa banco Firestore separado e precisa entrar explicitamente na estratégia de desastre.
9. Legal atual é pré-comercial e precisa versão/aceite.
10. Cloud Monitoring já existe; uptime deve reutilizá-lo.

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

SAAS-B já foi recebida, auditada e integrada.

Próximo gate:
- receber SAAS-C, SAAS-DL e SAAS-E;
- SAAS-DS só poderá ser liberada depois da integração semântica da SAAS-C sobre a base que já contém SAAS-B.

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

## 8. Estado de produção

Nenhuma alteração do SaaS R1 está em `main`.

Nenhum deploy de produção do SaaS R1 está autorizado implicitamente.

A branch integradora pode receber documentação e código de workers, mas promoção para produção depende de SAAS-J e autorização explícita do usuário.
