# AGENT-QUALITY-01 — Compatibilidade e handoff

Data: 2026-10-14. Branch de entrega: `agent-eng-r1-w4-quality-automation`. Base confirmada: `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35`.

## Resultado da comparação

| Skill upstream | Valor aproveitável | Proteção EMPROVEX já existente | Decisão do W4 |
| --- | --- | --- | --- |
| `constraint-driven-development` | Piso documentado; alerta de redução de testes, supressões e thresholds; verificação da verificação | `TESTING_POLICY`, Core Protection, orçamento TypeScript + validação estrita, CI/guards | Aplicar piso **sem** criar `CONSTRAINTS.md` raiz neste ownership; documentar proposta de anti-bypass |
| `code-review-and-quality` | Revisão nas cinco dimensões, testes primeiro, findings reproduzíveis | CI, domínio e revisão pelos coordenadores | Template independente com prova positiva e decisão separada de merge |
| `doubt-driven-development` | Contestação de claims não triviais com contexto novo | Auditorias/gates, responsabilidades segregadas | Somente decisões com fronteiras, invariantes difíceis, auth/Rules/dados críticos |
| `test-driven-development` | RED → GREEN → REFACTOR; reprodução de bug antes da correção | Extensa suíte `scripts/*.test.mjs` e verificadores por domínio | Aproveitar para lógica nova/bug; não impor TDD a documentação ou decoração |
| `browser-testing-with-devtools` | DOM, console, acessibilidade, rede, screenshots, perfil isolado | Browser E2E com emuladores sob demanda, validação manual operacional | Browser dirigido por impacto; não anexar sessão do operador nem ler cookies/tokens |
| `ci-cd-and-automation` | Feedback rápido, checks previsíveis, proteção de branches, automação proporcional | Workflows Application CI, Core Protection, Recovery, Legal, Browser | Preservar triggers e gates; apenas recomendar branch protection e futuras otimizações |

Origem: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d) em `aeac41d4d005999432bb7312f7ff06383a91d59d`, arquivos em `skills/<skill>/SKILL.md`, licença [MIT](https://github.com/addyosmani/agent-skills/blob/aeac41d4d005999432bb7312f7ff06383a91d59d/LICENSE) (copyright © 2025 Addy Osmani). Comparação autoral; nenhum arquivo upstream foi copiado ou instalador executado.

## Compatibilidade com política

**FATO OBSERVADO:** `docs/TESTING_POLICY.md`: obrigatórios no CI normal dependências, typecheck, build, domínio/contratos, guards, Firestore aplicável, Core Protection e higiene; Browser E2E é sob demanda. `docs/DEVELOPMENT_CI_WORKFLOW.md`: pré-validação por impacto, exceção `docs/**`, otimizações de path filtering/parallelismo como diretriz evolutiva. O workflow Application CI ainda contém grande sequência centralizada de verificações. `git diff --check` não equivale a análise anti-bypass.

**PROPOSTA:** incorporar a matriz, template e métricas em pilotos com revisão do Coordenador. **Não implementar** nova workflow global nem exigir E2E universal. Não alterar thresholds, Rules ou permissões. Um eventual utilitário read-only necessita testes antes de ser conectado ao CI.

**RISCO:** consulta API retornou `main protected:false` e `rulesets: []`. Recomendação de governança ao Fundador: avaliar exigir reviews/status checks e bloquear force-push; confirmar permissões/planos/regras antes. **Nenhuma configuração foi alterada.**

## Pacote produzido

- `MAPA_GATES_EXISTENTES.md` — inventário implementação x planejamento.
- `MATRIZ_RISCO_VALIDACAO.md` — quatro classes e cobertura.
- `TEMPLATE_REVIEW.md` — revisão independente orientada à evidência.
- `ANTI_BYPASS.md` — sinais e processo manual read-only.
- `METRICAS_PILOTO.md` — instrumentação e comparação A/B.
- `RELATORIO_COMPATIBILIDADE.md` — matriz das seis skills e limites.

## Limites da execução

**NÃO EXECUTADO:** CI/testes, build, navegador, scanner anti-bypass automático, experimento A/B, nenhum deploy nem restore. Sem utilitários de código adicionados. Mudança **somente documental** não gera Application CI/Core Protection em PR por política de `paths-ignore`; ausência de workflow não é PASS. Gates recuperados por leitura do commit base, sem comprovação de run desta branch.

**CONTROLES PRESERVADOS:** não editar `main`, RC, Memorial, Program Control, workflows canônicos, Rules, billing, secrets, dados reais nem runtime. Branch e `docs/agent-engineering-r1/quality/` são exclusivos. Não foi solicitado merge automático.

## Handoff para Worker 5

1. Verificar este PR e seu diff exato contra `main`; confirmar seis arquivos e **zero** alterações operacionais.
2. Confrontar as recomendações W4 com W1/W2/W3 e arbitrar sem transferir ownership.
3. Aplicar `TEMPLATE_REVIEW` a um PR de baixo risco antes de generalizar a estratégia.
4. Submeter critérios de adoção do piloto ao Coordenador/Fundador. Não promover nenhuma recomendação documental a gate efetivo sem decisão.
5. Registrar no memorial global **somente pela coordenação**, após conciliação das frentes.

**CLASSIFICAÇÃO DO HANDOFF:** `PASS COM PENDÊNCIAS` apenas para a **entrega documental** se o diff final confirmar ownership; validação operacional e ganhos permanecem `NÃO EXECUTADO`/`NÃO MEDIDO`.
