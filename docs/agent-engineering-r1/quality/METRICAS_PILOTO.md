# AGENT-QUALITY-01 — Métricas e experimento A/B

## Hipótese testável

A instrução experimental (matriz de risco + template independente + anti-bypass) deve melhorar a **detecção pré-integração de defeitos materiais e a suficiência de evidência**, sem piora excessiva de tempo, ciclos de CI ou retrabalho, em comparação ao processo vigente. Não afirmar ganhos antes de medir.

## Instrumentação

Para cada tarefa/PR coletar: `task_id`, classe A/B/C/D, escopo e tamanho do diff, contexto/base SHA, autor/revisor, regime A ou B, início/fim de revisão, CI runs/cancelamentos, testes aplicáveis/rodados, defeitos únicos (severidade e evidência), reworks, violação de ownership, falsas flags, etapa final e decisão do Coordenador.

| Métrica | Definição reproduzível | Como relatar |
| --- | --- | --- |
| Defeitos materiais capturados antes de integração | N° defeitos confirmados **Altos/Críticos** detectados antes de merge / nº tarefas revisadas, com duplicatas removidas | Contagem e razão por classe; “sem integração” se ninguém fez merge |
| Cobertura de riscos tocados | Nº riscos materiais com teste/observação apropriada e evidência / nº riscos materiais identificados no diff | Numerador/denominador; `N/A` quando 0 |
| Tempo ativo de revisão | Instante da primeira análise até veredito, subtraindo esperas externas **registradas** | Mediana e distribuição, sempre com n |
| Rodadas de CI | Nº execuções CI iniciadas por tarefa; diferenciar falha de produto, infraestrutura, cancelamento e não disparo | Rodadas e tempo consumido; `docs/**` separado |
| Retrabalho | Commits/correções após primeira revisão até aceitação, classificados por regressão, requisito ou escopo | Contagem por tarefa; não confundir commits independentes |
| Ownership | Nº alterações em paths alheios confirmadas / nº PRs inspecionados | Incidentes e gravidade |
| Falso positivo da revisão | Flags descartadas com razão demonstrada / nº flags levantadas | Precisão; medir o custo de alertas |
| Falso PASS detectado | Nº alegações de PASS refutadas por ausência de execução ou por teste inválido | Casos e evidência, sem dupla contagem |

**Eventos mínimos de dados:** revisão reportada, link de run, veredito da investigação e, quando ocorrer, link de defeito/commit de correção. Nunca exportar tokens, dados pessoais, saldos ou dumps produtivos.

## A/B comparável — desenho do piloto

**A = controle:** revisão segundo política EMPROVEX existente; sem obrigar nova matriz/template. **B = experimental:** mesma política e gates existentes **mais** critérios do Worker 4. Não alterar os workflows para favorecer um braço.

1. Selecionar tarefas **de baixo risco**, pareadas por classe A/B, dimensão do diff, superfície (Home, UI, docs), experiência do executor, dependências e base temporal.
2. Alternar A/B entre tarefas comparáveis e revisores (cross-over quando viável); usar mesmo formulário final de medição em ambos os braços.
3. Não aplicar A/B para relaxar revisões de segurança/Rules/financeiro: classes C/D conservam todos os gates e aprovações canônicos; estudo nelas deve ser apenas observacional.
4. Registrar desbalanceamentos de escopo, mudança de `main`/dependências, revisor, flakiness e gatilhos de CI; excluir ou estratificar pares inválidos com explicação anterior ao resultado.
5. Registrar defeitos encontrados posteriormente em janela definida **antes do piloto**. Avaliar qualidade do defeito e causa-raiz em revisão cega quando possível.
6. Relatar resultados por braço e classe com contagens brutas, mediana e intervalos/descritivos. Não interpretar uma única execução como ganho comprovado nem inventar percentuais.
7. Sem amostra comparável ou sem integração real, resultado será `INCONCLUSIVO`. O Coordenador decidirá ampliar, manter como recomendação ou descontinuar.

## Registro sugerido (uma linha por tarefa)

`task_id | A/B | risk_class | base_SHA | head_SHA | touched_paths | applicable_tests | executed_tests | CI_runs | CI_minutes | review_minutes | critical_high_confirmed | false_flags | rework_events | ownership_incidents | verdict | run_urls | limitations`

## Critérios antes da adoção

- Critérios idênticos de classificação e severidade nos braços.
- Nenhum bypass de verificação pré-existente.
- Revisor não “aprova” teste por ser autor do próprio código.
- Relatório inclui custo e qualidade da evidência, não só throughput.
- Aprovação humana após interpretação do piloto.

**STATUS:** plano de medição; **nenhuma tarefa A/B executada**, nenhum ganho quantificado.
