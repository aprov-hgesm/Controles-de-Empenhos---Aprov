# EMPROVEX SaaS R1 — Execução Paralela Coordenada

Última atualização: **2026-10-01**
Branch integradora: `feat/saas-r1-commercializacao`
Baseline: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

## 1. Modelo oficial

A execução segue:

> **contratos comuns congelados → onda 1 paralela → enforcement transversal → integração controlada → piloto → certificação**

O objetivo é acelerar sem permitir que dois chats inventem contratos diferentes para cliente, billing, acesso, legal ou backup.

## 2. Papel do Chat Coordenador

O Coordenador:
- trabalha sobre a branch integradora;
- mantém Memorial, Integration Status e Handoff;
- cria/promove branches de workers;
- congela contratos compartilhados;
- revisa escopo e diffs;
- recebe handoffs;
- integra semanticamente;
- resolve conflitos;
- executa validação combinada;
- bloqueia invasão de escopo;
- conduz SAAS-I e SAAS-J;
- não faz merge em `main` nem deploy de produção sem autorização explícita do usuário.

Workers não integram uns aos outros diretamente.

## 3. SAAS-A — Fundação e contratos comuns

**Responsável:** Coordenador.
**Estado inicial:** concluído documentalmente por este plano.

Contratos congelados:
- workspace é a unidade comercial/tenant;
- uma UG por workspace na R1;
- uma conta operacional primária externa;
- billing canônico é o Bloco 22;
- estados comerciais existentes são preservados;
- trial 30 dias;
- **R$ 70/mês no Plano Completo**;
- 5º dia útil;
- 10 dias de tolerância;
- pagamento externo/manual;
- suspensão manual;
- inadimplência nunca apaga dados;
- fundador isento;
- VIP externo = estado interno `exempt`, preço R$ 0 e acesso completo;
- no public signup;
- no Mercado Pago API/webhook;
- no redesign multi-seat;
- backup nativo deve cobrir os dois bancos antes da abertura;
- aceite legal será versionado.

Alterar qualquer item exige decisão do Coordenador e atualização dos quatro documentos canônicos.

## 4. Onda 1 — frentes paralelas independentes

**Status: CONCLUÍDA em 2026-10-01. SAAS-B, SAAS-C, SAAS-DL e SAAS-E foram integradas na branch coordenadora.**

As quatro workers partiram da mesma base comum e foram reconciliadas semanticamente pelo Coordenador. Os contratos abaixo permanecem como registro da execução.

### SAAS-B — Billing, trial e regularização

Branch sugerida:
`saas-r1-b-billing-payment`

Propriedade preferencial:
- `lib/billing.ts`;
- `lib/platformBillingStore.ts`;
- `hooks/usePlatformAdminBilling.ts`;
- `hooks/useWorkspaceBillingAccount.ts`;
- `components/admin/AdminBillingPanel.tsx`;
- componentes/rotas novas de regularização;
- guard específico de billing.

Não deve editar:
- `lib/platformAccess.ts`;
- provisionamento server-side salvo necessidade de contrato devolvida ao Coordenador;
- backup;
- páginas legais, exceto links de navegação neutros.

Entregas:
1. migrar o preço padrão de R$ 50,00 para **R$ 70,00**, sem reescrever competências históricas;
2. consolidar **Plano Completo** como único plano, sem limitação comercial por módulo;
3. implementar marcação administrativa **VIP / Isento** reutilizando `exempt`;
4. VIP externo deve operar com R$ 0, sem cobrança/atraso, mantendo acesso completo;
5. permitir remover VIP e retornar ao preço comercial vigente de R$ 70,00;
6. configurar link público de regularização sem credenciais;
7. exposição segura das instruções comerciais;
8. UX externa de trial/pendência;
9. referência administrativa opcional do pagamento;
10. confirmação idempotente de competência;
11. histórico/auditoria preservados;
12. manter billing sem enforcement até SAAS-DS.

Aceite:
- nenhum segredo de pagamento no cliente;
- founder exempt;
- VIP externo usa `exempt`, R$ 0 e acesso completo;
- nenhuma feature é bloqueada por tier/plano;
- preço novo padrão = 7000 centavos;
- competências históricas não são reprecificadas;
- trial existente preservado;
- pagamento confirmado não duplica competência;
- status não deleta dados;
- preço/vencimento/tolerância continuam centralizados;
- build/typecheck/guard billing verdes.

### SAAS-C — Onboarding assistido e credenciais

Branch sugerida:
`saas-r1-c-onboarding`

Propriedade preferencial:
- `lib/sectorProvisioning.ts`;
- `lib/server/sectorProvisioningAdmin.ts`;
- `app/api/admin/provision-sector/**`;
- componentes administrativos de criação;
- login/reset/troca de senha;
- componentes do checklist de primeiro acesso.

Não deve:
- redefinir estados de billing;
- implementar suspensão comercial;
- criar auto-cadastro;
- tocar backup/monitoramento.

Entregas:
1. fluxo administrativo curto de cadastro;
2. preservação do provisionamento atômico/rollback;
3. “Esqueci minha senha”;
4. troca de senha;
5. mensagens de acesso claras;
6. checklist curto de primeiro acesso;
7. Drive opcional, não bloqueante.

Aceite:
- UID/e-mail/workspace/UG coerentes;
- usuário externo não escolhe outro tenant;
- erro parcial não deixa conta órfã silenciosa;
- reset nativo Firebase;
- nenhuma senha registrada em Firestore/log;
- testes de provisionamento e segurança verdes.

### SAAS-DL — Legal, privacidade e aceite

Branch sugerida:
`saas-r1-dl-legal-acceptance`

Propriedade preferencial:
- `app/privacy/page.tsx`;
- `app/terms/page.tsx`;
- `components/legal/**`;
- novo domínio de versão/aceite legal;
- Rules/testes estritamente do aceite.

Não deve:
- alterar billing;
- alterar Auth/provisionamento;
- alterar Rules operacionais fora da coleção de aceite.

Entregas:
1. revisão comercial de Termos;
2. revisão comercial de Privacidade;
3. referência ao Mercado Pago quando usado;
4. regra de suspensão/cancelamento sem exclusão automática;
5. pacote legal versionado;
6. aceite imutável por versão;
7. gate de primeiro acesso/nova versão;
8. canal de contato mantido.

Aceite:
- páginas seguem públicas;
- aceite não é tratado genericamente como “consentimento LGPD”;
- usuário não é solicitado novamente na mesma versão;
- versão nova exige novo aceite;
- nenhum dado operacional é copiado;
- textos não declaram conformidade jurídica absoluta.

### SAAS-E — Operação, backup, uptime e suporte

Branch sugerida:
`saas-r1-e-ops-recovery`

Propriedade preferencial:
- documentação/runbooks de backup/recuperação;
- `app/api/health/**` ou equivalente sem dependência de Firestore;
- guards de recuperação;
- configuração/documentação de monitoramento;
- testes de desastre;
- contratos de backup da Central quando aplicável.

Não deve:
- alterar billing;
- alterar onboarding;
- alterar autorização tenant sem handoff.

Entregas:
1. mapa completo dos dois bancos Firestore;
2. plano/execução de backup nativo diário para ambos;
3. retenção inicial registrada;
4. restauração real em banco novo;
5. health endpoint sem segredo/DB read;
6. uptime HTTPS + SSL;
7. alerta de indisponibilidade;
8. runbook de incidente;
9. rotina simples de suporte;
10. revisão da cobertura do backup lógico da Central.

Aceite:
- prova de backup/restore;
- Core Protection preservado;
- uptime não gera leituras operacionais;
- alertas não bloqueiam operação;
- nenhuma credencial exposta.

## 5. Onda 2 — SAAS-DS Segurança e Enforcement

**Status: CONCLUÍDA E INTEGRADA em 2026-10-02.**

PR #218 foi integrado por squash em `726436ac...`. A etapa de enforcement transversal está encerrada no código; publicação de Rules permanece para a release coordenada.

Branch:
`saas-r1-ds-security-enforcement`

Motivo de ter sido posterior:
- é a única frente que precisa conhecer simultaneamente billing, provisionamento, identidade e sessão;
- iniciar somente agora evita contratos duplicados e permite trabalhar sobre B+C já consolidadas.

Propriedade:
- `lib/platformAccess.ts`;
- lifecycle de acesso;
- endpoint/serviço server-side de suspensão/reativação;
- session revocation;
- Firestore Rules;
- testes multi-tenant e guards de segurança.

Missão:
- transformar `suspended/canceled` em bloqueio real somente por ação administrativa;
- garantir que `exempt`/VIP permaneça operacionalmente equivalente a cliente regular ativo, sem cobrança;
- sincronizar `workspaces.status` e `platformAccounts.status`;
- preservar billing como fonte comercial e status de acesso como enforcement;
- revogar sessões;
- distinguir suspensão comercial de falha técnica;
- reativar sem tocar dados;
- validar que não existe acesso cross-tenant.

Proibições:
- não consultar billing em cada operação das Rules;
- não deletar workspace;
- não fazer auto-suspensão por cron;
- não alterar preço/trial;
- não criar papéis novos de usuário.

Aceite:
- suspensão bloqueia nova resolução de workspace;
- sessão existente perde capacidade operacional;
- Rules negam dados do tenant suspenso;
- outro tenant permanece isolado;
- fundador preservado;
- reativação restaura acesso;
- operação é auditada e recuperável.

## 6. SAAS-I — Integração Controlada

**Status: LIBERADA / PRÓXIMA ETAPA.**

Não é uma feature.

O Coordenador combina:
- B;
- C;
- DL;
- E;
- DS.

Checklist:
- nenhuma fonte de verdade duplicada;
- regularização funciona para conta suspensa;
- onboarding gera billing correto;
- aceite legal não quebra login/recuperação;
- suspensão não impede rota pública de regularização;
- reativação não requer refresh destrutivo;
- backup inclui os domínios novos necessários;
- monitoramento não adiciona listeners caros;
- segurança multi-tenant continua verde;
- UX e mensagens são compreensíveis.

SAAS-I pode criar glue code mínimo. Não deve adicionar feature nova.

## 7. SAAS-P — Piloto

Piloto não é worker de implementação amplo.

O Coordenador registra:
- workspaces participantes;
- datas de onboarding;
- dúvidas;
- falhas;
- pagamentos;
- custo;
- incidentes;
- métricas de uso;
- ações corretivas.

Correções do piloto devem receber uma branch curta e escopo próprio.

## 8. SAAS-J — Certificação Final

Obrigatório:
- TypeScript;
- build produção;
- diff hygiene;
- Core Protection;
- testes de domínio;
- segurança multi-tenant;
- guards de billing/legal/backup;
- Firestore Rules tests quando aplicável;
- métricas/capacidade;
- restore drill;
- uptime/alerta;
- validação manual das jornadas comerciais;
- regressão do EMPROVEX;
- pendências conhecidas;
- decisão explícita do usuário.

Browser E2E continua sob demanda conforme risco.

## 9. Matriz de dependências

| Frente | Depende de | Pode rodar em paralelo com |
| --- | --- | --- |
| SAAS-A | R3 publicada | — |
| SAAS-B | SAAS-A | C, DL, E |
| SAAS-C | SAAS-A | B, DL, E |
| SAAS-DL | SAAS-A | B, C, E |
| SAAS-E | SAAS-A | B, C, DL |
| SAAS-DS | B + C integrados | DL/E já integrados ou estáveis |
| SAAS-I | B + C + DL + E + DS | — |
| SAAS-P | SAAS-I aprovada | — |
| SAAS-J | piloto + correções | — |

## 9.1 Regra de banco de dados

Workers **não devem criar um terceiro banco Firestore para o SaaS R1**.

Billing, onboarding, aceite legal, identidade e lifecycle permanecem no banco principal. A Central de Depósitos continua no `emprovex-warehouse`.

Se um worker acreditar que novo banco é necessário, deve interromper e devolver a decisão ao Coordenador com evidência de isolamento/escala/regionalização. Novas Rules não justificam banco novo por si só.

## 10. Regras de branch

- Integrador: `feat/saas-r1-commercializacao`.
- Workers sempre partem do HEAD atual da integradora no momento da atribuição.
- Worker nunca mergeia `main`.
- Worker não faz deploy de produção.
- Worker não incorpora outra worker por conta própria.
- Worker não faz rebase “para ficar verde” se isso importar trabalho alheio.
- Coordenador integra por PR ou commit controlado.
- Preferir squash por worker quando a história interna não for relevante ao produto.

## 11. Handoff obrigatório

Cada worker encerra com:
- branch;
- base exata;
- HEAD;
- commits principais;
- arquivos alterados;
- contrato preservado;
- decisões tomadas;
- testes executados;
- resultados;
- riscos/pendências;
- impacto em Rules/Indexes/env;
- impacto em outro worker;
- comandos de validação;
- indicação “PRONTO PARA INTEGRAÇÃO” ou “BLOQUEADO”.

Sem handoff, a frente não é considerada concluída.

## 12. Conflitos

Conflito pertence ao Coordenador quando envolver:
- mesmo arquivo de duas frentes;
- mudança de tipo compartilhado;
- billing ↔ acesso;
- onboarding ↔ billing;
- legal ↔ login;
- backup ↔ nova coleção;
- Rules comuns.

Nunca resolver conflito com `ours`/`theirs` global.

## 13. Gates proporcionais

### Documentação-only
- diff hygiene;
- consistência dos quatro documentos;
- sem CI pesado.

### Billing/UI
- guard Bloco 22 atualizado;
- TypeScript;
- build;
- testes de domínio;
- Core Protection.

### Provisionamento/Auth
- testes de provisionamento;
- Firebase Emulator quando aplicável;
- TypeScript;
- build;
- Core Protection;
- Browser smoke se interação mudou.

### Rules/segurança
- emulator multi-tenant;
- testes negativos;
- Core Protection;
- build/typecheck;
- Browser E2E direcionado se mudança só puder ser provada na UI.

### Backup/restore
- guard;
- teste de desastre;
- evidência de restore;
- validação manual operacional.

## 14. Critério de interrupção

Worker interrompe e devolve ao Coordenador se descobrir:
- risco de perda de dados;
- quebra cross-tenant;
- necessidade de novo status compartilhado;
- necessidade de credencial de pagamento;
- migração de infraestrutura;
- automação financeira obrigatória não prevista;
- mudança de contrato de preço/trial;
- dependência circular.

## 15. Ordem de integração recomendada

1. SAAS-DL, se isolada;
2. SAAS-E, se isolada;
3. SAAS-B;
4. SAAS-C;
5. revalidação dos contratos comuns;
6. SAAS-DS;
7. SAAS-I;
8. piloto;
9. SAAS-J.

O Coordenador pode alterar essa ordem para reduzir conflitos, documentando a razão.

## 16. Registro SAAS-I — 2026-10-02

A etapa integradora SAAS-I foi executada em branch técnica `saas-r1-i-integration`, base exata `71ed87932f17b8acd9fab9c30006970b59079c42`, PR **#219** para a integradora.

Escopo de integração:
- B+C+DL+E+DS sem reincorporar workers;
- glue mínimo do LegalAcceptanceGate;
- bloqueio de listeners pré-aceite;
- Central direta sob o mesmo contrato jurídico;
- VIP legado materializado como `exempt` com metadata mínima protegida;
- migração explícita/idempotente/auditável;
- guard combinado `verify:saas-r1-integration`;
- plano de release/rollback.

A SAAS-I não é nova worker de domínio e não altera a regra do método paralelo: integra contratos já concluídos e corrige apenas incompatibilidades transversais.

Produção permanece intocada. SAAS-P só é liberada após o fechamento verde do PR #219.

