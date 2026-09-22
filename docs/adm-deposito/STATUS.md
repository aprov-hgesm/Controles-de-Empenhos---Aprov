# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **FASE 0 — CONCLUÍDA E APROVADA TECNICAMENTE**

Data de fechamento técnico: 2026-09-22.

Módulo:
- ADM Depósito / Área Logística;
- piloto permanece exclusivo da conta fundadora;
- usuários externos permanecem sem visibilidade e sem acesso;
- nenhuma funcionalidade operacional da FASE 1 foi iniciada.

## Repositório

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Branch da FASE 0:
`feat/adm-deposito-phase-0-foundation`

Commit-base do código operacional anterior à memória oficial:
`04fada7d74ee346e0db19699a969d74f1c329ebb`

Merge que introduziu a memória oficial:
`b9a139ab6a3c905878e279342760d35210fdd52d`

HEAD real da `main` no início da FASE 0:
`e7c78c0762ec861a088a1c3bfb93854c6ae996c8`

Commit técnico da FASE 0 aprovado pelos gates antes do fechamento documental:
`f1b2ca5e0068b7ca0f4e4e54958886e7007e18e9`

Comparação realizada antes da implementação:
- `b9a139ab6a3c905878e279342760d35210fdd52d...main`: 3 commits à frente;
- arquivos operacionais alterados nesse intervalo: nenhum;
- único arquivo alterado: `docs/adm-deposito/STATUS.md`;
- conclusão: os commits posteriores eram documentais e não interferiam na FASE 0.

Observação: commits posteriores que alterem apenas este `STATUS.md` fazem parte da manutenção documental e não redefinem o baseline operacional. Todo novo chat deve consultar a `main` real antes de desenvolver.

## Última fase concluída

**FASE 0 — Fundação e isolamento**

Blocos concluídos:
- DEP-0 — Feature flag exclusiva da conta fundadora;
- DEP-0.1 — Namespace próprio do módulo.

## Implementação concluída

### DEP-0 — Feature flag exclusiva da conta fundadora

Foi criada uma política dedicada do módulo que:
- mantém a feature habilitada apenas para o piloto fundador;
- exige contexto operacional do workspace fundador;
- exige a identidade fundadora consolidada;
- mantém a entrada "ADM Depósito" invisível para usuários externos;
- protege a rota `/adm-deposito` contra abertura direta por usuário externo;
- exige confirmação server-side antes de renderizar a fundação do módulo;
- protege a API `/api/adm-deposito/status` com validação do token Firebase da conta fundadora e provider Google.

A visibilidade da interface não é tratada como mecanismo suficiente de segurança.

### DEP-0.1 — Namespace próprio do módulo

Foi criado namespace Firestore independente:

`warehouse/{workspaceId}/...`

Domínios reservados na fundação:
- `materials`;
- `depots`;
- `locations`;
- `movements`;
- `lots`;
- `inventories`;
- `siscofisSnapshots`.

As Firestore Rules possuem gate próprio do ADM Depósito e deliberadamente não reutilizam `canAccessWorkspace(workspaceId)` como fallback. Durante o piloto:
- somente a identidade fundadora autenticada por Google;
- somente no workspace `hgesm-aprov`;
- pode ler ou gravar no namespace `warehouse`.

Nenhuma modelagem operacional de materiais, estoque ou movimentações da FASE 1 foi iniciada.

## Segurança comprovada

Cenários automatizados aprovados no Firebase Emulator:
- fundador grava no namespace ADM Depósito;
- fundador lê o namespace ADM Depósito;
- fundador lista domínio do namespace ADM Depósito;
- setor externo não lê o namespace do fundador;
- setor externo não grava no namespace nem usando o próprio workspace;
- sessão da conta fundadora autenticada por senha não acessa o módulo;
- fundador não usa o namespace logístico de workspace externo.

Cenário Browser E2E aprovado:
- usuário externo não vê `nav-adm-deposito`;
- tentativa de acesso direto a `/adm-deposito` é negada e retorna à aplicação operacional;
- a navegação do ADM Depósito permanece invisível após o redirecionamento.

## Testes e checks

PR da implementação:
- PR #155 — `feat: establish ADM Depósito phase 0 isolation`.

Commit técnico validado:
- `f1b2ca5e0068b7ca0f4e4e54958886e7007e18e9`.

Resultado final do commit técnico:
- Recovery guardrails: **aprovado**;
- Application CI: **aprovado**;
- gate `verify:adm-deposito-phase-0`: **aprovado**;
- suíte multi-tenant Firestore Emulator: **aprovada**;
- Browser E2E com Firebase Emulator: **aprovado**;
- Production build: **aprovado**;
- TypeScript final: **aprovado**;
- Diff hygiene: **aprovado**;
- release gates 16, 17, 18, 19, 20 e 21: **aprovados**;
- Vercel preview do commit técnico: **aprovado**.

Ocorrência durante a validação:
- as duas primeiras execuções do Browser E2E chegaram ao timeout global de 45 s no cenário legado de três contextos simultâneos;
- os testes novos do ADM Depósito já haviam passado nas duas execuções;
- não houve falha da lógica de produção nem da segurança do ADM Depósito;
- o teste legado recebeu timeout específico de 90 s, sem alteração da lógica de sessões;
- após a estabilização, a bateria Browser E2E completa foi aprovada.

## Decisões arquiteturais

Nenhuma decisão registrada em `docs/adm-deposito/DECISIONS.md` foi alterada na FASE 0.

A implementação segue especialmente:
- D-001 — piloto exclusivo da conta fundadora;
- D-026 — isolamento estrutural por workspace/UG e preparação segura para expansão futura.

`DECISIONS.md` permanece como fonte oficial para qualquer alteração arquitetural futura.

## Riscos e pendências

Riscos conhecidos após a FASE 0:
1. Qualquer nova rota ou API do ADM Depósito deverá reutilizar o gate fundador enquanto D-001 permanecer vigente.
2. Alterações futuras nas Firestore Rules não podem introduzir fallback de acesso do namespace `warehouse` para usuários externos antes do gate de expansão previsto no roadmap.
3. O cenário Browser E2E de três contextos simultâneos continua sendo naturalmente mais pesado em runners compartilhados; o timeout específico de 90 s é de teste e não altera a capacidade de sessões da aplicação.
4. Mudanças paralelas em autenticação, workspace/UG, Firestore Rules ou Firebase devem ser comparadas com a `main` real antes da próxima fase.
5. O namespace foi apenas fundado e protegido; seus contratos operacionais ainda não existem por decisão de escopo desta fase.

Pendências:
- nenhuma pendência bloqueante da FASE 0;
- registrar no próximo fechamento o commit final da `main` resultante do merge do PR #155;
- iniciar a FASE 1 somente em um novo chat.

## Próxima fase

**FASE 1 — Fundação do material**

Blocos previstos conforme `ROADMAP.md`:
- DEP-1;
- DEP-1.1.

**A FASE 1 NÃO FOI INICIADA NESTE CHAT.**

## Gate para o próximo chat

Antes de qualquer modificação:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, este `STATUS.md` e `HANDOFF_TEMPLATE.md`.
2. Consultar a `main` real.
3. Confirmar o merge final do PR #155 e registrar/usar seu SHA como novo baseline.
4. Comparar mudanças posteriores ao SHA final da FASE 0.
5. Avaliar impacto de alterações intermediárias em autenticação, Rules, workspace/UG e dados.
6. Executar somente a FASE 1.
