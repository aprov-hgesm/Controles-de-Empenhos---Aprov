# EMPROVEX — Bloco 9 — Browser E2E com Firebase Emulator

## Objetivo

O Bloco 9 adiciona uma camada E2E de navegador sobre a aplicação real, executando:

- Next.js local;
- Firebase Auth Emulator;
- Firestore Emulator;
- Firestore Rules reais;
- autenticação por e-mail/senha;
- resolução de workspace;
- leitura operacional;
- gravação de NS;
- persistência após reload;
- isolamento entre workspaces.

A suíte não usa dados de produção.

## Isolamento

O modo de emulação do frontend é opt-in:

```text
NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS=1
NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security
```

Sem essas variáveis, o EMPROVEX continua usando o projeto e o banco nomeado de produção configurados em `firebase-applet-config.json`.

## Harness

O comando E2E inicia Auth + Firestore Emulator e executa o orquestrador:

```text
scripts/e2e-browser-emulator.mjs
```

O orquestrador reaproveita `scripts/firestore-multitenancy-security.test.mjs` como preparação validada do ambiente. Ao final dessa suíte, dois workspaces ficam com fixtures determinísticas e completas para o navegador:

- `workspace-lifecycle` — UG 160416, operador `sector-lifecycle@example.test`;
- `workspace-b` — UG 160417, operador `sector-b@example.test`.

## Jornada crítica

A primeira jornada de navegador executa:

```text
login do setor
→ resolução workspace + UG
→ Relatórios
→ seleção de empenho
→ edição de Número da NS
→ UG automática do usuário
→ gravação transacional
→ reload da aplicação
→ confirmação de persistência
→ logout
```

A NS usada no cenário é vinculada à UG 160416 pelo próprio contexto autenticado.

## Isolamento

A segunda jornada entra com `workspace-b` e confirma que:

- o empenho do segundo workspace aparece;
- o fornecedor do primeiro workspace não aparece;
- a NS gravada no primeiro workspace não aparece.

Assim, o teste atravessa UI, Auth, resolução de identidade, subscriptions, Firestore Rules e persistência.

## Auditoria

A preparação do mesmo harness executa integralmente a suíte multi-tenant do Emulator, que inclui os testes de auditoria imutável do Bloco 8:

- criação válida;
- bloqueio de update;
- bloqueio de delete;
- antifalsificação de actorUid;
- isolamento entre tenants;
- auditoria administrativa restrita ao fundador.

Dessa forma, o E2E de navegador é executado somente após a segurança de baixo nível estar verde.

## Playwright

O job de CI instala `@playwright/test` de forma efêmera e fixa a versão usada no workflow. A dependência não é incorporada ao bundle de produção.

O Chromium é instalado apenas no job E2E.

## Critério de aceite

O Bloco 9 está pronto quando:

1. login real por senha funciona no navegador contra o Auth Emulator;
2. o workspace correto é resolvido;
3. a NS é salva pela UI com UG automática;
4. a NS permanece após reload;
5. outro workspace não visualiza os dados;
6. a suíte multi-tenant continua verde;
7. o guard permanente do Bloco 9 passa;
8. a Application CI permanece verde;
9. o Browser E2E job permanece verde.


## Política operacional posterior — execução seletiva

A existência desta suíte completa permanece obrigatória, mas sua execução em CI deve seguir a política global definida em `docs/DEVELOPMENT_CI_WORKFLOW.md`.

Diretriz:
- mudanças que alteram jornada funcional do usuário devem executar Browser E2E adequado;
- alterações puramente visuais, documentais ou estáticas podem usar guards/testes direcionados e smoke E2E quando suficiente;
- a regressão completa continua indicada para integrações, releases, alterações de infraestrutura compartilhada, regressões e execução periódica;
- nenhuma otimização de tempo pode remover a capacidade de executar a suíte completa.

Enquanto o workflow vigente ainda disparar este job em todo PR, o comportamento atual deve ser respeitado até a refatoração oficial do CI.
