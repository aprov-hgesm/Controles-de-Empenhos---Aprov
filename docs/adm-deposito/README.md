# ADM Depósito — Memória Oficial do Projeto

Esta pasta é a **fonte oficial de continuidade** do desenvolvimento do módulo ADM Depósito / Área Logística do EMPROVEX.

Conversas, prompts e memória informal não substituem estes documentos.

## Documentos oficiais

- `ROADMAP.md` — plano oficial, ordem de capacidades, gates e mapeamento dos blocos DEP/EXT.
- `DECISIONS.md` — decisões arquiteturais e funcionais congeladas.
- `STATUS.md` — estado real, baseline, fase concluída e próxima capacidade.
- `HANDOFF_TEMPLATE.md` — mensagem padrão para abrir a próxima fase.
- `../DEVELOPMENT_CI_WORKFLOW.md` — política global de CI seletivo, E2E e colaboração via Cloud Shell.

## Estratégia de desenvolvimento vigente

Desde o fechamento da FASE 2, o módulo segue:

**Fundação concluída → Walking Skeleton → fatias verticais completas → integração progressiva → hardening → expansão externa.**

O objetivo é evitar o padrão de criar muitas telas parcialmente funcionais e deixar integrações essenciais para o final.

Cada fatia vertical deve, quando aplicável, entregar UI + domínio + persistência + segurança + testes + integração com capacidades anteriores.

## Regra de continuidade

Antes de qualquer nova fase:
1. ler README, ROADMAP, DECISIONS e STATUS;
2. consultar a `main` real;
3. comparar a `main` com o baseline registrado em STATUS;
4. analisar commits intermediários;
5. desenvolver somente a capacidade designada;
6. usar branch própria;
7. executar gates adequados;
8. abrir PR e validar tecnicamente;
9. atualizar STATUS ao final;
10. atualizar DECISIONS somente para nova decisão definitiva;
11. não avançar automaticamente para a fase seguinte.

## Regra de granularidade

- uma capacidade vertical por chat/branch como padrão;
- fases maiores podem ter subtarefas e vários commits internos;
- não criar microfases apenas para separar UI, backend e testes da mesma capacidade;
- integração essencial da capacidade deve ser concluída na própria fase.

## Regra de colaboração / Cloud Shell

O desenvolvimento deve continuar autônomo sempre que a ação puder ser executada diretamente pelo agente, mas o Cloud Shell passa a ser uma **ferramenta ativa de coexecução** quando isso reduzir espera ou antecipar validações.

O operador/fundador pode ser acionado para:
1. pré-validar guards específicos antes de um CI longo;
2. executar testes direcionados;
3. confirmar build/deploy quando o acesso externo exigir sessão própria;
4. executar comandos consolidados de publicação;
5. colher evidência objetiva de ambiente.

Regras:
- fornecer blocos curtos e seguros;
- preferir clone persistente em `~/...` quando a sessão puder ser reciclada;
- evitar testes pesados sem necessidade;
- pedir apenas o retorno essencial;
- nunca presumir publicação sem confirmação;
- pré-validação manual não autoriza ignorar erro real.

A política completa está em `docs/DEVELOPMENT_CI_WORKFLOW.md`.

## Fonte da verdade

Em divergências:
- `DECISIONS.md` prevalece para arquitetura/produto;
- `ROADMAP.md` prevalece para sequência;
- `STATUS.md` prevalece para continuidade;
- GitHub/`main` prevalece para o estado efetivo do código.

## Escopo do piloto

O módulo permanece disponível somente para a conta fundadora até o fechamento da FASE 13 e autorização explícita para a FASE 14.


## Consolidação SISCOFIS no Módulo 5

A arquitetura 11.5 mantém o motor histórico de Marco Zero/Conciliação, mas a entrada operacional foi simplificada. O contrato externo oficial é `emprovex_siscofis_inventory_v1`, com somente Nº Ficha, descrição, quantidade e valor unitário. Entrada manual e JSON de IA externa convergem antes da validação. A IA não recebe UG, catálogo, materialId, unidade nem estruturas internas. O Nº Ficha é dado auditável de origem e nunca identidade canônica. O ledger continua sendo a única autoridade quantitativa; `INITIAL_BALANCE` materializa também a posição `UNASSIGNED` pelo repository oficial. Novos snapshots usam v2, com leitura retrocompatível de v1. Ver D-066 e `PHASE_5_SISCOFIS.md`.


## Consolidação dos Módulos 6 e 7

Em 2026-09-25, **Meus Depósitos multi-depósito** e a **Biblioteca de estruturas físicas** foram consolidados na branch oficial da FASE 11.5.

Pontos de continuidade:
- depósitos/localizações continuam nos contratos históricos `warehouse_depot_v1` e `warehouse_location_v1`;
- `UNASSIGNED` continua sendo posição logística, nunca depósito;
- `warehouse_depot_layout_v1` continua sendo a única persistência do croqui;
- ativo e histórico são recuperados explicitamente por `depotId`;
- a biblioteca padrão vive em código (`WAREHOUSE_STRUCTURE_LIBRARY`) e persiste somente as instâncias realmente utilizadas no layout;
- nenhuma coleção Firestore de tipos de estrutura foi criada;
- Firestore Rules não precisaram ser alteradas;
- Módulo 8 é o próximo passo oficial e deverá consumir essa biblioteca sem reimplementar os contratos existentes.

Ver D-067 e ROADMAP.

## Consolidação do Módulo 8 — Editor visual do croqui

Em 2026-09-25, o Módulo 8 foi concluído na branch oficial da FASE 11.5.

- edição oficial permanece em planta baixa 2D;
- prévia 2.5D é derivada dos mesmos objetos do layout, sem segundo formato;
- grade e snap são opcionais;
- zoom e pan são locais ao editor;
- drag, resize e rotação não escrevem no Firestore;
- duplicação, exclusão visual, camadas e atalhos operam somente sobre o draft local;
- undo/redo existe somente durante a sessão do editor;
- biblioteca permanece em `WAREHOUSE_STRUCTURE_LIBRARY`;
- persistência continua exclusivamente em `warehouse_depot_layout_v1`;
- salvar versão continua sendo a única ação de persistência do editor;
- múltiplos depósitos permanecem isolados por `depotId`;
- Firestore Rules e Core EMPROVEX não foram alterados.

A camada visual foi implementada sem Fabric.js/Konva: a auditoria concluiu que evoluir o canvas React já existente era mais simples e leve para a base atual, evitando dependência imperativa adicional e mantendo a meta de baixo custo gráfico em máquinas antigas.

Próximo módulo oficial: **Módulo 9 — Integração croqui ↔ estoque**.
