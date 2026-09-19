# EMPROVEX — Bloco 15 — hardening final e contrato de regressão

## Objetivo

Encerrar a sequência dos Blocos 9–14 com um contrato técnico único de regressão, sem alterar regras de negócio,
fluxos do operador, persistência, layout, Firestore Rules ou comportamento funcional de produção.

O Bloco 15 não cria uma nova funcionalidade e não altera regras de negócio. Ele transforma garantias já implementadas em pré-condições
obrigatórias do CI.

## Escopo consolidado

O fechamento exige simultaneamente:

- segurança multi-tenant por workspace, UID, status e UG;
- Firestore Emulator usando as Rules oficiais do repositório;
- auditoria append-only operacional e administrativa;
- Browser E2E com Auth Emulator + Firestore Emulator;
- preservação dos guards dos Blocos 9, 10, 11, 12, 13 e 14;
- build de produção;
- validação TypeScript final;
- diff hygiene.

## Segurança multi-tenant

As fronteiras já existentes permanecem fail-closed:

- conta operacional precisa estar vinculada ao workspace correto;
- UID Firebase precisa coincidir com o UID persistido;
- workspace e conta precisam estar ativos;
- UG precisa permanecer coerente entre workspace e conta;
- um setor não pode ler ou gravar dados operacionais de outro;
- o administrador da plataforma não recebe bypass sobre dados operacionais de setores externos.

Essas garantias continuam validadas pela suíte real do Firebase Emulator.

## Auditoria

A trilha de auditoria permanece append-only.

Eventos operacionais e administrativos críticos continuam registrando ator, correlação, before/after,
metadata e timestamp server-side. Update e delete dos eventos permanecem bloqueados pelas Firestore Rules.

O Bloco 15 não amplia payloads de auditoria nem adiciona credenciais ou dados sensíveis.

## Browser E2E

O Browser E2E continua usando ambiente local efêmero e opt-in explícito para emuladores.

A jornada crítica mantém prova de:

- login do operador;
- isolamento entre workspaces;
- registro operacional de NS;
- persistência após reload;
- UG automática;
- alternância entre áreas da aplicação;
- perfil realtime otimizado do Bloco 14.

O ambiente E2E não usa dados de produção.

## CI final

O Application CI passa a executar também um guard agregado do Bloco 15.

Esse guard falha se qualquer uma das seguintes garantias desaparecer do repositório:

1. suíte multi-tenant e testes com emuladores;
2. auditoria imutável operacional/administrativa;
3. Browser E2E;
4. guards dos Blocos 9–14;
5. build;
6. TypeScript;
7. diff hygiene;
8. permissões mínimas e timeouts do workflow.

Também rejeita bypasses explícitos de validação no workflow, como continue-on-error nas etapas de
fechamento.

## O que o Bloco 15 não altera

O Bloco 15 não altera Firestore Rules, porque a auditoria mostrou que os invariantes necessários já
estão presentes e cobertos pelo Emulator Suite.

Também não:

- altera regras de negócio;
- altera queries ou writes de produção;
- altera autenticação;
- altera identidade UG/UID;
- altera storage/Google Drive;
- altera documentos ou relatórios;
- altera subscriptions do Bloco 14;
- altera UX funcional.

## Critério de aceite

O Bloco 15 está concluído quando:

1. o guard agregado está registrado no package.json;
2. o Application CI executa o guard antes do build final;
3. o guard comprova a presença das invariantes de Firestore e auditoria append-only;
4. o guard comprova a manutenção da suíte de segurança multi-tenant;
5. o guard comprova Browser E2E e isolamento de produção;
6. os guards dos Blocos 9–14 continuam obrigatórios;
7. build, TypeScript e diff hygiene continuam obrigatórios;
8. nenhuma mudança funcional foi introduzida.
