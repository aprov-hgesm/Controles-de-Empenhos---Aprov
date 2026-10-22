# INTEGRATION-QA-01 — Matriz de gates e evidências

**Base de auditoria:** main@d23c7aaa3e57de8f9679be48c636a698e5ad8f3d. **Escopo atual:** documentação isolada.

| Gate | Evidência exigida | Resultado na preparação | Significado |
| --- | --- | --- | --- |
| G01 — Proveniência | PR, base/head SHA, diff e paths W1–W4 | CONFIRMADO POR API | Quatro PRs DRAFT e 23 arquivos exclusivos |
| G02 — Ownership | Somente docs/agent-engineering-r1/{backup,recovery,architecture,quality,integration}/ | CONFORME PROJETO; VALIDAR NO DIFF FINAL | Nenhuma escrita de runtime/workflow/Rules |
| G03 — Preservação Git | Clone --mirror, refs de branches/PRs, bundle verify, SHA-256 e mídia externa | BLOQUEADO | W1 entregou procedimento, não cópia material |
| G04 — Recuperabilidade | Cópia externa real, verificação de assinatura/hash, clone descartável, git fsck, SHAs | NÃO DEMONSTRADO | W2 não executou drill |
| G05 — Governança W3 | Hierarquia, limites, upstream fixado, AGENTS apenas proposto | PASS DOCUMENTAL | Skills não instaladas |
| G06 — Qualidade W4 | Matriz proporcional, revisão independente, nenhum gate enfraquecido | PASS DOCUMENTAL | Sem scan automático ou piloto medido |
| G07 — Application CI/Core Protection | Run associado ao HEAD quando aplicável | NÃO EXECUTADO NESTA COMPOSIÇÃO | Docs-only tem paths-ignore; ausência de status não significa PASS |
| G08 — Recovery Guardrails | Workflow quando paths protegidos mudarem | NÃO APLICÁVEL À EDIÇÃO DOCUMENTAL | Não substituir drill externo por CI |
| G09 — Browser E2E | Seleção por risco e workflow_dispatch, quando necessário | NÃO APLICÁVEL | Nenhuma alteração em UI/DOM/fluxo nesta branch |
| G10 — Proteção main | Revisão administrativa de branch protection, rulesets e checks | PENDENTE | API retornou protected=false; rulesets [], detalhe 403 em inspeções W1/W2 |
| G11 — Compatibilidade VISUAL-R1 | Main e RC conservados; nenhuma colisão com commit visual | VALIDAR NO DIFF FINAL | Base atual possui 70 mudanças visuais em commit independente |
| G12 — Conteúdo/segredos | Inspeção de diff/whitespace, paths, marcadores de segredos | TRIAGEM TEXTUAL PARCIAL; FINAL PENDENTE | Não equivale a secret scanning abrangente |
| G13 — Piloto A/B | Tarefas comparáveis, métricas e aprovação do Coordenador | NÃO EXECUTADO | Sem alegação de ganho |

## Protocolo de verificação final do PR W5

1. Congelar SHA de base e HEAD. Confirmar 27 novos arquivos: 23 de origem + 4 de integration/, zero alteração/deleção de arquivo preexistente.
2. Confrontar, por caminho, Git blob SHA no HEAD do W5 com Git blob SHA na branch-fonte W1–W4.
3. Validar JSON de inventário W1 e conteúdo Markdown, links internos e formatação; verificar padrões de segredo/credencial sem publicar conteúdo sensível.
4. Executar git diff --check em checkout que tenha acesso Git e registrar saída. Se não houver checkout disponível, indicar NÃO EXECUTADO e registrar inspeção textual distinta; não reivindicar equivalência.
5. Observar execução de CI, se disparada; docs-only normalmente não aciona Application CI/Core Protection. Nunca registrar PASS sem run associado ao SHA.
6. Consultar main e RC novamente para demonstrar ausência de mutações pelo W5. A versão consultada pode ter avançado por outra frente; diferenciar mudanças concorrentes de alterações causadas por esta branch.

## Regras decisórias

- Um status documental PASS não certifica backup, restauração, teste da aplicação ou lançamento.
- Risco A/B/C/D do W4 seleciona validações adicionais, sem revogar gates oficiais.
- Falta de restore real bloqueia GO de governança; não bloqueia a leitura ou comparação de documentos no PR DRAFT.
- Nenhuma alteração de branch protection/rulesets, AGENTS.md, workflows, secrets ou Rules nesta missão.
