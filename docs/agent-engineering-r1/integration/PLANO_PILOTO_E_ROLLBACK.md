# INTEGRATION-QA-01 — Plano de piloto e rollback

**Objetivo:** investigar se contexto selecionado e revisão proporcional ao risco reduzem falso PASS e retrabalho, sem promover as skills à governança canônica. **Este documento é proposta; piloto não executado.**

## P0 — Preparação e segurança

- Preservar PRs #296–#299 e a composição W5 em DRAFT, com SHAs e blobs conferidos.
- Autoridade vigente: Fundador e Program Control; skills são checklists sem poder operacional.
- Confirmar que nenhum piloto modifica main, RC, workflows, Firestore Rules, produção ou dados reais.
- Para adoção canônica futura, executar previamente backup externo W1, provar restauração independente W2 e obter decisão expressa do Fundador.
- Para piloto **somente documental**, o Coordenador pode autorizar um ensaio isolado sem esperar o restore, desde que não haja escrita canônica nem instalação de agente.

## P1 — Seleção da amostra

Selecionar tarefas pequenas pareadas, classe A, como inventário read-only de comandos de teste em uma subárea ou revisão de documentação não canônica. Fixar base SHA, tamanho aproximado, duração esperada e mesma política de revisão em ambos os grupos.

- **A (controle):** processo EMPROVEX existente, sem templates experimentais obrigatórios.
- **B (experimental):** processo vigente MAIS context-engineering W3 + template de revisão/matriz W4, sem reduzir testes.
- Usar, se houver condições, revisores alternados ou cruzados para reduzir viés do executor; pré-definir amostra e janela para coleta, sem inventar benefício estatístico.
- Não fazer A/B diminuindo segurança em atividades de classes C/D; nesses casos, uso só observacional e todos os gates vigentes.

## P2 — Execução, somente após autorização específica

As tarefas do piloto devem criar propostas em diretório documental exclusivo a ser aprovado pela coordenação. Não ativar root AGENTS.md nem scripts automáticos. Registrar em cada tarefa:
task_id, braço, risco, base/head SHA, paths, autor/revisor, evidências, testes aplicáveis e executados, tempo ativo, rodadas de CI, defeitos materiais confirmados, falso PASS, falsas flags, retrabalho e violação de ownership.

Usar os templates W4 para revisão, sem autoaprovação. As métricas são apresentadas com contagens brutas, denominadores, mediana e limitações. Resultado sem pares válidos ou sem amostra suficiente = INCONCLUSIVO; não prometer ganho por um caso isolado.

## P3 — Critérios de parada

Parar imediatamente se ocorrer: tentativa de alterar produção/Rules/RC, nova dependência externa não avaliada, suspeita de segredo em artefato público, perda de isolamento tenant, bypass de teste, colisão de ownership, falsificação de evidência ou resultado material não reproduzível. Bloquear promoção se faltar backup externo + drill independente ou revisão de autoridade.

## P4 — Homologação e reversibilidade

**Sem merge:** rollback consiste em não promover o PR experimental; registrar conclusão e eventualmente encerrar PR por decisão da coordenação. Preservar branches/histórico; não apagar refs para simular rollback.

**Se futuramente houver integração:** reversão por PR dedicado, diff seletivo e testes aplicáveis; nunca reset --hard/force-push em branch compartilhada. Root guidance/skills, se homologados no futuro, terão versionamento próprio e podem ser removidos sem afetar runtime. Qualquer restauração remota ou ajuste administrativo exige autorização separada.

**Critério para recomendar adoção:** backup e restore certificados no escopo acordado; review independente; A/B com evidência suficiente de benefício; riscos residuais aceitos explicitamente; documentação canônica reconciliada; sem regressão de gates.

## Saída esperada

Relatório com resultados observados, evidências linkadas a SHA, custo adicional, limitações e recomendação GO/NO-GO. Nesta etapa, **NENHUM piloto, medição ou rollback foi executado**.
