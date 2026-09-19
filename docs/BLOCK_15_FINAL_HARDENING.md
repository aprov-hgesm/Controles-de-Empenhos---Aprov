# BLOCO 15 — HARDENING FINAL

## Objetivo

Consolidar a baseline operacional após os Blocos 8–14 sem introduzir novas funcionalidades de negócio. O bloco fecha o ciclo com guardrails estáticos sobre segurança multi-tenant, auditoria imutável, concorrência, escalabilidade, E2E e CI.

## Contrato de segurança

O Bloco 15 preserva explicitamente:

- isolamento por workspace/UG e proibição de acesso cross-tenant;
- trilha de auditoria append-only, com update/delete bloqueados;
- vínculo do ator da auditoria à sessão autenticada;
- operações críticas de empenho protegidas por transação;
- perfil de subscriptions realtime dependente da seção ativa;
- fluxo E2E crítico executado com Firebase Emulator;
- validações dos Blocos 10, 12, 13 e 14 na CI.

O bloco **não** altera regras de negócio, não migra dados, não amplia permissões, não altera o modelo de identidade por UG e não executa reparos automáticos em produção.

## Gate final

O guard `verify:block-15-final-hardening` falha se qualquer uma das garantias acima for removida do código, das Firestore Rules, do E2E ou da pipeline.

A CI executa o gate antes do build de produção. O Browser E2E continua em job separado com Auth + Firestore Emulator.

## Critério de conclusão

O Bloco 15 está pronto quando:

1. o contrato deste documento existe;
2. o guard final está registrado no package.json;
3. a Application CI executa o guard;
4. as Rules continuam tenant-safe e append-only para auditoria;
5. os guards de integridade, concorrência e escalabilidade permanecem encadeados;
6. o E2E crítico e o job com Emulator permanecem obrigatórios.

Esse fechamento é conservador: ele transforma as garantias já implementadas em uma barreira explícita contra regressões futuras.


## Extensão de fechamento

A validação final amplia o contrato sem alterar regras de negócio, persistência ou UX funcional.

### GitHub Actions

A pipeline passa a executar em pull requests, em push para a `main` e por acionamento manual. Execuções obsoletas da mesma referência são canceladas por `concurrency`.

Além dos jobs existentes, um **release gate** consolidado só fica verde quando:

- `validate-application` conclui com sucesso;
- `browser-e2e-emulator` conclui com sucesso.

Isso evita considerar o fechamento válido quando apenas um dos dois pilares passa.

### Fronteiras administrativas

A suíte real do Firebase Emulator também fixa regressões para garantir que:

- o administrador pode listar metadados administrativos de workspaces e contas;
- setores externos não podem listar esses diretórios globais;
- o administrador não recebe bypass para ler, listar ou gravar dados operacionais de outro setor;
- a auditoria administrativa permanece invisível aos setores externos;
- o índice global de UG permanece legível apenas no contexto administrativo e imutável após criação.

### Google Drive

Os gates de Google Drive permanecem obrigatórios no GitHub Actions, incluindo onboarding e autorização externa com Firebase Auth Emulator.

A configuração `settings/documentStorage` continua privada ao próprio workspace; o administrador da plataforma não recebe acesso operacional à configuração de outro setor.

### Legado raiz

Os dados legados raiz permanecem disponíveis apenas para consulta controlada pelo fundador usando a sessão Google prevista pelas Rules. Escrita continua bloqueada e o mesmo e-mail autenticado por provider de senha não recebe o acesso especial.

### Resultado esperado

O Bloco 15 fecha a sequência com uma barreira de regressão verificável: segurança multi-tenant, auditoria, UG, Google Drive, legado, Browser E2E e CI precisam permanecer coerentes simultaneamente.
