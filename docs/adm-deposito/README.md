# ADM Depósito — Memória Oficial do Projeto

Esta pasta é a **fonte oficial de continuidade** do desenvolvimento do módulo ADM Depósito / Área Logística do EMPROVEX.

Conversas, prompts e memória informal não substituem estes documentos.

## Documentos oficiais

- `ROADMAP.md` — plano oficial, ordem de capacidades, gates e mapeamento dos blocos DEP/EXT.
- `DECISIONS.md` — decisões arquiteturais e funcionais congeladas.
- `STATUS.md` — estado real, baseline, fase concluída e próxima capacidade.
- `HANDOFF_TEMPLATE.md` — mensagem padrão para abrir a próxima fase.

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

## Regra de intervenção externa / Cloud Shell

O desenvolvimento deve ser o mais autônomo possível.

Quando uma ação exigir acesso externo não disponível ao agente:
1. identificar exatamente a necessidade;
2. evitar interrupções por ações pequenas que possam ser postergadas;
3. consolidar publicações compatíveis, idealmente após várias fases ou em gate de release;
4. fornecer um único bloco de comandos pronto para copiar;
5. pedir somente o retorno essencial;
6. nunca presumir publicação sem confirmação.

Exceção: segurança, bloqueio técnico ou validação indispensável exigem intervenção imediata.

## Fonte da verdade

Em divergências:
- `DECISIONS.md` prevalece para arquitetura/produto;
- `ROADMAP.md` prevalece para sequência;
- `STATUS.md` prevalece para continuidade;
- GitHub/`main` prevalece para o estado efetivo do código.

## Escopo do piloto

O módulo permanece disponível somente para a conta fundadora até o fechamento da FASE 13 e autorização explícita para a FASE 14.
