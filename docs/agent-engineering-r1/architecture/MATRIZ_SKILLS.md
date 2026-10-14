# AGENT-ARCHITECTURE-01 — Matriz ADOTAR / ADAPTAR / NÃO ADOTAR

**Fonte avaliada:** addyosmani/agent-skills@aeac41d4d005999432bb7312f7ff06383a91d59d. **Licença:** MIT, copyright (c) 2025 Addy Osmani. A matriz separa técnicas úteis das instruções do projeto externo que não têm autoridade para modificar EMPROVEX.

| Skill / instrução | Decisão | Fundamentação no EMPROVEX | Risco e salvaguarda |
| --- | --- | --- | --- |
| context-engineering: carregar regras, contrato, código e evidência por relevância | **ADOTAR** | Memorial, Program Control, docs especializados e código já oferecem camadas canônicas | Evitar copiar tudo para o prompt; priorizar estado verificado |
| context-engineering: criar ou editar AGENTS.md/CLAUDE.md diretamente | **ADAPTAR** | Política W3 restringe escrita à área documental | Usar AGENTS_PROPOSTO.md; promoção depende de revisão |
| context-engineering: reiniciar sessão com checkpoint verificável | **ADOTAR** | Handoffs e SHA já são parte da governança | Não transformar resumo velho em estado atual |
| constraint-driven-development: não reduzir gates, testes, asserts ou thresholds | **ADOTAR** | Core Protection, regras de testes e budget TS existem | Guardar evidência do diff sem exceções silenciosas |
| constraint-driven-development: criar CONSTRAINTS.md na raiz e números padrão (80% coverage, LCP etc.) | **NÃO ADOTAR diretamente** | Ausência de contrato numérico aprovado para essas métricas; política vigente é outra | Propor métricas a W4/Program Control; nenhum número externo vira exigência |
| constraint-driven-development: instalar Semgrep, gitleaks, Vitest, Lighthouse, axe, Stryker ou editar CI | **NÃO ADOTAR diretamente** | Ferramentas não demonstradas como dependências/gates canônicos | Proposta isolada com análise de custo, segurança e compatibilidade; sem instalação |
| constraint-driven-development: floor-guard externo por git diff | **ADAPTAR** | Há vários guards já existentes; W3 não pode alterar scripts/ | Propor integração documental; não executar nem copiar guard automaticamente |
| code-review-and-quality: cinco eixos de revisão (correção, legibilidade, arquitetura, segurança, performance) | **ADOTAR** | Compatível com revisão independente já exigida | Checklist complementar, não substitui aceites do Program Control |
| code-review-and-quality: teste de mutação e review por segundo modelo | **ADAPTAR** | Exige ambiente e orçamento; não há garantia de agente independente | Quando disponível, com escopo isolado e autorização de ferramenta; fallback documental |
| code-review-and-quality: “Approve” = merge liberado | **NÃO ADOTAR** | Fundador/Coordenador mantêm decisão final de integração e release | Parecer técnico nunca significa GO ou merge |
| doubt-driven-development: listar pressupostos e tentar refutar decisões não triviais | **ADOTAR** | Protege idempotência, segurança e logística | Limitar a pontos de risco; registrar achados e incertezas |
| doubt-driven-development: spawn de subagente, cross-model obrigatório ou CLI externa | **ADAPTAR** | Chat workers e runners têm capacidades diferentes; hierarquia já definida | Não criar trabalhador/nível de autoridade automaticamente; revisão externa opcional e autorizada |
| doubt-driven-development: repetição recursiva/autoaprovação | **NÃO ADOTAR** | Revisão independente e limite de WIP pertencem ao Program Control | No máximo ciclos planejados, escalonamento explícito |
| README externo: /build auto e /ship, auto-instalação npx skills add | **NÃO ADOTAR** | Pode iniciar mutações, dependências, workflows ou publicação fora de aprovação | Sem executar instalador; manter apenas especificações manuais em docs/ |

## Pontos de incompatibilidade concreta

- O exemplo de context-engineering cita React 18/Vite/Express/Postgres, **mas o produto web examinado é Next.js 15/React 19/Firebase**; exemplos externos não definem stack do EMPROVEX.
- Os exemplos externos npm test, vitest run --coverage e npm run lint --fix **não representam o mapa de scripts demonstrado**. Os testes existentes são npm scripts específicos, muitos com node --test e emuladores.
- A skill constraints pode propor bloqueio TS genérico; o CI implementa comparação com ops/typescript-error-budget.json (maxErrors=0 no snapshot) e não deve ser reescrito.
- Workflow do projeto usa Node 20 e Java 21 no GitHub Actions; assumir instalação universal de CLIs ou execução no shell local não é seguro.
- A referência para guard de “floor” fica em skills/constraint-driven-development/references/floor-guard.md; copiar esse arquivo para scripts/ violaria ownership. Se algum mecanismo futuro reutilizar trechos expressivos, preservar aviso de licença MIT e sua procedência.
- Comandos de shells externos, acesso a Preview/produção, scripts de billing, recovery apply, Firestore Rules e operações em workspace são **fora da autonomia** das skills.

## Parecer resumido

**ADOTAR** os princípios de contexto enxuto, qualidade fundamentada em evidências, revisão de cinco eixos e crítica de hipóteses. **ADAPTAR** por meio de quatro wrappers documentais. **NÃO ADOTAR** instaladores, gates novos, thresholds genéricos, subagentes autônomos, novas autoridades e comandos de shipping sem decisão específica.
