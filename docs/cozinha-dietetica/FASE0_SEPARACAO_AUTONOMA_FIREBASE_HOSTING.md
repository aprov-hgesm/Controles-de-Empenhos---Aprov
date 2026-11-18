# FASE 0 — EXTRAÇÃO DO SISTEMA HOSPITALAR AUTÔNOMO E PUBLICAÇÃO FIREBASE HOSTING LIVE

**Data:** 15/11/2026  
**Fonte canônica:** [Memorial Oficial V2, seção 22](../EMPROVEX_COZINHA_DIETETICA_MEMORIAL_OFICIAL.md#22-virada-de-produto--sistema-hospitalar-independente-e-publicação-sintética-no-firebase-hosting-decisão-de-15112026)  
**Situação:** execução técnica pendente. Esta especificação não é prova de deploy.  
**Código de partida:** PR [#554](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/554), branch \`feat/cozinha-dietetica-mapa-cadastro-direto-20261112\`, HEAD a verificar, SHA auditado \`07555afcc2044a58c7b053363acaffdda4bf2e12\`.  
**Projeto GCP/Firebase existente:** \`cozinha-dietetica\`; serviço de QA \`cozinha-dietetica-qa\` privado.  
**Nome de trabalho sugerido (não aprovado):** VitaMapa. **Nenhum domínio está confirmado ou publicado.**

## Missão executável /goal

> /goal Extraia o código hospitalar funcional do EMPROVEX, tomando como base a PR #554 e a cadeia W09→W12, para criar um produto de nutrição/dietas hospitalares autônomo, sem dependências comerciais, visuais, de infraestrutura ou de login do EMPROVEX. Prepare frontend independente para Firebase Hosting, backend hospitalar seguro, Auth e Firestore separados, marca própria e domínio futuro. Publique no canal live de um site exclusivo do Firebase Hosting somente após testes reais de isolamento e sem dados reais de pacientes/dietas. Execute E2E com hospitais, contas e informações inteiramente sintéticos. Preserve o Cloud Run QA privado, sem tornar serviços clínicos públicos por atalhos; se falta credencial, finalize código, CI, configuração e instruções concretas e registre precisamente o que não foi publicado. Apresente SHA, URLs reais apenas quando verificadas, provas de testes e decisão GO/NO-GO por fronteira. Não altere main nem o EMPROVEX produtivo.

## Implementação prioritária (sem workers redundantes)

1. **Extrair:** criar árvore/repositório próprio a partir do código funcional, eliminando imports de \`app/login\`, \`AppShellLogo\`, billing, empresa, almoxarifado e portal financeiro; conservar domínio hospitalar, serviços, testes e histórico de decisão. Regredir W0–W12 e PR #554. Não esconder código do EMPROVEX atrás de simples rota.
2. **Desenvolver identidade própria:** produto com nome aprovado, marca, ícones, PWA, PDFs, etiquetas e mensagens sem EMPROVEX. \`VitaMapa\` é somente sugestão; não registrar domínio sem aprovação. Não usar imagens/logo EMPROVEX por omissão.
3. **Separar runtime:** frontend compatível com Hosting estático (preferencialmente React SPA extraída das TSX); APIs server-side independentes. O Next.js atual inclui \`output: 'standalone'\`, middleware e \`/api/hospital/*\`; não executar \`firebase deploy\` apontando um \`public/\` genérico como se isso contivesse todo o sistema.
4. **Configuração isolada Hosting:** diretório dedicado com \`firebase.json\`, \`.firebaserc\`/target, build da SPA, cabeçalhos, fallback SPA, \`no-store\` para conteúdo sensível e \`noindex\` para testes. Usar \`firebase deploy --only hosting:<TARGET> --project cozinha-dietetica\` apenas depois de identificar SITE_ID/TARGET reais, confirmar conta e build. Nunca \`firebase deploy\` indiscriminado a partir da raiz do EMPROVEX.
5. **API segura:** o Cloud Run \`cozinha-dietetica-qa\` foi configurado como \`internal\` e Invoker autenticado; requisições públicas do Hosting não devem derrubar esse limite. Criar gateway com camada pública mínima, validação server-side de Firebase ID Token e scoping \`qa_*\`, chamada autenticada via OIDC ao backend privado e controles de abuso. Alternativa arquitetural só após parecer de segurança e provas. Não desabilitar IAM, não conceder \`allUsers\` ao QA e não abrir Firestore Rules.
6. **Simulação viva:** auth com contas apenas fictícias (\`example.test\`), oito perfis, dois hospitais falsos e isolamento por unidade; sem registro público e com banner permanente "AMBIENTE DE SIMULAÇÃO — DADOS FICTÍCIOS — NÃO USAR PACIENTES REAIS". Proibir no servidor qualquer org que não use o prefixo \`qa_\`. Dados de teste devem ser originalmente criados como fictícios; nunca mascarar dados reais.
7. **E2E e publicação:** testar login/revogação, pacientes/leitos fictícios, mapas 06/10/16, refeições principal/secundária, acompanhantes, jejum/alergias, produção, correção, expedição, distribuição com horário, PDF/etiquetas, Nutrição e relatórios; desktop e Android. Depois publicar o **live** (não só preview), coletar ID do release, URL HTTPS real, verificações de segurança e rollback.
8. **Operação:** configurar orçamentos/alertas, logs minimizados sem conteúdo clínico, controle de custos e backup/restauração do Firestore de simulação. Não considerar testes no emulador como prova de ambiente GCP real.

## Critérios mínimos de aceite

- [ ] O novo frontend compila sem código financeiro/empresarial nem credenciais/identidade EMPROVEX.
- [ ] O novo nome/marca/domínio foram confirmados e não são apresentados como registrados antecipadamente.
- [ ] Projeto Firebase hospitalar isolado, Rules fechadas no acesso cliente e IAM do Cloud Run privado preservado.
- [ ] \`qa_*\` e contas sintéticas exigidos no servidor; criação livre de contas indisponível.
- [ ] Backend e frontend conectados por gateway autorizado; nenhum 401/403 contornado.
- [ ] Testes E2E emulador + via HTTPS live com dois hospitais fictícios, oito perfis e três horários aprovados.
- [ ] Etiquetas/relatórios PDF funcionam sem dados clínicos reais; não há links para o EMPROVEX.
- [ ] Site efetivamente implantado no live do Firebase Hosting com ID de release/URL confirmados.
- [ ] \`NO-GO\` expresso para pacientes/dietas reais até autorização institucional futura.

## Estados a registrar

| Fronteira | Estado ao criar este documento |
|---|---|
| Código F0 separado | NÃO EXECUTADO |
| Nome e marca final | A DEFINIR |
| Firebase Hosting live | NÃO PUBLICADO |
| Simulação E2E em GCP real | NÃO EXECUTADA |
| Homologação clínica / pacientes reais | NÃO AUTORIZADO |
| EMPROVEX financeiro em produção | FORA DE ESCOPO / PRESERVAR |

**Não converter este arquivo em certificado de deploy.** Atualize a tabela com fatos verificáveis, commit/release e data após cada entrega.


---

## Retificação de produto 15/11/2026 — prioridade GOV-SIMP-01

A seção 23 do Memorial Oficial V2 **prevalece sobre restrições de \`qa_*\` e "somente dados sintéticos" como requisito fixo de código**.

- **Suportar pacientes e dietas reais já na V1 funcional:** toda a lógica Firestore/servidor deve aceitar hospitais, unidades e dados reais autorizados, com cadastramento direto e simples.
- **Sem travas por nomenclatura do tenant:** não exigir prefixos \`qa_*\`, domínio de e-mail \`example.test\`, \`HOSPITAL_QA_APP_READY\` ou banners de demonstração em toda operação como única forma de habilitar o produto; separar configuração de ambientes, não bloquear recursos.
- **Teste de primeira publicação:** usar **somente informações sintéticas**, escolhidas para o teste, sem importar pacientes reais. O Hosting live será uma aplicação operacional, não uma demo. Isto não significa autorização para iniciar uso assistencial real sem verificar segurança e organização institucional.
- **Desburocratização:** nenhuma reconfirmação redundante, aprovação nutricional rotineira ou bloqueio automático apenas por horário; preservar proteção de alergia, jejum, identidade, vínculo/unidade, rastreabilidade, transações e recuperação.
- **Condição de deploy:** frontend, backend, validação de token e isolamento funcionando, sem transitar para \`allUsers\` no serviço QA existente. Se for necessário serviço público novo, a autorização de chamadas deve ser verificada pelo aplicativo em cada rota clínica.
