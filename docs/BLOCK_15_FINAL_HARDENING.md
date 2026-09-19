# EMPROVEX — Bloco 15 — hardening final

## Objetivo

Fechar a sequência de estabilização com um gate técnico único antes de ampliar o uso do EMPROVEX, reforçando CI, fronteiras administrativas, auditoria, Google Drive e regressões críticas **sem alterar regras de negócio, UX funcional ou modelo de dados operacional**.

## Princípio conservador

O Bloco 15 não cria funcionalidades novas e não muda o comportamento esperado dos operadores. As Firestore Rules atuais permanecem como fonte de verdade; o bloco aumenta a cobertura que comprova que essas fronteiras continuam válidas.

## 1. GitHub Actions

O workflow passa a validar três situações:

- pull requests;
- push na branch `main`;
- execução manual.

Também passa a usar `concurrency` com cancelamento de execuções obsoletas da mesma referência.

Ao final, o job `block-15-release-gate` depende dos dois pilares críticos:

1. `validate-application`;
2. `browser-e2e-emulator`.

O gate só conclui com sucesso quando ambos terminam com resultado `success`.

## 2. Administração sem bypass operacional

A suíte multi-tenant passa a comprovar explicitamente que o administrador da plataforma pode consultar diretórios administrativos, mas não ganha acesso aos dados operacionais dos setores externos.

Casos fixados:

- admin pode listar `workspaces` e `platformAccounts`;
- setor externo não pode listar esses diretórios globais;
- admin não pode ler nem listar empenhos de outro workspace;
- admin não pode gravar alertas em outro workspace;
- admin não pode ler `settings/documentStorage` de setor externo.

Isso mantém a separação entre administração da plataforma e operação de cada tenant.

## 3. Auditoria e UG

A proteção já existente passa a ter regressões explícitas para:

- `platformAuditEvents` imutável após criação;
- setor externo sem leitura/listagem da auditoria administrativa;
- `platformUgIndex` legível pelo admin, mas não pelo setor externo;
- `platformUgIndex` sem update ou delete após criação.

## 4. Legado raiz

O fundador autenticado pelo provider Google continua podendo consultar os dados legados raiz para auditoria/recuperação, porém nenhuma escrita é permitida.

Também é validado que uma sessão do mesmo e-mail usando provider de senha não recebe esse acesso especial.

## 5. Google Drive

O Bloco 15 mantém como gates obrigatórios:

- abstração/provedor de armazenamento;
- workspace Drive;
- onboarding Drive;
- comportamento OAuth externo;
- teste de autorização Drive com Firebase Auth Emulator.

A configuração `documentStorage` de cada setor continua operacional e privada ao próprio tenant.

## 6. E2E destrutivo e escalabilidade

O Browser E2E continua obrigatório no release gate e deve preservar, no mínimo:

- exclusão protegida de empenho sem estado parcial, incluindo NF e NS lock;
- isolamento entre workspaces;
- reparo histórico seguro;
- fluxo SAG;
- perfis realtime do Bloco 14.

## Critério de aceite

O Bloco 15 está concluído quando:

1. PR e `main` executam o Application CI;
2. execuções obsoletas da mesma referência são canceladas;
3. o guard `verify:block-15-final-hardening` passa;
4. a suíte multi-tenant comprova os limites administrativos adicionais;
5. os gates de Google Drive continuam obrigatórios;
6. Browser E2E e validação principal precisam ficar verdes no mesmo release gate;
7. build, TypeScript e diff hygiene permanecem verdes;
8. nenhuma regra de negócio ou funcionalidade operacional é alterada.
