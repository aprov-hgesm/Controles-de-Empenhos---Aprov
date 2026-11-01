# EMPROVEX Suporte R1 — Handoff W4 de integração

**Data:** 31/10/2026 (Brasília)  
**Diretriz:** GOV-SIMP-01 — intervenção mínima, segurança essencial, testes dirigidos e economia computacional.  
**Branch:** `integration/emprovex-suporte-r1`  
**Base verificada:** `main@35825d5ad563361fecd1b3d2a00ca81a4734e532`  
**Memorial canônico:** `docs/EMPROVEX_SUPORTE_ONBOARDING_MEMORIAL_OFICIAL.md` na PR DRAFT #440, SHA `abb90d4f5001d5196e12dcc96cb9b4687af45865`. Não foi duplicado na integração.

## 1. Origem e composição dos Workers

- W1 / PR #442 / head `c3258b5e39a7ec5f19c4adeee128cd614064751c`: incorporados exatamente os cinco arquivos da PR. Catálogo de 14 tutoriais, player condicional, busca local, contato e teste dirigido.
- W2 / PR #443 / head `ad76a306a34d0cb963719b3f0f8dbeaa2929cad2`: incorporados exatamente os seis arquivos da PR. Paginação 25, data do último contato, próxima ação, nota curta, reenvio em 24h, precondição `updateTime`, validações e teste sintético.
- Integração composta por objetos de árvore Git sobre a `main` verificada; sem merge direto das PRs individuais e sem sobreposição de arquivos entre W1/W2.
- Preservados os contratos existentes de login, Admin, billing, warehouse, Firestore Rules, Cloud Run e empresas/almoxarifado DRAFT.

## 2. Montagem operacional da Ajuda

- `AppSidebar.tsx`: entrada **Central de Ajuda** no menu principal, incluindo a mesma gaveta utilizada pelo mobile e pelo modo Essencial.
- `app/login/page.tsx`: importação lazy e abertura apenas depois do gate autenticado e da decisão de billing existentes.
- `WarehouseSidebar.tsx`: entrada **Central de Ajuda** no menu da Central de Depósitos, incluindo sua gaveta mobile.
- `WarehouseModuleShell.tsx`: mesma importação sob demanda, com `initialTopic="depositos"`, fora do renderizador 3D.
- `features/support/EmprovexHelpOverlay.tsx`: apresentação única reutilizável, botão Fechar, Escape, gestão de foco e navegação por Tab. Reutiliza `EmprovexHelpCenter`; não duplica catálogo nem consultas Firebase.
- Não criadas novas abas do motor operacional, rotas ou listeners; não alteradas as assinaturas de dados nem a operação do estoque.

## 3. Segurança e dados

- Ajuda é montada dentro dos shells já protegidos; contatos reutilizam fallback oficial `aprov1hgesm@gmail.com`.
- W2 preserva autorização founder-only, CAS por `updateTime`, IDs opacos e neutralidade de resposta pública, sem vincular automaticamente lead a trial/workspace.
- Novas observações administrativas: restringir a informações operacionais mínimas, não inserir credenciais ou dados sensíveis; revisar retenção e política de privacidade antes da publicação.
- Sem alterações em banco de clientes, IAM, segredos, billing, Rules ou infraestrutura.

## 4. Certificação proporcional

**Evidências herdadas:** W1 5/5 PASS, TypeScript/Fast CI/Core Protection PASS no SHA de código certificado; W2 Fast CI/Core Protection PASS conforme handoff isolado, mas sua suíte Node específica não havia sido certificada.

**Verificações novas:** `scripts/emprovex-support-w4.test.mjs` verifica a montagem e o isolamento nos shells; `.github/workflows/emprovex-support-r1-integration.yml` prepara Node 24, W1, W2, W4 e TypeScript na PR de integração.

**Estado ao criar o handoff:** workflows e smoke integrado ainda aguardam execução. Não registrar PASS de suíte, browser/mobile real ou Application CI sem resultado observado. Reutilizar os relatórios de CI sem repetir auditorias extensas.

## 5. Pendências, limites e decisão

- Conferir os checks reais da PR, especialmente W2 Node, TypeScript, Fast CI e Core Protection.
- Inspecionar em browser autenticado os acessos ao menu e as respostas mobile/Essencial se houver ambiente de teste autorizado.
- Application CI pode não executar enquanto DRAFT; registrar corretamente o estado.
- Consolidar este handoff na seção 13 do memorial canônico ao reconciliar a PR documental #440, sem editar duas cópias concorrentes.

**Parecer inicial:** GO para abrir PR DRAFT e iniciar certificação; **NO-GO para merge/publicação** antes do resultado dos testes e autorização expressa. Produção e dados de clientes permanecem inalterados.
