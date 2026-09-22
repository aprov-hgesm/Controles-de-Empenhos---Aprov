# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **PLANEJADO / IMPLEMENTAÇÃO AINDA NÃO INICIADA**

Data-base desta memória: 2026-09-22.

Módulo:
- ADM Depósito / Área Logística;
- primeira implementação exclusiva da conta fundadora;
- usuários externos ainda não possuem acesso;
- nenhum bloco DEP foi implementado até a criação desta memória oficial.

## Repositório

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Último commit de referência confirmado da `main`:
`b9a139ab6a3c905878e279342760d35210fdd52d`

Esse commit corresponde ao merge da memória oficial do projeto. O commit-base anterior à documentação era `04fada7d74ee346e0db19699a969d74f1c329ebb` e já continha, entre outras alterações anteriores ao módulo, a configuração de billing com mensalidade padrão de R$ 50,00.

## Última fase concluída

Nenhuma fase do ADM Depósito foi implementada.

## Próxima fase

**FASE 0 — Fundação e isolamento**

Blocos:
- DEP-0 — Feature flag exclusiva da conta fundadora;
- DEP-0.1 — Namespace próprio do módulo.

## Gate esperado da próxima fase

Ao final da FASE 0 deve estar comprovado que:
- a conta fundadora pode acessar a fundação do módulo;
- usuários externos não veem a navegação do módulo;
- usuários externos não acessam rotas do módulo por URL direta;
- usuários externos não acessam APIs/dados logísticos;
- nenhuma funcionalidade operacional existente do EMPROVEX foi quebrada.

## Decisões vigentes

Consultar obrigatoriamente:
`docs/adm-deposito/DECISIONS.md`

Principais decisões em vigor:
- NF cadastrada = material recebido e estoque disponível;
- não existe confirmação física adicional pelo ADM Depósito;
- pendência de lote/validade/localização não bloqueia;
- SISCOFIS entra via prompt padronizado + IA externa + JSON;
- sem Número de Ficha no núcleo inicial;
- código de barras desde a primeira versão;
- FEFO recomendado;
- Visão do Depósito é 2D com perspectiva tridimensional, não 3D real;
- mapa mostra somente locais;
- pesquisa de produto altera o destaque/cor dos locais correspondentes;
- Firestore mantém o layout operacional;
- Drive pode manter layout JSON, versões e preview SVG;
- primeira implementação permanece exclusiva da conta fundadora.

## Testes do módulo

Ainda não executados, pois a implementação não começou.

## PRs do módulo

Nenhum PR de implementação do ADM Depósito concluído até esta data.

Memória oficial criada e integrada:
- PR #154 — `docs: establish ADM Depósito project memory`;
- merge via squash;
- commit da `main`: `b9a139ab6a3c905878e279342760d35210fdd52d`;
- Application CI: aprovado;
- Browser E2E com Firebase Emulator: aprovado;
- release gates 16, 17, 18, 19, 20 e 21: aprovados;
- Vercel preview: aprovado.

Nenhum código operacional do ADM Depósito foi implementado por esse PR.

## Riscos conhecidos antes da FASE 0

1. O EMPROVEX continua recebendo mudanças paralelas em outras áreas.
2. Antes de cada nova fase, a `main` deve ser comparada com o commit registrado aqui.
3. Alterações futuras em NF, autenticação, Drive, Firestore Rules, workspace/UG ou telemetria podem afetar fases ainda não executadas.
4. Nenhuma decisão de habilitação externa deve ser antecipada.

## Protocolo de fechamento de cada fase

Ao concluir uma fase, substituir/atualizar:
- status geral;
- última fase concluída;
- blocos concluídos;
- PR;
- commit final da `main`;
- testes e respectivos resultados;
- decisões novas;
- pendências;
- riscos;
- próxima fase;
- impacto de mudanças paralelas detectadas.

## Instrução para o próximo chat

Antes de qualquer modificação:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md` e este `STATUS.md`.
2. Consultar a `main` atual.
3. Comparar a `main` atual com o commit-base/último commit deste arquivo.
4. Avaliar alterações intermediárias.
5. Executar somente a fase indicada como próxima.
