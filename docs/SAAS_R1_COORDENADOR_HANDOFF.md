# EMPROVEX SaaS R1 — Handoff do Coordenador

Última atualização: **2026-10-01**
Integrador: `feat/saas-r1-commercializacao`
Baseline: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

## 1. Missão do próximo Coordenador

Continuar o SaaS R1 sem reabrir a Performance R3 e sem transformar comercialização inicial em um projeto de infraestrutura ou fintech.

Ler, nesta ordem:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/SAAS_R1_PLANO_MESTRE.md`;
3. `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
4. `docs/SAAS_R1_INTEGRATION_STATUS.md`;
5. este handoff;
6. `docs/TESTING_POLICY.md`;
7. `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## 2. Estado confirmado

- R3 publicada em `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`.
- Vercel recebeu a release.
- Rules da Central foram publicadas.
- SaaS R1 possui branch integradora própria.
- SAAS-A foi concluída como freeze documental.
- Onda 1 está liberada.
- Nenhum código funcional do SaaS R1 foi implementado após o freeze.

## 3. Decisão central

A R1 será **assistida e simples**.

Não construir:
- checkout;
- webhook;
- API Mercado Pago;
- auto-suspensão;
- signup público;
- multi-seat;
- helpdesk;
- migração de infraestrutura.

Reusar:
- billing OBSERVE;
- painel de assinaturas;
- provisionamento;
- Auth;
- workspace/UG;
- auditoria;
- Termos/Privacidade;
- backup;
- Monitoring.

## 4. Contrato comercial

- R$ 50/mês.
- 30 dias de trial.
- 5º dia útil.
- 10 dias de tolerância.
- pagamento externo;
- confirmação manual;
- suspensão manual;
- reativação manual;
- sem exclusão de dados por falta de pagamento;
- founder exempt.

## 5. Estratégia de pagamento

R1:
- Link de Pagamento Mercado Pago e/ou Pix;
- EMPROVEX não processa pagamento;
- nenhuma credencial financeira no app;
- usuário é redirecionado ao provedor;
- fundador confirma no painel.

R1.1 potencial:
- Plano de Assinatura sem integração, se o piloto justificar redução de trabalho manual.

API/webhook: fora da R1.

## 6. Estratégia de enforcement

Não adicionar `get(billingAccounts)` a todas as Firestore Rules.

Depois de B+C:
- SAAS-DS cria ação administrativa founder-only;
- billing continua comercial;
- `workspace.status` + `platformAccount.status` continuam autorização;
- suspensão sincroniza para `disabled`;
- reativação sincroniza para `active`;
- leases são revogados;
- dados permanecem intactos.

Esse desenho reduz acoplamento e reaproveita o fail-closed existente.

## 7. Onda 1

Abrir quatro workers independentes:

### B
Billing/regularização.

### C
Onboarding/reset de senha.

### DL
Termos/Privacidade/aceite versionado.

### E
Backup nativo dos dois Firestores, restore, health/uptime e runbook.

Eles podem trabalhar simultaneamente.

## 8. Depois da Onda 1

1. revisar handoffs;
2. integrar frentes isoladas;
3. integrar B e C semanticamente;
4. atualizar Integration Status;
5. abrir SAAS-DS;
6. executar segurança/enforcement;
7. executar SAAS-I;
8. pilotar;
9. certificar SAAS-J.

## 9. Pontos que não podem ser perdidos

- Central está em banco Firestore próprio.
- Backup lógico atual não deve ser confundido com backup global.
- Usuário suspenso precisa acessar uma superfície pública de regularização.
- Aceite legal não é “consentimento LGPD” genérico.
- cancelado não significa deletado.
- billing não deve virar nova dependência cara das Rules.
- nenhum worker publica produção.
- Browser E2E é sob demanda.
- experiência do operador continua prioritária.

## 10. Evidências externas consideradas

Mercado Pago:
- mantém soluções de pagamento/planos por link sem integração;
- assinatura por API é uma camada separada e mais complexa.

Firestore:
- suporta backups agendados diários/semanais e restauração em novo banco.

Google Cloud Monitoring:
- suporta uptime público HTTPS, validação de resposta/SSL e alertas.

ANPD:
- possui guia e regime específico para agentes de pequeno porte, mas o enquadramento não deve ser presumido pelo software.

## 11. Critério de encerramento do Coordenador

O Coordenador só encerra o ciclo após:
- SAAS-J aprovada;
- estado de produção documentado;
- decisão explícita do usuário sobre abertura comercial.

Até lá, `main` e produção não são destino automático das workers.
