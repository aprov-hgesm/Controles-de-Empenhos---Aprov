# AGENT-QUALITY-01 — Mapa dos gates existentes

Data da leitura: 2026-10-14. Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`. Base de leitura: `main@97556bb8eb04af070016f9e58ddc2d9cca36bb35`.

## Método e limite da evidência

**FATO OBSERVADO:** leitura dos arquivos versionados `docs/TESTING_POLICY.md`, `docs/DEVELOPMENT_CI_WORKFLOW.md`, `docs/EMPROVEX_CORE_PROTECTION.md`, `package.json` e dos seis workflows em `.github/workflows/`. Esta leitura demonstra configuração presente na base, **não** prova que os jobs executaram com sucesso nesta branch. Os resultados de execução devem ser recuperados do workflow run associado a cada SHA.

| Gate/área | O que existe na base | Disparo efetivo | Condição para alegar PASS |
| --- | --- | --- | --- |
| Application CI | `.github/workflows/application-ci.yml`: `validate-application`, muitos guards e testes de domínio, build, TypeScript e higiene; jobs de fechamento dependentes de `validate-application` | PR não exclusivamente documental, push na `main` não exclusivamente documental e `workflow_dispatch` | Run + SHA + job completo + conclusão `success`; sem resultado presumido |
| Core Protection | `.github/workflows/emprovex-core-protection.yml`: três verificadores de firewall e isolamento EMPROVEX/ADM, sem `npm ci` | PR e push na `main`, exceto `docs/**`; manual | Execução e status; falha estrutural é bloqueante |
| Recovery guardrails | `.github/workflows/recovery-guardrails.yml`: testes de recuperação, plano read-only, backup, health e proteção operacional SaaS | PR apenas em paths explicitamente filtrados; manual | Executar quando o diff alcançar os paths relevantes, não inferir cobertura fora da lista |
| Browser E2E | `.github/workflows/browser-e2e-on-demand.yml` executa Firebase Auth/Firestore Emulator + browser | Somente `workflow_dispatch` | Evidência do run quando solicitado; **não é gate global obrigatório** |
| SAAS-C Browser Validation | `.github/workflows/saas-c-browser-validation.yml` contém smoke direcionado com emuladores | PR com base na integradora SaaS e condição de head, ou manual | Evidência específica para o run/fluxo; não equivale a E2E geral |
| SAAS-DL Legal Validation | `.github/workflows/saas-dl-legal.yml`: typecheck, legal, security Rules, build e diff | PR com paths legais/Rules filtrados; manual | Resultado do workflow quando alcançado pelo diff |
| TypeScript | No Application CI: primeiro `npm run typecheck` acompanhado de `ops/typescript-error-budget.json` (etapa de orçamento); **mais adiante** `npm run typecheck` estrito | Integrado ao Application CI | Não confundir etapa de orçamento com PASS final; última etapa precisa passar |
| Build | `npm run build` no Application CI | Integrado ao Application CI | Build real concluído, não só tipagem |
| Segurança/Firestore | `npm run test:security:multitenant` e testes com Firebase Emulator; guards auth/Rules/workspace em `package.json`/Application CI | Integrado à bateria de Application CI ou workflow específico | Identificar o teste que cobre o risco tocado e sua saída |
| Testes de domínio | Muitos `npm run test:*` por EMPROVEX, ADM Depósito, Mobile, SaaS e contratos | Em sequência no `validate-application` | Prova do teste relevante e/ou run integral; não dizer que todos são path-filtered |
| Higiene de diff | `git diff --check` em Application CI; proteção leve de arquitetura separada | Application CI | Higiene não substitui revisão semântica |
| Proteção de branch | API de `main` retornou `protected:false` e consulta de rulesets retornou `[]` em 2026-10-14 | Ausente na consulta | Risco de enforcement: status verde não significa bloqueio efetivo de merge |

## O que é política, o que já é implementação

**IMPLEMENTADO:** `paths-ignore: docs/**` em Application CI e Core Protection; execução manual de Browser E2E; workflow específico de Recovery por paths; teste Firestore com emulador; build; última etapa TypeScript; `git diff --check`; firewall core/ADM.

**POLÍTICA VIGENTE:** `docs/TESTING_POLICY.md` declara que E2E é sob demanda, prioriza o risco e permite validação manual de cenários físicos/visuais. `docs/DEVELOPMENT_CI_WORKFLOW.md` defende pré-validação focada e CI seletivo.

**PLANEJADO, NÃO DEMONSTRADO COMO IMPLEMENTADO GERALMENTE:** path filtering de CI por **todos** os domínios, paralelização geral de grupos, smoke genérico permanente. O `validate-application` observado ainda agrega muitos testes/guards em um job longo.

**LACUNA:** não foi identificada automação geral de revisão adversarial ou de varredura semântica anti-bypass em todo PR. `git diff --check` verifica whitespace, não removals de assertions, `.skip` ou mudança de thresholds.

## Protocolo mínimo de comprovação

1. Fixar PR, base/head SHAs, timestamp, paths alterados e categoria de risco.
2. Registrar os gates *aplicáveis* e os realmente disparados; para `docs/**` somente, registrar `NOT_TRIGGERED_BY_DESIGN`, jamais `PASS`.
3. Para cada run aplicável, registrar URL, SHA, conclusão e testes cobertos. Se não executado, registrar `NÃO EXECUTADO`.
4. Distinguir falha genuína de aplicação, falha comprovadamente ambiental e ausência de evidência; nenhuma delas vira PASS por dedução.
5. Avaliar o diff e não só o selo verde do CI. Sem branch protection, aprovação humana pré-merge é ainda mais importante.

Fontes internas: [política](../../TESTING_POLICY.md), [fluxo oficial](../../DEVELOPMENT_CI_WORKFLOW.md), [core](../../EMPROVEX_CORE_PROTECTION.md) e [workflows](../../../.github/workflows/).

**NÃO EXECUTADO:** nenhum teste, build, deploy, restore ou alteração de configuração foi disparado por este documento.
