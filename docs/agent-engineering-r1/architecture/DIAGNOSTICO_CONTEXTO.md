# AGENT-ARCHITECTURE-01 — Diagnóstico factual

**Data de referência:** 14/10/2026. **Natureza:** leitura do GitHub, sem execução de comandos no runtime e sem alteração da aplicação.

## 1. Evidências observadas

| Evidência | Observação verificável |
| --- | --- |
| main | 97556bb8eb04af070016f9e58ddc2d9cca36bb35, consultada na API de branches antes da criação da branch W3 |
| Fonte de implementação | package.json e package-lock.json no SHA acima |
| Interface | Next.js 15.5.24, React ^19, TypeScript ^5; App Router em app/, incluindo app/api/ e app/central-mobile/ |
| Plataforma | Firebase SDK ^10.12.2; firebase.json referencia bancos Firestore principal e emprovex-warehouse; Firestore Rules em arquivos separados |
| Estilos | Tailwind CSS ^4.0.0-alpha.0 no package.json; app/globals.css e app/layout.tsx |
| Ferramentas | scripts .mjs em scripts/; npm scripts; CI com Node 20 e Java 21; workflows em .github/workflows/ |
| Gates | application-ci.yml (typecheck, build, domínios, segurança, guards), emprovex-core-protection.yml e recovery-guardrails.yml |
| Tipagem | ops/typescript-error-budget.json define maxErrors=0 no baseline examinado |
| Política de browser | docs/TESTING_POLICY.md dispõe E2E sob demanda; docs/DEVELOPMENT_CI_WORKFLOW.md determina seleção por impacto |
| Governança | docs/EMPROVEX_PROGRAM_CONTROL.md define autoridade do Fundador, Program Control, Coordenadores e workers |
| Proteção de core | docs/EMPROVEX_CORE_PROTECTION.md e scripts/verify-emprovex-core-protection.mjs |
| Concorrência | PR #295 VISUAL-R1 em DRAFT na consulta; não pertence ao W3 |
| Fonte externa | addyosmani/agent-skills no commit aeac41d4d005999432bb7312f7ff06383a91d59d; licença MIT, copyright (c) 2025 Addy Osmani |

Fontes internas imutáveis: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/tree/97556bb8eb04af070016f9e58ddc2d9cca36bb35 e https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/97556bb8eb04af070016f9e58ddc2d9cca36bb35/.github/workflows/application-ci.yml.

Fonte externa: https://github.com/addyosmani/agent-skills/tree/aeac41d4d005999432bb7312f7ff06383a91d59d/skills.

## 2. Comandos REAIS observados no package.json

- npm run dev — Next local.
- npm run typecheck — tsc --noEmit.
- npm run build — next build.
- npm run verify:emprovex-core-protection — guard principal.
- npm run test:recovery — teste de recuperação.
- npm run test:mobile-k-canonical-ops — teste de domínio MOBILE-K.
- npm run verify:mobile-k-canonical-ops — guard MOBILE-K.
- npm run test:security:multitenant — teste com Firebase Emulator; só executar em ambiente isolado preparado.
- npm run test:e2e:browser — E2E com emuladores; sob demanda segundo política vigente.

**Importante:** ter script listado não prova execução nem PASS. A instalação de dependências não foi feita neste worker. O uso de npm run lint exige cautela: o script existente é next lint, não a sugestão externa npm run lint --fix; não foi verificada aqui sua execução.

## 3. Divergências e decisões não tomadas

1. **Estado documental defasado:** a seção inicial do Memorial Oficial ainda declara produção main@e90f92a.../fase de pré-composição (04/10), enquanto o GitHub informa main@97556bb... com commit de publicação em 06/10. A API do GitHub comprova o HEAD; não comprova, isoladamente, todo o estado vivo de Vercel/Firebase. Propor reconciliação ao Program Control; **não editar o Memorial**.
2. **Política E2E com enunciados tensionados:** TESTING_POLICY.md diz que Browser E2E não é requisito permanente para merge/deploy e é sob demanda; DEVELOPMENT_CI_WORKFLOW.md usa “obrigatório” para certos fluxos. Esta proposta adota a regra mais segura de planejar testes por impacto e solicitar interpretação do coordenador quando houver conflito; não redefine gatilhos globais.
3. **Estado de proteção de branch:** endpoint de branch protection respondeu 403 “Resource not accessible by integration”; endpoint de rulesets retornou lista vazia. **Não afirmar ausência de proteção** com base no 403. Propor verificação administrativa independente.
4. **Ferramentas sugeridas externamente não provadas no stack:** Vitest, Semgrep, gitleaks, axe CLI, Lighthouse, Stryker, agentes aninhados e comandos /build auto, /ship não foram identificados como mecanismo canônico no pacote avaliado.
5. **CI documental:** application-ci.yml e emprovex-core-protection.yml usam paths-ignore docs/** nos eventos normais. Um PR exclusivamente documental pode não disparar esses gates; status ausente não é FAIL técnico nem PASS.
6. **Condição de leitura:** comparação realizada no snapshot main do GitHub, não em checkout local. Não houve comandos npm, builds, deployment, acesso a dados reais ou inspeção de segredos.

## 4. Implicações para W3

Tratar as quatro skills como **material de referência sujeito a adaptação**, não como comandos de execução ou novas políticas. Preservar Program Control e regras de ownership. Introduzir somente propostas versionadas em docs/agent-engineering-r1/architecture/, com decisão posterior de adoção pelo integrador e pelo Fundador quando aplicável.
