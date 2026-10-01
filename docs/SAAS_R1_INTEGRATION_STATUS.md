# EMPROVEX SaaS R1 — Integration Status

Última atualização: **2026-10-01**
Produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
Integrador: `feat/saas-r1-commercializacao`
Estado global: **SAAS-A CONGELADA / ONDA 1 LIBERADA / IMPLEMENTAÇÃO AINDA NÃO INICIADA**

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
| SAAS-B Billing/pagamento | `saas-r1-b-billing-payment` | A | **LIBERADA** | não iniciada |
| SAAS-C Onboarding | `saas-r1-c-onboarding` | A | **LIBERADA** | não iniciada |
| SAAS-DL Legal/aceite | `saas-r1-dl-legal-acceptance` | A | **LIBERADA** | não iniciada |
| SAAS-E Operação/recovery | `saas-r1-e-ops-recovery` | A | **LIBERADA** | não iniciada |
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
2. O código atual ainda possui baseline de R$ 50,00; SAAS-B deve migrar o default para R$ 70,00.
3. `exempt` será reutilizado para VIP externo, evitando novo status de domínio.
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

## 6. Próxima ação do Coordenador

Criar as quatro branches da Onda 1 a partir do HEAD desta integradora e emitir prompts independentes para:
- SAAS-B;
- SAAS-C;
- SAAS-DL;
- SAAS-E.

SAAS-DS não deve receber missão de implementação antes de B e C estarem semanticamente integradas.

## 7. Registro de integrações

Ainda vazio. O Coordenador deve acrescentar para cada merge:
- worker HEAD;
- PR/commit de integração;
- conflitos resolvidos;
- testes;
- riscos residuais;
- novo HEAD da integradora.

## 8. Estado de produção

Nenhuma alteração do SaaS R1 está em `main`.

Nenhum deploy de produção do SaaS R1 está autorizado implicitamente.

A branch integradora pode receber documentação e código de workers, mas promoção para produção depende de SAAS-J e autorização explícita do usuário.
