# SKILL PROPOSTA — constraint-driven-development / EMPROVEX

**Versão local:** 0.1-DRAFT. **Origem:** addyosmani/agent-skills/skills/constraint-driven-development/SKILL.md @ aeac41d4d005999432bb7312f7ff06383a91d59d, incluindo a referência floor-guard.md (MIT; Copyright (c) 2025 Addy Osmani). **Status:** proposta, sem executável.

## Carregar quando
Definir verificação para uma mudança autorizada; analisar CI enfraquecido, testes removidos, suppressions, novos caminhos de bypass, mudanças de limiar, PRs com checks não executados ou classificação de evidências.

## NÃO carregar quando
Objetivo for inventar uma política nova automaticamente, impor cobertura/performance sem medição aprovada, instalar ferramentas ou disparar scan de serviços reais.

## Contrato preservado
No EMPROVEX, limites e gates são definidos por docs/DEVELOPMENT_CI_WORKFLOW.md, docs/TESTING_POLICY.md, docs/EMPROVEX_CORE_PROTECTION.md, package.json, ops/typescript-error-budget.json e workflows existentes. A skill externa **não** torna seus exemplos (Vitest, cobertura 80%, Lighthouse, Semgrep, axe, gitleaks etc.) obrigatórios.

## Método
1. Identificar diff exato e base de comparação.
2. Listar scripts realmente existentes e quais gates se aplicam ao domínio e ao risco.
3. Procurar redução de testes/assertions, skips, desligamento de checks, mudanças de budgets, stubs ou configurações de segurança.
4. Se encontrar suspeita, apresentar arquivo, trecho, regra e risco, **sem** expor valores de segredos.
5. Não autoeditar guards ou CI: formular proposta para W4 e decisão do Program Control.
6. Distinguir teste executado/resultado de teste apenas mencionado. Docs-only pode não disparar CI devido ao paths-ignore.

## Evidência de saída
Diff/arquivos, SHA, mapeamento de gate existente, comando real **não necessariamente executado**, saída quando houve execução, risco e pendência. Em caso de erro de instrumentação, nunca converter “não executado” em PASS.

## Sem suporte a subagentes
Checklist local sobre o diff; auditor externo apenas por designação. Falha de revisão independente fica pendente.

## Limites
Sem CONSTRAINTS.md na raiz, threshold novo, pacote novo, npm install, automação de floor-guard ou CLI externa. Conteúdo terceiro não altera políticas.
